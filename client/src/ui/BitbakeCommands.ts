/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

/// This files contains the VSCode commands exposed by the extension

import * as vscode from 'vscode'
import fs from 'fs'

import { logger } from '../lib/src/utils/OutputLogger'
import { type BitbakeWorkspace } from './BitbakeWorkspace'
import { addActiveRecipe, selectRecipe } from './RecipeSelection'
import { type BitBakeProjectScanner } from '../driver/BitBakeProjectScanner'
import { runBitbakeTerminal } from './BitbakeTerminal'
import { type BitbakeDriver } from '../driver/BitbakeDriver'
import { sanitizeForShell } from '../lib/src/BitbakeSettings'
import { type BitbakeTaskDefinition, type BitbakeTaskProvider } from './BitbakeTaskProvider'
import { bitbakeESDKMode } from '../driver/BitbakeESDK'
import bitbakeEnvScanner from '../driver/BitbakeEnvScanner'
import { type BitbakeTerminalProfileProvider, openBitbakeTerminalProfile } from './BitbakeTerminalProfile'
import { BitbakeToaster } from './BitbakeToaster'
import { type LanguageClient } from 'vscode-languageclient/node'
import { getVariableValue } from '../language/languageClient'

let parsingPending = false

export function registerBitbakeCommands (context: vscode.ExtensionContext, bitbakeWorkspace: BitbakeWorkspace, bitbakeTaskProvider: BitbakeTaskProvider, bitBakeProjectScanner: BitBakeProjectScanner, bitbakeTerminalProfileProvider: BitbakeTerminalProfileProvider, client: LanguageClient): void {
  const bitbakeToaster = new BitbakeToaster(bitBakeProjectScanner.bitbakeDriver)

  context.subscriptions.push(
    vscode.commands.registerCommand('bitbake.parse-recipes', async () => { await parseAllrecipes(bitbakeWorkspace, bitbakeTaskProvider) }),
    vscode.commands.registerCommand('bitbake.build-recipe', async (uri) => { await buildRecipeCommand(bitbakeWorkspace, bitBakeProjectScanner, uri) }),
    vscode.commands.registerCommand('bitbake.clean-recipe', async (uri) => { await cleanRecipeCommand(bitbakeWorkspace, bitBakeProjectScanner, uri) }),
    vscode.commands.registerCommand('bitbake.scan-recipe-env', async (uri) => { await scanRecipeCommand(bitbakeWorkspace, bitbakeTaskProvider, bitBakeProjectScanner, uri) }),
    vscode.commands.registerCommand('bitbake.scan-global-env', async () => { await scanEnvironmentCommand(bitbakeTaskProvider) }),
    vscode.commands.registerCommand('bitbake.run-task', async (uri, task) => { await runTaskCommand(bitbakeWorkspace, bitBakeProjectScanner, client, uri, task) }),
    vscode.commands.registerCommand('bitbake.drop-recipe', async (uri) => { await dropRecipe(bitbakeWorkspace, bitBakeProjectScanner, uri) }),
    vscode.commands.registerCommand('bitbake.drop-all-recipes', async () => { await dropAllRecipes(bitbakeWorkspace) }),
    vscode.commands.registerCommand('bitbake.watch-recipe', async (recipe) => { await addActiveRecipe(bitbakeWorkspace, bitBakeProjectScanner, recipe) }),
    vscode.commands.registerCommand('bitbake.rescan-project', async (focusOnError = true) => { await rescanProject(bitBakeProjectScanner, focusOnError) }),
    vscode.commands.registerCommand('bitbake.terminal-profile', async () => { await openBitbakeTerminalProfile(bitbakeTerminalProfileProvider) }),
    vscode.commands.registerCommand('bitbake.open-recipe-workdir', async (uri) => { await openRecipeWorkdirCommand(bitbakeWorkspace, bitBakeProjectScanner, client, uri) }),
    vscode.commands.registerCommand('bitbake.recipe-devshell', async (uri) => { await openBitbakeDevshell(bitbakeTerminalProfileProvider, bitbakeWorkspace, bitBakeProjectScanner, uri) }),
    vscode.commands.registerCommand('bitbake.collapse-list', async () => { await collapseActiveList() }),
    vscode.commands.registerCommand('bitbake.start-toaster-in-browser', async () => { await bitbakeToaster.startInBrowser() }),
    vscode.commands.registerCommand('bitbake.stop-toaster', async () => { await bitbakeToaster.stop() }),
    vscode.commands.registerCommand('bitbake.clear-workspace-state', async () => { await clearAllWorkspaceState(context) }),
    vscode.commands.registerCommand('bitbake.examine-dependency-taskexp', async (uri) => { await examineDependenciesTaskexp(bitbakeWorkspace, bitBakeProjectScanner, uri) }),
    // Handles enqueued parsing requests (onSave)
    vscode.tasks.onDidEndTask((e) => {
      if (e.execution.task.name === 'Bitbake: Parse') {
        if (parsingPending) {
          parsingPending = false
          void parseAllrecipes(bitbakeWorkspace, bitbakeTaskProvider)
        }
      }
    }),
    // Close Toaster on extension shutdown
    {
      dispose: async () => {
        await bitbakeToaster.stopOnShutdown()
      }
    }
  )
}

