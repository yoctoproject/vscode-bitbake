/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

/// This files contains the VSCode commands exposed by the extension

import * as vscode from 'vscode'

import { logger } from '../lib/src/utils/OutputLogger'
import { type BitbakeWorkspace } from './BitbakeWorkspace'
import { type BitbakeTaskProvider } from './BitbakeTaskProvider'
import path from 'path'
import { BitbakeRecipeTreeItem } from './BitbakeRecipesView'
import { type BitBakeProjectScanner } from '../driver/BitBakeProjectScanner'
import { extractRecipeName } from '../lib/src/utils/files'

let parsingPending = false

export function registerBitbakeCommands (context: vscode.ExtensionContext, bitbakeWorkspace: BitbakeWorkspace, bitbakeTaskProvider: BitbakeTaskProvider, bitbakeProjectScanner: BitBakeProjectScanner): void {
  context.subscriptions.push(vscode.commands.registerCommand('bitbake.parse-recipes', async () => { await parseAllrecipes(bitbakeWorkspace, bitbakeTaskProvider) }))
  context.subscriptions.push(vscode.commands.registerCommand('bitbake.build-recipe', async (uri) => { await buildRecipeCommand(bitbakeWorkspace, bitbakeTaskProvider, uri) }))
  context.subscriptions.push(vscode.commands.registerCommand('bitbake.clean-recipe', async (uri) => { await cleanRecipeCommand(bitbakeWorkspace, bitbakeTaskProvider, uri) }))
  context.subscriptions.push(vscode.commands.registerCommand('bitbake.run-task', async (uri, task) => { await runTaskCommand(bitbakeWorkspace, bitbakeTaskProvider, uri, task) }))
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

async function parseAllrecipes (bitbakeWorkspace: BitbakeWorkspace, taskProvider: BitbakeTaskProvider): Promise<void> {
  logger.debug('Command: parse-recipes')

  if (!(await taskProvider.bitbakeDriver?.checkBitbakeSettingsSanity())) {
    logger.warn('bitbake settings are not sane, skip parse')
    return
  }

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

async function buildRecipeCommand (bitbakeWorkspace: BitbakeWorkspace, taskProvider: vscode.TaskProvider, uri?: any): Promise<void> {
  const chosenRecipe = await selectRecipe(bitbakeWorkspace, uri)
  if (chosenRecipe !== undefined) {
    logger.debug(`Command: build-recipe: ${chosenRecipe}`)
    const task = new vscode.Task(
      { type: 'bitbake', recipes: [chosenRecipe] },
      vscode.TaskScope.Workspace,
      `Bitbake: Build: ${chosenRecipe}`,
      'bitbake'
    )
    await runBitbakeTask(task, taskProvider)
  }
}

async function cleanRecipeCommand (bitbakeWorkspace: BitbakeWorkspace, taskProvider: vscode.TaskProvider, uri?: any): Promise<void> {
  const chosenRecipe = await selectRecipe(bitbakeWorkspace, uri)
  if (chosenRecipe !== undefined) {
    logger.debug(`Command: clean-recipe: ${chosenRecipe}`)
    const task = new vscode.Task(
      { type: 'bitbake', recipes: [chosenRecipe], task: 'clean' },
      vscode.TaskScope.Workspace,
      `Bitbake: Clean: ${chosenRecipe}`,
      'bitbake'
    )
    await runBitbakeTask(task, taskProvider)
  }
}

async function runTaskCommand (bitbakeWorkspace: BitbakeWorkspace, taskProvider: vscode.TaskProvider, uri?: any, task?: any): Promise<void> {
  const chosenRecipe = await selectRecipe(bitbakeWorkspace, uri)
  if (chosenRecipe !== undefined) {
    let chosenTask: string | undefined
    if (typeof task === 'string') {
      chosenTask = task
    } else {
      chosenTask = await selectTask()
    }
    if (chosenTask !== undefined) {
      logger.debug(`Command: run-task: ${chosenRecipe} -c ${chosenTask}`)
      const task = new vscode.Task(
        { type: 'bitbake', recipes: [chosenRecipe], task: chosenTask },
        vscode.TaskScope.Workspace,
        `Bitbake: Task ${chosenTask}: ${chosenRecipe}`,
        'bitbake'
      )
      await runBitbakeTask(task, taskProvider)
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
      chosenRecipe = await vscode.window.showQuickPick([...bitbakeWorkspace.activeRecipes, 'Add another recipe...'], { placeHolder: 'Select recipe to build' })
      if (chosenRecipe === 'Add another recipe...') {
        chosenRecipe = await addActiveRecipe(bitbakeWorkspace)
      }
    } else {
      chosenRecipe = await vscode.window.showQuickPick(bitbakeWorkspace.activeRecipes, { placeHolder: 'Select recipe to build' })
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
