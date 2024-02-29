/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

/// This files contains the VSCode commands exposed by the extension

import * as vscode from 'vscode'
import fs from 'fs'

import { logger } from '../lib/src/utils/OutputLogger'
import { type BitbakeWorkspace } from './BitbakeWorkspace'
import path from 'path'
import { BitbakeRecipeTreeItem } from './BitbakeRecipesView'
import { type BitBakeProjectScanner } from '../driver/BitBakeProjectScanner'
import { extractRecipeName } from '../lib/src/utils/files'
import { runBitbakeTerminal, runBitbakeTerminalCustomCommand } from './BitbakeTerminal'
import { type BitbakeDriver } from '../driver/BitbakeDriver'
import { sanitizeForShell } from '../lib/src/BitbakeSettings'
import { type BitbakeTaskDefinition, type BitbakeTaskProvider } from './BitbakeTaskProvider'
import { type LayerInfo } from '../lib/src/types/BitbakeScanResult'
import { DevtoolWorkspaceTreeItem } from './DevtoolWorkspacesView'
import { type SpawnSyncReturns } from 'child_process'
import { clientNotificationManager } from './ClientNotificationManager'
import { bitbakeESDKMode, configureDevtoolSDKFallback } from '../driver/BitbakeESDK'
import bitbakeRecipeScanner from '../driver/BitbakeRecipeScanner'
import { type BitbakeTerminalProfileProvider, openBitbakeTerminalProfile } from './BitbakeTerminalProfile'
import { mergeArraysDistinctly } from '../lib/src/utils/arrays'
import { finishProcessExecution } from '../utils/ProcessUtils'
import { type LanguageClient } from 'vscode-languageclient/node'
import { getVariableValue } from '../language/languageClient'

let parsingPending = false
let bitbakeSanity = false

export function registerBitbakeCommands (context: vscode.ExtensionContext, bitbakeWorkspace: BitbakeWorkspace, bitbakeTaskProvider: BitbakeTaskProvider, bitBakeProjectScanner: BitBakeProjectScanner, bitbakeTerminalProfileProvider: BitbakeTerminalProfileProvider, client: LanguageClient): void {
  context.subscriptions.push(vscode.commands.registerCommand('bitbake.parse-recipes', async () => { await parseAllrecipes(bitbakeWorkspace, bitbakeTaskProvider) }))
  context.subscriptions.push(vscode.commands.registerCommand('bitbake.build-recipe', async (uri) => { await buildRecipeCommand(bitbakeWorkspace, bitBakeProjectScanner, uri) }))
  context.subscriptions.push(vscode.commands.registerCommand('bitbake.clean-recipe', async (uri) => { await cleanRecipeCommand(bitbakeWorkspace, bitBakeProjectScanner, uri) }))
  context.subscriptions.push(vscode.commands.registerCommand('bitbake.scan-recipe-env', async (uri) => { await scanRecipeCommand(bitbakeWorkspace, bitbakeTaskProvider, bitBakeProjectScanner, uri) }))
  context.subscriptions.push(vscode.commands.registerCommand('bitbake.run-task', async (uri, task) => { await runTaskCommand(bitbakeWorkspace, bitBakeProjectScanner, client, uri, task) }))
  context.subscriptions.push(vscode.commands.registerCommand('bitbake.drop-recipe', async (uri) => { await dropRecipe(bitbakeWorkspace, bitBakeProjectScanner, uri) }))
  context.subscriptions.push(vscode.commands.registerCommand('bitbake.drop-all-recipes', async () => { await dropAllRecipes(bitbakeWorkspace) }))
  context.subscriptions.push(vscode.commands.registerCommand('bitbake.watch-recipe', async (recipe) => { await addActiveRecipe(bitbakeWorkspace, bitBakeProjectScanner, recipe) }))
  context.subscriptions.push(vscode.commands.registerCommand('bitbake.rescan-project', async () => { await rescanProject(bitBakeProjectScanner) }))
  context.subscriptions.push(vscode.commands.registerCommand('bitbake.terminal-profile', async () => { await openBitbakeTerminalProfile(bitbakeTerminalProfileProvider) }))
  context.subscriptions.push(vscode.commands.registerCommand('bitbake.open-recipe-workdir', async (uri) => { await openRecipeWorkdirCommand(bitbakeWorkspace, bitBakeProjectScanner, client, uri) }))
  context.subscriptions.push(vscode.commands.registerCommand('bitbake.recipe-devshell', async (uri) => { await openBitbakeDevshell(bitbakeTerminalProfileProvider, bitbakeWorkspace, bitBakeProjectScanner, uri) }))
  context.subscriptions.push(vscode.commands.registerCommand('bitbake.collapse-list', async () => { await collapseActiveList() }))

  // Handles enqueued parsing requests (onSave)
  context.subscriptions.push(
    vscode.tasks.onDidEndTask((e) => {
      if (e.execution.task.name === 'Bitbake: Parse') {
        if (parsingPending) {
          parsingPending = false
          void parseAllrecipes(bitbakeWorkspace, bitbakeTaskProvider)
        }
      }
    })
  )
}