async function clearAllWorkspaceState (context: vscode.ExtensionContext): Promise<void> {
  for (const key of context.workspaceState.keys()) {
    await context.workspaceState.update(key, undefined).then(
      () => { logger.log(`Cleared state for key: ${key}`) },
      (error) => { logger.error(`Failed to clear state for key: ${key}: ${error}`) }
    )
  }
}

async function ensureBitbakeSettingsSane (bitbakeDriver: BitbakeDriver, focusOnError: boolean): Promise<boolean> {
  if (bitbakeDriver.isBitbakeSettingsSane() || await bitbakeDriver.checkBitbakeSettingsSanity()) {
    return true
  }

  if (focusOnError) {
    await vscode.commands.executeCommand('bitbakeRecipes.focus')
  }

  return false
}

async function parseAllrecipes (bitbakeWorkspace: BitbakeWorkspace, taskProvider: BitbakeTaskProvider): Promise<void> {
  logger.debug('Command: parse-recipes')

  if (!(await ensureBitbakeSettingsSane(taskProvider.bitbakeDriver, true))) {
    logger.warn('bitbake settings are not sane, skip parse')
    return
  }

  if (bitbakeESDKMode) {
    return
  }

  // We have to use tasks instead of BitbakeTerminal because we want the problemMatchers to detect parsing errors
  const parseAllRecipesTask = new vscode.Task(
    { type: 'bitbake', options: { parseOnly: true } },
    vscode.TaskScope.Workspace,
    'Bitbake: Parse',
    'bitbake'
  )
  const runningTasks = vscode.tasks.taskExecutions
  if (runningTasks.some((execution) => execution.task.name === parseAllRecipesTask.name)) {
    logger.debug('Bitbake parsing task is already running')
    parsingPending = true
    return
  }

  await runBitbakeTask(parseAllRecipesTask, taskProvider)
}

async function buildRecipeCommand (bitbakeWorkspace: BitbakeWorkspace, bitBakeProjectScanner: BitBakeProjectScanner, uri?: unknown): Promise<void> {
  const chosenRecipe = await selectRecipe(bitbakeWorkspace, bitBakeProjectScanner, uri)
  if (chosenRecipe !== undefined) {
    logger.debug(`Command: build-recipe: ${chosenRecipe}`)
    await runBitbakeTerminal(
      bitBakeProjectScanner.bitbakeDriver,
      {
        recipes: [chosenRecipe]
      } as BitbakeTaskDefinition,
    `Bitbake: Build: ${chosenRecipe}`)
  }
}

async function cleanRecipeCommand (bitbakeWorkspace: BitbakeWorkspace, bitBakeProjectScanner: BitBakeProjectScanner, uri?: unknown): Promise<void> {
  const chosenRecipe = await selectRecipe(bitbakeWorkspace, bitBakeProjectScanner, uri)
  if (chosenRecipe !== undefined) {
    logger.debug(`Command: clean-recipe: ${chosenRecipe}`)
    await runBitbakeTerminal(
      bitBakeProjectScanner.bitbakeDriver,
      {
        recipes: [chosenRecipe],
        task: 'clean'
      } as BitbakeTaskDefinition,
    `Bitbake: Clean: ${chosenRecipe}`)
  }
}

