/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import path from 'path'
import * as vscode from 'vscode'

import { type BitBakeProjectScanner } from '../driver/BitBakeProjectScanner'
import { sanitizeForShell } from '../lib/src/BitbakeSettings'
import { extractRecipeName } from '../lib/src/utils/files'
import { mergeArraysDistinctly } from '../lib/src/utils/arrays'
import { BitbakeRecipeTreeItem } from './BitbakeRecipesView'
import { type BitbakeWorkspace } from './BitbakeWorkspace'
import { DevtoolWorkspaceTreeItem } from './DevtoolWorkspacesView'

export async function selectRecipe (
  bitbakeWorkspace: BitbakeWorkspace,
  bitBakeProjectScanner: BitBakeProjectScanner,
  uri?: unknown,
  canAdd: boolean = true
): Promise<string | undefined> {
  let chosenRecipe: string | undefined

  if (typeof uri === 'string') {
    return uri
  }

  if (uri instanceof BitbakeRecipeTreeItem) {
    return uri.label
  }

  if (uri instanceof DevtoolWorkspaceTreeItem) {
    return uri.label as string
  }

  if (uri instanceof vscode.Uri) {
    const extension = path.extname(uri.fsPath)
    if (['.bb', '.bbappend', '.inc'].includes(extension)) {
      chosenRecipe = extractRecipeName(uri.fsPath)
      if (canAdd) await bitbakeWorkspace.addActiveRecipe(chosenRecipe)
    }
  }

  if (chosenRecipe === undefined) {
    const devtoolWorkspacesNames = bitBakeProjectScanner.activeScanResult._workspaces.map((workspace) => workspace.name)
    const quickPickItems = mergeArraysDistinctly(
      (name) => name,
      bitbakeWorkspace.activeRecipes,
      devtoolWorkspacesNames
    )

    if (canAdd || bitbakeWorkspace.activeRecipes.length === 0) {
      quickPickItems.push('Add another recipe...')
    }

    chosenRecipe = await vscode.window.showQuickPick(
      quickPickItems,
      { placeHolder: 'Select bitbake recipe' }
    )

    if (chosenRecipe === 'Add another recipe...') {
      chosenRecipe = await addActiveRecipe(bitbakeWorkspace, bitBakeProjectScanner)
    }
  }

  return chosenRecipe
}

export async function addActiveRecipe (
  bitbakeWorkspace: BitbakeWorkspace,
  bitBakeProjectScanner: BitBakeProjectScanner,
  recipe?: string
): Promise<string | undefined> {
  if (typeof recipe === 'string') {
    await bitbakeWorkspace.addActiveRecipe(recipe)
    return recipe
  }

  const recipeNames = bitBakeProjectScanner.activeScanResult._recipes.map((recipe) => recipe.name)
  let chosenRecipe: string | undefined

  if (recipeNames.length !== 0) {
    chosenRecipe = await vscode.window.showQuickPick(
      recipeNames,
      { placeHolder: 'Select recipe to add' }
    )
  } else {
    chosenRecipe = await vscode.window.showInputBox({
      placeHolder: "Type the recipe's name to add. (Bitbake scan not complete yet)"
    })
  }

  if (chosenRecipe !== undefined) {
    chosenRecipe = sanitizeForShell(extractRecipeName(chosenRecipe)) as string
    await bitbakeWorkspace.addActiveRecipe(chosenRecipe)
  }

  return chosenRecipe
}