export function registerDevtoolCommands (context: vscode.ExtensionContext, bitbakeWorkspace: BitbakeWorkspace, bitBakeProjectScanner: BitBakeProjectScanner): void {
  context.subscriptions.push(vscode.commands.registerCommand('bitbake.devtool-modify', async (uri) => { await devtoolModifyCommand(bitbakeWorkspace, bitBakeProjectScanner, uri) }))
  context.subscriptions.push(vscode.commands.registerCommand('bitbake.devtool-update', async (uri) => { await devtoolUpdateCommand(bitbakeWorkspace, bitBakeProjectScanner, uri) }))
  context.subscriptions.push(vscode.commands.registerCommand('bitbake.devtool-reset', async (uri) => { await devtoolResetCommand(bitbakeWorkspace, bitBakeProjectScanner, uri) }))
  context.subscriptions.push(vscode.commands.registerCommand('bitbake.devtool-open-workspace', async (uri) => { await devtoolOpenWorkspaceCommand(bitbakeWorkspace, bitBakeProjectScanner, uri) }))
  context.subscriptions.push(vscode.commands.registerCommand('bitbake.devtool-ide-sdk', async (uri) => { await devtoolIdeSDKCommand(bitbakeWorkspace, bitBakeProjectScanner, uri) }))
  context.subscriptions.push(vscode.commands.registerCommand('bitbake.devtool-sdk-fallback', async (uri) => { await devtoolSDKFallbackCommand(bitbakeWorkspace, bitBakeProjectScanner, uri) }))
  context.subscriptions.push(vscode.commands.registerCommand('bitbake.devtool-build', async (uri) => { await devtoolBuildCommand(bitbakeWorkspace, bitBakeProjectScanner, uri) }))
  context.subscriptions.push(vscode.commands.registerCommand('bitbake.devtool-deploy', async (uri) => { await devtoolDeployCommand(bitbakeWorkspace, bitBakeProjectScanner, uri) }))
  context.subscriptions.push(vscode.commands.registerCommand('bitbake.devtool-clean', async (uri) => { await devtoolCleanCommand(bitbakeWorkspace, bitBakeProjectScanner, uri) }))
}

