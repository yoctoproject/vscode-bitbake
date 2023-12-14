/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

/// This files contains the VSCode commands exposed by the extension

import * as vscode from 'vscode'

import { logger } from '../lib/src/utils/OutputLogger'
import { type BitbakeWorkspace } from './BitbakeWorkspace'
import path from 'path'
import { BitbakeRecipeTreeItem } from './BitbakeRecipesView'
import { type BitBakeProjectScanner, bitBakeProjectScanner } from '../driver/BitBakeProjectScanner'
import { extractRecipeName } from '../lib/src/utils/files'
import { runBitbakeTerminal, runBitbakeTerminalCustomCommand } from './BitbakeTerminal'
import { type BitbakeDriver } from '../driver/BitbakeDriver'
import { sanitizeForShell } from '../lib/src/BitbakeSettings'
import { type BitbakeTaskDefinition, type BitbakeTaskProvider } from './BitbakeTaskProvider'
import { type LayerInfo } from '../lib/src/types/BitbakeScanResult'
import { DevtoolWorkspaceTreeItem } from './DevtoolWorkspacesView'

let parsingPending = false

export function registerBitbakeCommands (context: vscode.ExtensionContext, bitbakeWorkspace: BitbakeWorkspace, bitbakeTaskProvider: BitbakeTaskProvider, bitbakeProjectScanner: BitBakeProjectScanner): void {
  context.subscriptions.push(vscode.commands.registerCommand('bitbake.parse-recipes', async () => { await parseAllrecipes(bitbakeWorkspace, bitbakeTaskProvider) }))
  context.subscriptions.push(vscode.commands.registerCommand('bitbake.build-recipe', async (uri) => { await buildRecipeCommand(bitbakeWorkspace, bitbakeTaskProvider.bitbakeDriver, uri) }))
  context.subscriptions.push(vscode.commands.registerCommand('bitbake.clean-recipe', async (uri) => { await cleanRecipeCommand(bitbakeWorkspace, bitbakeTaskProvider.bitbakeDriver, uri) }))
  context.subscriptions.push(vscode.commands.registerCommand('bitbake.run-task', async (uri, task) => { await runTaskCommand(bitbakeWorkspace, bitbakeTaskProvider.bitbakeDriver, uri, task) }))
  context.subscriptions.push(vscode.commands.registerCommand('bitbake.drop-recipe', async (uri) => { await dropRecipe(bitbakeWorkspace, uri) }))
  context.subscriptions.push(vscode.commands.registerCommand('bitbake.watch-recipe', async (recipe) => { await addActiveRecipe(bitbakeWorkspace, recipe) }))
  context.subscriptions.push(vscode.commands.registerCommand('bitbake.rescan-project', async () => { await rescanProject(bitbakeProjectScanner) }))

  // Handles enqueued parsing requests (onSave)
  context.subscriptions.push(
    vscode.tasks.onDidEndTask((e) => {
      if (e.execution.task.name === 'Bitbake: Parse') {
        if (parsingPending) {
          parsingPending = false
          void parseAllrecipes(bitbakeWorkspace, bitbakeTaskProvider)
        }
      }
    }))
}

export function registerDevtoolCommands (context: vscode.ExtensionContext, bitbakeWorkspace: BitbakeWorkspace, bitbakeDriver: BitbakeDriver): void {
  context.subscriptions.push(vscode.commands.registerCommand('bitbake.devtool-modify', async (uri) => { await devtoolModifyCommand(bitbakeWorkspace, bitbakeDriver, uri) }))
  context.subscriptions.push(vscode.commands.registerCommand('bitbake.devtool-update', async (uri) => { await devtoolUpdateCommand(bitbakeWorkspace, bitbakeDriver, uri) }))
  context.subscriptions.push(vscode.commands.registerCommand('bitbake.devtool-reset', async (uri) => { await devtoolResetCommand(bitbakeWorkspace, bitbakeDriver, uri) }))
  context.subscriptions.push(vscode.commands.registerCommand('bitbake.devtool-open-workspace', async (uri) => { await devtoolOpenWorkspaceCommand(bitbakeWorkspace, bitBakeProjectScanner, uri) }))
}