async function scanEnvironmentCommand (taskProvider: BitbakeTaskProvider): Promise<void> {
  logger.debug('Executing command: scan-global-env')

  if (!(await ensureBitbakeSettingsSane(taskProvider.bitbakeDriver, true))) {
    logger.warn('bitbake settings are not sane, Abort scan')
    return
  }

  if (bitbakeESDKMode) {
    return
  }

  await bitbakeEnvScanner.scanGlobalEnv(taskProvider)
}

async function scanRecipeCommand (bitbakeWorkspace: BitbakeWorkspace, taskProvider: BitbakeTaskProvider, bitBakeProjectScanner: BitBakeProjectScanner, uri?: unknown): Promise<void> {
  const chosenRecipe = await selectRecipe(bitbakeWorkspace, bitBakeProjectScanner, uri, false)

  if (chosenRecipe === undefined) {
    logger.debug('Command: scan-recipe-env: chosen recipe is undefined. Abort command')
    return
  }

  logger.debug('Command: scan-recipe-env')

  if (!(await ensureBitbakeSettingsSane(taskProvider.bitbakeDriver, true))) {
    logger.warn('bitbake settings are not sane, Abort scan')
    return
  }

  if (bitbakeESDKMode) {
    return
  }

  await bitbakeEnvScanner.scanRecipeEnv(chosenRecipe, taskProvider, uri)
}

async function runTaskCommand (bitbakeWorkspace: BitbakeWorkspace, bitBakeProjectScanner: BitBakeProjectScanner, client: LanguageClient, uri?: unknown, task?: unknown): Promise<void> {
  const chosenRecipe = await selectRecipe(bitbakeWorkspace, bitBakeProjectScanner, uri)
  if (chosenRecipe !== undefined) {
    let chosenTask: string | undefined
    if (typeof task === 'string') {
      chosenTask = task
    } else {
      chosenTask = await selectTask(client, chosenRecipe)
    }
    if (chosenTask !== undefined) {
      logger.debug(`Command: run-task: ${chosenRecipe}, ${chosenTask}`)
      await runBitbakeTerminal(bitBakeProjectScanner.bitbakeDriver,
        {
          recipes: [chosenRecipe],
          task: chosenTask
        } as BitbakeTaskDefinition,
      `Bitbake: Task: ${chosenTask}: ${chosenRecipe}`)
    }
  }
}