async function parseAllrecipes (bitbakeWorkspace: BitbakeWorkspace, taskProvider: BitbakeTaskProvider): Promise<void> {
  logger.debug('Command: parse-recipes')

  if (!bitbakeSanity && !(await taskProvider.bitbakeDriver?.checkBitbakeSettingsSanity())) {
    logger.warn('bitbake settings are not sane, skip parse')
    return
  }
  bitbakeSanity = true

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

  // Temporarily disable task.saveBeforeRun
  // This request happens on bitbake document save. We don't want to save all files when any bitbake file is saved.
  const saveBeforeRun = await vscode.workspace.getConfiguration('task').get('saveBeforeRun')
  await vscode.workspace.getConfiguration('task').update('saveBeforeRun', 'never', undefined, true)
  await runBitbakeTask(parseAllRecipesTask, taskProvider)
  await vscode.workspace.getConfiguration('task').update('saveBeforeRun', saveBeforeRun, undefined, true)
}

async function buildRecipeCommand (bitbakeWorkspace: BitbakeWorkspace, bitBakeProjectScanner: BitBakeProjectScanner, uri?: any): Promise<void> {
  const chosenRecipe = await selectRecipe(bitbakeWorkspace, bitBakeProjectScanner, uri)
  if (chosenRecipe !== undefined) {
    logger.debug(`Command: build-recipe: ${chosenRecipe}`)
    await runBitbakeTerminal(
      bitBakeProjectScanner.bitbakeDriver,
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      {
        recipes: [chosenRecipe]
      } as BitbakeTaskDefinition,
    `Bitbake: Build: ${chosenRecipe}`)
  }
}

async function cleanRecipeCommand (bitbakeWorkspace: BitbakeWorkspace, bitBakeProjectScanner: BitBakeProjectScanner, uri?: any): Promise<void> {
  const chosenRecipe = await selectRecipe(bitbakeWorkspace, bitBakeProjectScanner, uri)
  if (chosenRecipe !== undefined) {
    logger.debug(`Command: clean-recipe: ${chosenRecipe}`)
    await runBitbakeTerminal(
      bitBakeProjectScanner.bitbakeDriver,
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      {
        recipes: [chosenRecipe],
        task: 'clean'
      } as BitbakeTaskDefinition,
    `Bitbake: Clean: ${chosenRecipe}`)
  }
}

async function scanRecipeCommand (bitbakeWorkspace: BitbakeWorkspace, taskProvider: BitbakeTaskProvider, bitBakeProjectScanner: BitBakeProjectScanner, uri?: any): Promise<void> {
  const chosenRecipe = await selectRecipe(bitbakeWorkspace, bitBakeProjectScanner, uri, false)

  if (chosenRecipe === undefined) {
    logger.debug('Command: scan-recipe-env: chosen recipe is undefined. Abort command')
    return
  }

  logger.debug('Command: scan-recipe-env')

  if (!bitbakeSanity && !(await taskProvider.bitbakeDriver?.checkBitbakeSettingsSanity())) {
    logger.warn('bitbake settings are not sane, Abort scan')
    return
  }

  bitbakeSanity = true

  if (bitbakeESDKMode) {
    return
  }

  // Temporarily disable task.saveBeforeRun
  // This request happens on bitbake document save. We don't want to save all files when any bitbake file is saved.
  const saveBeforeRun = await vscode.workspace.getConfiguration('task').get('saveBeforeRun')
  await vscode.workspace.getConfiguration('task').update('saveBeforeRun', 'never', undefined, true)
  await bitbakeRecipeScanner.scan(chosenRecipe, taskProvider, uri)
  await vscode.workspace.getConfiguration('task').update('saveBeforeRun', saveBeforeRun, undefined, true)
}