async function parseAllrecipes (bitbakeWorkspace: BitbakeWorkspace, taskProvider: BitbakeTaskProvider): Promise<void> {
  logger.debug('Command: parse-recipes')

  if (!(await taskProvider.bitbakeDriver?.checkBitbakeSettingsSanity())) {
    logger.warn('bitbake settings are not sane, skip parse')
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

async function buildRecipeCommand (bitbakeWorkspace: BitbakeWorkspace, bitbakeDriver: BitbakeDriver, uri?: any): Promise<void> {
  const chosenRecipe = await selectRecipe(bitbakeWorkspace, uri)
  if (chosenRecipe !== undefined) {
    logger.debug(`Command: build-recipe: ${chosenRecipe}`)
    await runBitbakeTerminal(
      bitbakeDriver,
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      {
        recipes: [chosenRecipe]
      } as BitbakeTaskDefinition,
    `Bitbake: Build: ${chosenRecipe}`)
  }
}

async function cleanRecipeCommand (bitbakeWorkspace: BitbakeWorkspace, bitbakeDriver: BitbakeDriver, uri?: any): Promise<void> {
  const chosenRecipe = await selectRecipe(bitbakeWorkspace, uri)
  if (chosenRecipe !== undefined) {
    logger.debug(`Command: clean-recipe: ${chosenRecipe}`)
    await runBitbakeTerminal(
      bitbakeDriver,
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      {
        recipes: [chosenRecipe],
        task: 'clean'
      } as BitbakeTaskDefinition,
    `Bitbake: Clean: ${chosenRecipe}`)
  }
}

async function runTaskCommand (bitbakeWorkspace: BitbakeWorkspace, bitbakeDriver: BitbakeDriver, uri?: any, task?: any): Promise<void> {
  const chosenRecipe = await selectRecipe(bitbakeWorkspace, uri)
  if (chosenRecipe !== undefined) {
    let chosenTask: string | undefined
    if (typeof task === 'string') {
      chosenTask = task
    } else {
      chosenTask = await selectTask()
    }
    if (chosenTask !== undefined) {
      logger.debug(`Command: run-task: ${chosenRecipe}, ${chosenTask}`)
      await runBitbakeTerminal(bitbakeDriver,
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        {
          recipes: [chosenRecipe],
          task: chosenTask
        } as BitbakeTaskDefinition,
      `Bitbake: Task: ${chosenTask}: ${chosenRecipe}`)
    }
  }
}

async function selectTask (): Promise<string | undefined> {
  const chosenTask = await vscode.window.showInputBox({ placeHolder: 'Bitbake task to run (bitbake -c)' })
  return sanitizeForShell(chosenTask)
}

async function selectRecipe (bitbakeWorkspace: BitbakeWorkspace, uri?: any, canCreate: boolean = true): Promise<string | undefined> {
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
  // A vscode.Uri is provided when the command is called through the context menu of a .bb file
  if (uri !== undefined) {
    const extension = path.extname(uri.fsPath)
    if (['.bb', '.bbappend', '.inc'].includes(extension)) {
      chosenRecipe = extractRecipeName(uri.fsPath) as string
      bitbakeWorkspace.addActiveRecipe(chosenRecipe)
    }
  }
  // No recipe is provided when calling the command through the command pallette
  if (chosenRecipe === undefined) {
    if (canCreate) {
      chosenRecipe = await vscode.window.showQuickPick([...bitbakeWorkspace.activeRecipes, 'Add another recipe...'], { placeHolder: 'Select bitbake recipe' })
      if (chosenRecipe === 'Add another recipe...') {
        chosenRecipe = await addActiveRecipe(bitbakeWorkspace)
      }
    } else {
      chosenRecipe = await vscode.window.showQuickPick(bitbakeWorkspace.activeRecipes, { placeHolder: 'Select bitbake recipe' })
    }
  }
  return chosenRecipe
}

async function addActiveRecipe (bitbakeWorkspace: BitbakeWorkspace, recipe?: string): Promise<string | undefined> {
  if (typeof recipe === 'string') {
    bitbakeWorkspace.addActiveRecipe(recipe)
    return recipe
  }
  let chosenRecipe = await vscode.window.showInputBox({ placeHolder: 'Recipe name to add' })
  if (chosenRecipe !== undefined) {
    chosenRecipe = sanitizeForShell(extractRecipeName(chosenRecipe) as string) as string
    bitbakeWorkspace.addActiveRecipe(chosenRecipe)
  }
  return chosenRecipe
}

async function dropRecipe (bitbakeWorkspace: BitbakeWorkspace, uri?: string): Promise<void> {
  const chosenRecipe = await selectRecipe(bitbakeWorkspace, uri, false)
  if (chosenRecipe !== undefined) {
    bitbakeWorkspace.dropActiveRecipe(chosenRecipe)
  }
}

async function runBitbakeTask (task: vscode.Task, taskProvider: vscode.TaskProvider): Promise<void> {
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

async function rescanProject (bitbakeProjectScanner: BitBakeProjectScanner): Promise<void> {
  if (await bitbakeProjectScanner.bitbakeDriver?.checkBitbakeSettingsSanity() !== true) {
    logger.warn('bitbake settings are not sane, skip rescan')
    return
  }

  await bitbakeProjectScanner.rescanProject()
}

async function devtoolModifyCommand (bitbakeWorkspace: BitbakeWorkspace, bitbakeDriver: BitbakeDriver, uri?: any): Promise<void> {
  const chosenRecipe = await selectRecipe(bitbakeWorkspace, uri)
  if (chosenRecipe !== undefined) {
    logger.debug(`Command: devtool-modify: ${chosenRecipe}`)
    const command = `devtool modify ${chosenRecipe}`
    const process = await runBitbakeTerminalCustomCommand(bitbakeDriver, command, `Bitbake: Devtool Modify: ${chosenRecipe}`)
    process.on('exit', (code) => {
      if (code === 0) {
        void bitBakeProjectScanner.rescanProject()
      }
    })
  }
}

async function pickLayer (extraOption: string): Promise<LayerInfo | undefined> {
  const layers = bitBakeProjectScanner.scanResult._layers
  const chosenLayer = await vscode.window.showQuickPick([...layers.map(layer => layer.name), extraOption], { placeHolder: 'Choose target BitBake layer' })
  if (chosenLayer === undefined) { return }

  if (chosenLayer === extraOption) {
    return { name: extraOption, path: '', priority: 0 }
  } else {
    return layers.find(layer => layer.name === chosenLayer)
  }
}

async function devtoolUpdateCommand (bitbakeWorkspace: BitbakeWorkspace, bitbakeDriver: BitbakeDriver, uri?: any): Promise<void> {
  const chosenRecipe = await selectRecipe(bitbakeWorkspace, uri)
  if (chosenRecipe === undefined) { return }
  const chosenLayer = await pickLayer('Original recipe\'s layer')
  let command = ''

  if (chosenLayer?.name === 'Original recipe\'s layer') {
    command = `devtool update-recipe ${chosenRecipe}`
  } else {
    command = `devtool update-recipe ${chosenRecipe} --append ${chosenLayer?.path}`
  }

  logger.debug(`Command: devtool-update: ${chosenRecipe}`)
  await runBitbakeTerminalCustomCommand(bitbakeDriver, command, `Bitbake: Devtool Update: ${chosenRecipe}`)
}

async function devtoolResetCommand (bitbakeWorkspace: BitbakeWorkspace, bitbakeDriver: BitbakeDriver, uri?: any): Promise<void> {
  const chosenRecipe = await selectRecipe(bitbakeWorkspace, uri)
  if (chosenRecipe !== undefined) {
    logger.debug(`Command: devtool-reset: ${chosenRecipe}`)
    const command = `devtool reset ${chosenRecipe}`
    const process = await runBitbakeTerminalCustomCommand(bitbakeDriver, command, `Bitbake: Devtool Reset: ${chosenRecipe}`)
    process.on('exit', (code) => {
      if (code === 0) {
        void bitBakeProjectScanner.rescanProject()
      }
    })
  }
}

async function devtoolOpenWorkspaceCommand (bitbakeWorkspace: BitbakeWorkspace, bitbakeProjectScanner: BitBakeProjectScanner, uri?: any): Promise<void> {
  const chosenRecipe = await selectRecipe(bitbakeWorkspace, uri)
  if (chosenRecipe === undefined) { return }
  if (bitbakeProjectScanner.bitbakeDriver === undefined) { throw new Error('bitbakeDriver is undefined') }

  if (bitbakeProjectScanner.scanResult._workspaces.find((workspace) => workspace.name === chosenRecipe) === undefined) {
    await devtoolModifyCommand(bitbakeWorkspace, bitbakeProjectScanner.bitbakeDriver, chosenRecipe)
  }

  logger.debug(`Command: devtool-open-workspace: ${chosenRecipe}`)
  const workspacePath = bitbakeProjectScanner.scanResult._workspaces.find((workspace) => workspace.name === chosenRecipe)?.path
  if (workspacePath === undefined) {
    logger.error('Devtool workspace not found')
    return
  }
  // TODO convert URL outside of container. good luck!
  await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(workspacePath), { forceNewWindow: true })
}
