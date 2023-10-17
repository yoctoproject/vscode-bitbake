/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

/// This files contains the VSCode commands exposed by the extension

import * as vscode from 'vscode'

import { logger } from './OutputLogger'
import { type BitbakeWorkspace } from './BitbakeWorkspace'
import { bitbakeExtensionContext } from '../extension'

export async function buildRecipeCommand (bitbakeWorkspace: BitbakeWorkspace, taskProvider: vscode.TaskProvider): Promise<void> {
  const chosenRecipe = await selectRecipe(bitbakeWorkspace)
  logger.debug(`Command: build-recipe: ${chosenRecipe}`)
  if (chosenRecipe !== undefined) {
    const task = new vscode.Task(
      { type: 'bitbake', recipes: [chosenRecipe] },
        `Run bitbake ${chosenRecipe}`,
        'bitbake'
    )
    await runBitbakeTask(task, taskProvider)
  }
}

export async function cleanRecipeCommand (bitbakeWorkspace: BitbakeWorkspace, taskProvider: vscode.TaskProvider): Promise<void> {
  const chosenRecipe = await selectRecipe(bitbakeWorkspace)
  logger.debug(`Command: clean-recipe: ${chosenRecipe}`)
  if (chosenRecipe !== undefined) {
    const task = new vscode.Task(
      { type: 'bitbake', recipes: [chosenRecipe], task: 'clean' },
        `Run bitbake ${chosenRecipe}`,
        'bitbake'
    )
    await runBitbakeTask(task, taskProvider)
  }
}

export async function runTaskCommand (bitbakeWorkspace: BitbakeWorkspace, taskProvider: vscode.TaskProvider): Promise<void> {
  const chosenRecipe = await selectRecipe(bitbakeWorkspace)
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

async function selectRecipe (bitbakeWorkspace: BitbakeWorkspace): Promise<string | undefined> {
  let chosenRecipe = await vscode.window.showQuickPick([...bitbakeWorkspace.activeRecipes, 'Add another recipe...'], { placeHolder: 'Select recipe to build' })
  if (chosenRecipe === 'Add another recipe...') {
    chosenRecipe = await addActiveRecipe(bitbakeWorkspace)
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
