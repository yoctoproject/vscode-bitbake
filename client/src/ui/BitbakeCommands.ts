/// This files contains the VSCode commands exposed by the extension

import * as vscode from 'vscode'

import { logger } from './OutputLogger';
import { BitbakeWorkspace } from './BitbakeWorkspace';

export async function buildRecipeCommand (bitbakeWorkspace: BitbakeWorkspace, taskProvider : vscode.TaskProvider): Promise<void> {
    const chosenRecipe = await selectRecipe(bitbakeWorkspace);
    logger.info(`Command: build.recipe: ${chosenRecipe}`);
    if(chosenRecipe) {
      const task = new vscode.Task(
        {type: 'bitbake', recipes: [chosenRecipe]},
        `Run bitbake ${chosenRecipe}`,
        'bitbake'
      );
      let resolvedTask = taskProvider.resolveTask(task, new vscode.CancellationTokenSource().token);
      if (resolvedTask instanceof Promise) {
        resolvedTask = await resolvedTask;
      }
      if(resolvedTask instanceof vscode.Task) {
        await vscode.tasks.executeTask(resolvedTask);
      } else {
        await vscode.window.showErrorMessage(`Failed to resolve task for recipe ${chosenRecipe}`);
      }
    }
}

async function selectRecipe(bitbakeWorkspace: BitbakeWorkspace): Promise<string | undefined> {
  let chosenRecipe = await vscode.window.showQuickPick([...bitbakeWorkspace.activeRecipes, "Add another recipe..."], {placeHolder: 'Select recipe to build'});
  if(chosenRecipe === "Add another recipe...") {
    chosenRecipe = await addActiveRecipe(bitbakeWorkspace);
  }
  return chosenRecipe;
}

async function addActiveRecipe(bitbakeWorkspace: BitbakeWorkspace): Promise<string | undefined> {
  const chosenRecipe = await vscode.window.showInputBox({placeHolder: 'Recipe name to add'});
  if(chosenRecipe) {
    bitbakeWorkspace.activeRecipes.push(chosenRecipe);
  }
  return chosenRecipe;
}