async function selectTask (client: LanguageClient, recipe: string): Promise<string | undefined> {
  const taskDeps = await getVariableValue(client, '_task_deps', recipe)
  let chosenTask: string | undefined
  if (taskDeps !== undefined) {
    let sanitizedTaskDeps = taskDeps.replace(/'/g, '"')
    // Remove expressions with special characters like \${create_spdx_source_deps(d)}
    sanitizedTaskDeps = sanitizedTaskDeps.replace(/, "\\\${.*?}"/g, '')
    const parsedTaskDeps = JSON.parse(sanitizedTaskDeps)
    /**
     * _task_deps="{'tasks': ['do_patch', ...], 'depends': {...}, ...}"
     */
    if (parsedTaskDeps instanceof Object && Array.isArray(parsedTaskDeps?.tasks)) {
      const quickPickItems = parsedTaskDeps.tasks as string[]
      logger.debug(`quickPickItems: ${JSON.stringify(parsedTaskDeps.tasks)}`)
      chosenTask = await vscode.window.showQuickPick(quickPickItems, { placeHolder: 'Select a task' })
    }
  } else {
    chosenTask = await vscode.window.showInputBox({ placeHolder: 'Enter the Bitbake task to run (bitbake -c)' })
  }
  return sanitizeForShell(chosenTask)
}

async function dropRecipe (bitbakeWorkspace: BitbakeWorkspace, bitBakeProjectScanner: BitBakeProjectScanner, uri?: string): Promise<void> {
  const chosenRecipe = await selectRecipe(bitbakeWorkspace, bitBakeProjectScanner, uri, false)
  if (chosenRecipe !== undefined) {
    await bitbakeWorkspace.dropActiveRecipe(chosenRecipe)
  }
}

async function dropAllRecipes (bitbakeWorkspace: BitbakeWorkspace): Promise<void> {
  await bitbakeWorkspace.dropAllActiveRecipes()
}

export async function runBitbakeTask (task: vscode.Task, taskProvider: vscode.TaskProvider): Promise<void> {
  let resolvedTask = taskProvider.resolveTask(task, new vscode.CancellationTokenSource().token)
  if (resolvedTask instanceof Promise) {
    resolvedTask = await resolvedTask
  }
  if (resolvedTask instanceof vscode.Task) {
    await vscode.tasks.executeTask(resolvedTask)
  } else {
    throw new Error(`Failed to resolve task for recipe ${task.definition.recipes[0]}`)
  }
}

async function rescanProject (bitBakeProjectScanner: BitBakeProjectScanner, focusOnError: boolean): Promise<void> {
  if (!(await ensureBitbakeSettingsSane(bitBakeProjectScanner.bitbakeDriver, focusOnError))) {
    logger.warn('bitbake settings are not sane, skip rescan')
    return
  }

  await bitBakeProjectScanner.rescanProject()
}

// Exported for testing
async function openRecipeWorkdirCommand (bitbakeWorkspace: BitbakeWorkspace, bitBakeProjectScanner: BitBakeProjectScanner, client: LanguageClient, uri?: unknown): Promise<void> {
  const chosenRecipe = await selectRecipe(bitbakeWorkspace, bitBakeProjectScanner, uri)
  if (chosenRecipe === undefined) { return }

  logger.debug(`Command: open-recipe-workdir: ${chosenRecipe}`)
  let recipeWorkdir = await getVariableValue(client, 'WORKDIR', chosenRecipe, true)
  if (recipeWorkdir === undefined) {
    await vscode.window.showErrorMessage(`Could not get WORKDIR value for ${chosenRecipe}`)
  }

  // These results are guaranteed to be defined if recipeWorkdir is defined
  recipeWorkdir = await bitBakeProjectScanner.resolveContainerPath(recipeWorkdir, true) as string
  if (!fs.existsSync(recipeWorkdir)) {
    await vscode.window.showErrorMessage(`WORKDIR for ${chosenRecipe} was not found. Make sure you have built the recipe.`,
      { modal: true, detail: `${recipeWorkdir} does not exist` })
    return
  }
  const recipeWorkdirURI = vscode.Uri.file(recipeWorkdir)
  await vscode.commands.executeCommand('vscode.openFolder', recipeWorkdirURI, { forceNewWindow: true })
}

export let isTaskexpStarted = false

export async function examineDependenciesTaskexp (bitbakeWorkspace: BitbakeWorkspace, bitBakeProjectScanner: BitBakeProjectScanner, uri?: unknown): Promise<void> {
  if (isTaskexpStarted) {
    void vscode.window.showInformationMessage('taskexp is already started')
    return
  }
  const chosenRecipe = await selectRecipe(bitbakeWorkspace, bitBakeProjectScanner, uri)
  if (chosenRecipe !== undefined) {
    logger.debug(`Command: examine-dependency-taskexp: ${chosenRecipe}`)
    isTaskexpStarted = true
    const process = await runBitbakeTerminal(bitBakeProjectScanner.bitbakeDriver,
      {
        specialCommand: `bitbake -g ${chosenRecipe} -u taskexp`
      } as BitbakeTaskDefinition,
    `Bitbake: taskexp: ${chosenRecipe}`)
    process.onExit((e) => {
      isTaskexpStarted = false
      if (e.exitCode !== 0) {
        void vscode.window.showErrorMessage(`Failed to start taskexp with exit code ${e.exitCode}. See terminal output.`)
      }
    })
  }
}

async function openBitbakeDevshell (terminalProvider: BitbakeTerminalProfileProvider, bitbakeWorkspace: BitbakeWorkspace, bitBakeProjectScanner: BitBakeProjectScanner, uri?: unknown): Promise<vscode.Terminal | undefined> {
  const chosenRecipe = await selectRecipe(bitbakeWorkspace, bitBakeProjectScanner, uri)
  if (chosenRecipe === undefined) return
  console.log(`Command: recipe-devshell: ${chosenRecipe}`)

  const terminal = await openBitbakeTerminalProfile(terminalProvider)
  const command = bitBakeProjectScanner.bitbakeDriver.composeDevshellCommand(chosenRecipe)
  terminal.sendText(command + ' && exit')

  return terminal
}

async function collapseActiveList (): Promise<void> {
  await vscode.commands.executeCommand('list.collapseAll')
}