async function runTaskCommand (bitbakeWorkspace: BitbakeWorkspace, bitBakeProjectScanner: BitBakeProjectScanner, client: LanguageClient, uri?: any, task?: any): Promise<void> {
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
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
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
    const parsedTaskDeps = JSON.parse(taskDeps.replace(/'/g, '"'))
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

async function selectRecipe (bitbakeWorkspace: BitbakeWorkspace, bitBakeProjectScanner: BitBakeProjectScanner, uri?: any, canAdd: boolean = true): Promise<string | undefined> {
  let chosenRecipe: string | undefined
  // A string is provided when the command is called programmatically in tests with an argument
  if (typeof uri === 'string') {
    return uri
  }
  if (uri instanceof BitbakeRecipeTreeItem) {
    return uri.label
  }
  if (uri instanceof DevtoolWorkspaceTreeItem) {
    return uri.label as string
  }
  // A vscode.Uri is provided when the command is called through the explorer/editor context menus of a file
  if (uri instanceof vscode.Uri) {
    const extension = path.extname(uri.fsPath)
    if (['.bb', '.bbappend', '.inc'].includes(extension)) {
      chosenRecipe = extractRecipeName(uri.fsPath)
      if (canAdd) await bitbakeWorkspace.addActiveRecipe(chosenRecipe)
    }
  }
  // No recipe is provided when calling the command through the command pallette
  if (chosenRecipe === undefined) {
    const devtoolWorkspacesNames = bitBakeProjectScanner.scanResult._workspaces.map((workspace) => workspace.name)
    const quickPickItems = mergeArraysDistinctly(
      (name) => name,
      bitbakeWorkspace.activeRecipes,
      devtoolWorkspacesNames)

    if (canAdd || bitbakeWorkspace.activeRecipes.length === 0) {
      quickPickItems.push('Add another recipe...')
    }

    chosenRecipe = await vscode.window.showQuickPick(quickPickItems, { placeHolder: 'Select bitbake recipe' })

    if (chosenRecipe === 'Add another recipe...') {
      chosenRecipe = await addActiveRecipe(bitbakeWorkspace, bitBakeProjectScanner)
    }
  }
  return chosenRecipe
}

async function addActiveRecipe (bitbakeWorkspace: BitbakeWorkspace, bitBakeProjectScanner: BitBakeProjectScanner, recipe?: string): Promise<string | undefined> {
  if (typeof recipe === 'string') {
    await bitbakeWorkspace.addActiveRecipe(recipe)
    return recipe
  }

  const recipeNames = bitBakeProjectScanner.scanResult._recipes.map((recipe) => recipe.name)
  let chosenRecipe: string | undefined
  if (recipeNames.length !== 0) {
    chosenRecipe = await vscode.window.showQuickPick(recipeNames, { placeHolder: 'Select recipe to add' })
  } else {
    chosenRecipe = await vscode.window.showInputBox({ placeHolder: "Type the recipe's name to add. (Bitbake scan not complete yet)" })
  }
  if (chosenRecipe !== undefined) {
    chosenRecipe = sanitizeForShell(extractRecipeName(chosenRecipe)) as string
    await bitbakeWorkspace.addActiveRecipe(chosenRecipe)
  }

  return chosenRecipe
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

async function rescanProject (bitBakeProjectScanner: BitBakeProjectScanner): Promise<void> {
  bitbakeSanity = false
  if (!(await bitBakeProjectScanner.bitbakeDriver?.checkBitbakeSettingsSanity())) {
    logger.warn('bitbake settings are not sane, skip rescan')
    return
  }
  bitbakeSanity = true

  await bitBakeProjectScanner.rescanProject()
}

async function devtoolModifyCommand (bitbakeWorkspace: BitbakeWorkspace, bitBakeProjectScanner: BitBakeProjectScanner, uri?: any): Promise<void> {
  const chosenRecipe = await selectRecipe(bitbakeWorkspace, bitBakeProjectScanner, uri)
  if (chosenRecipe !== undefined) {
    logger.debug(`Command: devtool-modify: ${chosenRecipe}`)
    const command = `devtool modify ${chosenRecipe}`
    const process = await runBitbakeTerminalCustomCommand(bitBakeProjectScanner.bitbakeDriver, command, `Bitbake: Devtool Modify: ${chosenRecipe}`)
    process.onExit((event) => {
      if (event.exitCode === 0) {
        void bitBakeProjectScanner.rescanDevtoolWorkspaces().then(() => {
          // Running devtool-ide-sdk is very slow. Users may not want to start it all the time so we suggest it here.
          // For instance, if they only need to make a quick patch to a recipe, they may not want to wait for the SDK to be built.
          clientNotificationManager.showSDKSuggestion(chosenRecipe)
          void bitBakeProjectScanner.rescanProject()
        })
      }
    })
  }
}

async function devtoolSDKFallbackCommand (bitbakeWorkspace: BitbakeWorkspace, bitBakeProjectScanner: BitBakeProjectScanner, uri?: any): Promise<void> {
  const chosenRecipe = await selectRecipe(bitbakeWorkspace, bitBakeProjectScanner, uri)
  if (chosenRecipe !== undefined) {
    logger.debug(`Command: devtool-sdk-fallback: ${chosenRecipe}`)
    const workspace = bitBakeProjectScanner.scanResult._workspaces.find((workspace) => workspace.name === chosenRecipe)
    if (workspace === undefined) throw new Error('Devtool Workspace not found')
    configureDevtoolSDKFallback(workspace, bitBakeProjectScanner.bitbakeDriver.bitbakeSettings, bitBakeProjectScanner.bitbakeDriver.activeBuildConfiguration)
  }
}

async function devtoolIdeSDKCommand (bitbakeWorkspace: BitbakeWorkspace, bitBakeProjectScanner: BitBakeProjectScanner, uri?: any): Promise<void> {
  const chosenRecipe = await selectRecipe(bitbakeWorkspace, bitBakeProjectScanner, uri)
  const bitbakeDriver = bitBakeProjectScanner.bitbakeDriver
  if (chosenRecipe !== undefined) {
    logger.debug(`Command: devtool-ide-sdk: ${chosenRecipe}`)
    if (!checkIdeSdkConfiguration(bitbakeDriver)) {
      clientNotificationManager.showSDKConfigurationError()
      return
    }
    if (!await checkIdeSdkAvailable(bitbakeDriver)) {
      clientNotificationManager.showSDKUnavailableError(chosenRecipe)
      return
    }
    const command = bitbakeDriver.composeDevtoolIDECommand(chosenRecipe)
    await runBitbakeTerminalCustomCommand(bitbakeDriver, command, `Bitbake: Devtool ide-sdk: ${chosenRecipe}`)
  }
}

async function checkIdeSdkAvailable (bitbakeDriver: BitbakeDriver): Promise<boolean> {
  const command = "devtool --help | grep 'ide-sdk'"
  const process = runBitbakeTerminalCustomCommand(bitbakeDriver, command, 'Bitbake: Devtool ide-sdk: check')
  const res = await finishProcessExecution(process)
  return res.status === 0
}

function checkIdeSdkConfiguration (bitbakeDriver: BitbakeDriver): boolean {
  const sdkImage = bitbakeDriver.bitbakeSettings.sdkImage
  return sdkImage !== undefined && sdkImage !== ''
}

async function pickLayer (extraOption: string, bitBakeProjectScanner: BitBakeProjectScanner): Promise<LayerInfo | undefined> {
  const layers = bitBakeProjectScanner.scanResult._layers
  const chosenLayer = await vscode.window.showQuickPick([...layers.map(layer => layer.name), extraOption], { placeHolder: 'Choose target BitBake layer' })
  if (chosenLayer === undefined) { return }

  if (chosenLayer === extraOption) {
    return { name: extraOption, path: '', priority: 0 }
  } else {
    return layers.find(layer => layer.name === chosenLayer)
  }
}

async function devtoolUpdateCommand (bitbakeWorkspace: BitbakeWorkspace, bitBakeProjectScanner: BitBakeProjectScanner, uri?: any): Promise<void> {
  const originalRecipeChoice = 'Update the original recipe'
  const chosenRecipe = await selectRecipe(bitbakeWorkspace, bitBakeProjectScanner, uri)
  if (chosenRecipe === undefined) { return }
  const chosenLayer = await pickLayer(originalRecipeChoice, bitBakeProjectScanner)
  if (chosenLayer === undefined) { return }
  const chosenLayerPath = await bitBakeProjectScanner.resolveHostPath(chosenLayer?.path)
  let command = ''

  if (chosenLayer?.name === originalRecipeChoice) {
    command = `devtool update-recipe ${chosenRecipe}`
  } else {
    command = `devtool update-recipe ${chosenRecipe} --append ${chosenLayerPath}`
  }

  logger.debug(`Command: devtool-update: ${chosenRecipe}`)
  const process = runBitbakeTerminalCustomCommand(bitBakeProjectScanner.bitbakeDriver, command, `Bitbake: Devtool Update: ${chosenRecipe}`)
  const res = await finishProcessExecution(process, async () => { await bitBakeProjectScanner.bitbakeDriver.killBitbake() })
  if (res.status === 0 && chosenLayer?.name !== originalRecipeChoice) {
    await openDevtoolUpdateBBAppend(res, bitBakeProjectScanner)
    void bitBakeProjectScanner.rescanProject()
  }
}

async function openDevtoolUpdateBBAppend (res: SpawnSyncReturns<Buffer>, bitBakeProjectScanner: BitBakeProjectScanner): Promise<void> {
  const output = res.stdout.toString()
  // Regex to extract path from: NOTE: Writing append file .../meta-poky/recipes-core/busybox/busybox_1.36.1.bbappend
  const regex = /Writing append file ([\w/._-]+)/g
  const match = regex.exec(output)
  if (match === null) {
    logger.error('Could not find bbappend file')
    return
  }
  let bbappendPath = match[1]
  bbappendPath = await bitBakeProjectScanner.resolveContainerPath(bbappendPath) as string
  const bbappendUri = vscode.Uri.file(bbappendPath)
  logger.debug(`Opening devtool-update-recipe bbappend file: ${bbappendPath}`)
  await vscode.commands.executeCommand('vscode.open', bbappendUri)
}

async function devtoolResetCommand (bitbakeWorkspace: BitbakeWorkspace, bitBakeProjectScanner: BitBakeProjectScanner, uri?: any): Promise<void> {
  const chosenRecipe = await selectRecipe(bitbakeWorkspace, bitBakeProjectScanner, uri)
  if (chosenRecipe !== undefined) {
    logger.debug(`Command: devtool-reset: ${chosenRecipe}`)
    const command = `devtool reset ${chosenRecipe}`
    const process = await runBitbakeTerminalCustomCommand(bitBakeProjectScanner.bitbakeDriver, command, `Bitbake: Devtool Reset: ${chosenRecipe}`)
    process.onExit((event) => {
      if (event.exitCode === 0) {
        void bitBakeProjectScanner.rescanDevtoolWorkspaces().then(() => {
          void bitBakeProjectScanner.rescanProject()
        })
      }
    })
  }
}

async function devtoolOpenWorkspaceCommand (bitbakeWorkspace: BitbakeWorkspace, bitBakeProjectScanner: BitBakeProjectScanner, uri?: any): Promise<void> {
  const chosenRecipe = await selectRecipe(bitbakeWorkspace, bitBakeProjectScanner, uri)
  if (chosenRecipe === undefined) { return }
  if (bitBakeProjectScanner.bitbakeDriver === undefined) { throw new Error('bitbakeDriver is undefined') }

  if (bitBakeProjectScanner.scanResult._workspaces.find((workspace) => workspace.name === chosenRecipe) === undefined) {
    await devtoolModifyCommand(bitbakeWorkspace, bitBakeProjectScanner, chosenRecipe)
  }

  logger.debug(`Command: devtool-open-workspace: ${chosenRecipe}`)
  let workspacePath = bitBakeProjectScanner.scanResult._workspaces.find((workspace) => workspace.name === chosenRecipe)?.path
  workspacePath = await bitBakeProjectScanner.resolveContainerPath(workspacePath)
  if (workspacePath === undefined) {
    logger.error('Devtool workspace not found')
    return
  }
  await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(workspacePath), { forceNewWindow: true })
}

async function openRecipeWorkdirCommand (bitbakeWorkspace: BitbakeWorkspace, bitBakeProjectScanner: BitBakeProjectScanner, client: LanguageClient, uri?: any): Promise<void> {
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

async function openBitbakeDevshell (terminalProvider: BitbakeTerminalProfileProvider, bitbakeWorkspace: BitbakeWorkspace, bitBakeProjectScanner: BitBakeProjectScanner, uri?: any): Promise<vscode.Terminal | undefined> {
  const chosenRecipe = await selectRecipe(bitbakeWorkspace, bitBakeProjectScanner, uri)
  if (chosenRecipe === undefined) return
  console.log(`Command: recipe-devshell: ${chosenRecipe}`)

  const terminal = await openBitbakeTerminalProfile(terminalProvider)
  const command = bitBakeProjectScanner.bitbakeDriver.composeDevshellCommand(chosenRecipe)
  terminal.sendText(command + ' && exit')

  return terminal
}

async function devtoolBuildCommand (bitbakeWorkspace: BitbakeWorkspace, bitBakeProjectScanner: BitBakeProjectScanner, uri?: any): Promise<void> {
  const chosenRecipe = await selectRecipe(bitbakeWorkspace, bitBakeProjectScanner, uri)
  if (chosenRecipe !== undefined) {
    logger.debug(`Command: devtool-build: ${chosenRecipe}`)
    await runBitbakeTerminal(
      bitBakeProjectScanner.bitbakeDriver,
      {
        specialCommand: `devtool build ${chosenRecipe}`,
        type: 'bitbake'
      } satisfies BitbakeTaskDefinition,
    `Bitbake: Devtool Build: ${chosenRecipe}`)
  }
}

async function devtoolDeployCommand (bitbakeWorkspace: BitbakeWorkspace, bitBakeProjectScanner: BitBakeProjectScanner, uri?: any): Promise<void> {
  const chosenRecipe = await selectRecipe(bitbakeWorkspace, bitBakeProjectScanner, uri)
  const bitbakeDriver = bitBakeProjectScanner.bitbakeDriver
  if (chosenRecipe !== undefined) {
    logger.debug(`Command: devtool-deploy: ${chosenRecipe}`)
    const sshTarget = bitbakeDriver.bitbakeSettings.sshTarget
    if (sshTarget === undefined || sshTarget === '') {
      clientNotificationManager.showSDKConfigurationError()
      return
    }
    await runBitbakeTerminal(
      bitbakeDriver,
      {
        specialCommand: `devtool deploy-target ${chosenRecipe} ${sshTarget}`,
        type: 'bitbake'
      } satisfies BitbakeTaskDefinition,
    `Bitbake: Devtool Deploy: ${chosenRecipe}`)
  }
}

async function devtoolCleanCommand (bitbakeWorkspace: BitbakeWorkspace, bitBakeProjectScanner: BitBakeProjectScanner, uri?: any): Promise<void> {
  const chosenRecipe = await selectRecipe(bitbakeWorkspace, bitBakeProjectScanner, uri)
  if (chosenRecipe !== undefined) {
    logger.debug(`Command: devtool-clean: ${chosenRecipe}`)
    await runBitbakeTerminal(
      bitBakeProjectScanner.bitbakeDriver,
      {
        specialCommand: `devtool build -c ${chosenRecipe}`,
        type: 'bitbake'
      } satisfies BitbakeTaskDefinition,
    `Bitbake: Devtool Clean: ${chosenRecipe}`)
  }
}

async function collapseActiveList (): Promise<void> {
  await vscode.commands.executeCommand('list.collapseAll')
}
