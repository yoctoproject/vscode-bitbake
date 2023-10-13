/// This files contains the VSCode commands exposed by the extension

import * as vscode from 'vscode'

import { logger } from './OutputLogger';
import { BitbakeWorkspace } from './BitbakeWorkspace';

export async function buildRecipeCommand (bitbakeWorkspace: BitbakeWorkspace): Promise<void> {
    const chosenRecipe = await selectRecipe(bitbakeWorkspace);
    logger.info(`Command: build.recipe: ${chosenRecipe}`);
    if(chosenRecipe) {
      let exec = new vscode.ShellExecution(`bitbake ${chosenRecipe}`)
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
