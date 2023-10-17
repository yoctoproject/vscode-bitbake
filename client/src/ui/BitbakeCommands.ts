/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

/// This files contains the VSCode commands exposed by the extension

import * as vscode from 'vscode'

import { logger } from './OutputLogger'
import { type BitbakeWorkspace } from './BitbakeWorkspace'
import { bitbakeExtensionContext } from '../extension'
import { type BitbakeTaskProvider } from './BitbakeTaskProvider'
import path from 'path'

export function registerBitbakeCommands (context: vscode.ExtensionContext, bitbakeWorkspace: BitbakeWorkspace, bitbakeTaskProvider: BitbakeTaskProvider): void {
  context.subscriptions.push(vscode.commands.registerCommand('bitbake.build-recipe', async (uri) => { await buildRecipeCommand(bitbakeWorkspace, bitbakeTaskProvider, uri) }))
  context.subscriptions.push(vscode.commands.registerCommand('bitbake.clean-recipe', async (uri) => { await cleanRecipeCommand(bitbakeWorkspace, bitbakeTaskProvider, uri) }))
  context.subscriptions.push(vscode.commands.registerCommand('bitbake.run-task', async (uri) => { await runTaskCommand(bitbakeWorkspace, bitbakeTaskProvider, uri) }))
}

async function buildRecipeCommand (bitbakeWorkspace: BitbakeWorkspace, taskProvider: vscode.TaskProvider, uri?: any): Promise<void> {
  const chosenRecipe = await selectRecipe(bitbakeWorkspace, uri)
  if (chosenRecipe !== undefined) {
    logger.debug(`Command: build-recipe: ${chosenRecipe}`)
    const task = new vscode.Task(
      { type: 'bitbake', recipes: [chosenRecipe] },
        `Run bitbake ${chosenRecipe}`,
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
        `Run bitbake ${chosenRecipe}`,
        'bitbake'
    )
    await runBitbakeTask(task, taskProvider)
  }
}

async function runTaskCommand (bitbakeWorkspace: BitbakeWorkspace, taskProvider: vscode.TaskProvider, uri?: any): Promise<void> {
  const chosenRecipe = await selectRecipe(bitbakeWorkspace, uri)
  if (chosenRecipe !== undefined) {
    const chosenTask = await selectTask()
    if (chosenTask !== undefined) {
      logger.debug(`Command: run-task: ${chosenRecipe} -c ${chosenTask}`)
      const task = new vscode.Task(
        { type: 'bitbake', recipes: [chosenRecipe], task: chosenTask },
          `Run bitbake ${chosenRecipe} -c ${chosenTask}`,
          'bitbake'
      )
      await runBitbakeTask(task, taskProvider)
    }
  }
}

async function selectTask (): Promise<string | undefined> {
  const chosenTask = await vscode.window.showInputBox({ placeHolder: 'Bitbake task to run (bitbake -c)' })
  return chosenTask
}

async function selectRecipe (bitbakeWorkspace: BitbakeWorkspace, uri?: any): Promise<string | undefined> {
  let chosenRecipe: string | undefined
  if (uri !== undefined) {
    const extension = path.extname(uri.fsPath)
    if (['.bb', '.bbappend', '.inc'].includes(extension)) {
      chosenRecipe = path.basename(uri.fsPath, extension)
      // Remove PV from recipe name
      chosenRecipe = chosenRecipe.split('_')[0]
    }
  }
  if (chosenRecipe === undefined) {
    chosenRecipe = await vscode.window.showQuickPick([...bitbakeWorkspace.activeRecipes, 'Add another recipe...'], { placeHolder: 'Select recipe to build' })
    if (chosenRecipe === 'Add another recipe...') {
      chosenRecipe = await addActiveRecipe(bitbakeWorkspace)
    }
  }
  return chosenRecipe
}

async function addActiveRecipe (bitbakeWorkspace: BitbakeWorkspace): Promise<string | undefined> {
  const chosenRecipe = await vscode.window.showInputBox({ placeHolder: 'Recipe name to add' })
  if (chosenRecipe !== undefined) {
    bitbakeWorkspace.addActiveRecipe(chosenRecipe)
    await bitbakeWorkspace.saveBitbakeWorkspace(bitbakeExtensionContext.workspaceState)
  }
  return chosenRecipe
}

async function runBitbakeTask (task: vscode.Task, taskProvider: vscode.TaskProvider): Promise<void> {
  let resolvedTask = taskProvider.resolveTask(task, new vscode.CancellationTokenSource().token)
  if (resolvedTask instanceof Promise) {
    resolvedTask = await resolvedTask
  }
  if (resolvedTask instanceof vscode.Task) {
    await vscode.tasks.executeTask(resolvedTask)
  } else {
    await vscode.window.showErrorMessage(`Failed to resolve task for recipe ${task.definition.recipes[0]}`)
  }
}
