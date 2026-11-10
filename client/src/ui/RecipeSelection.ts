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
import { BitbakeClassTreeItem, BitbakeRecipeTreeItem } from './BitbakeRecipesView'
import { type ActiveRecipe, type BitbakeWorkspace } from './BitbakeWorkspace'
import { DevtoolWorkspaceTreeItem } from './DevtoolWorkspacesView'

interface RecipeQuickPickItem extends vscode.QuickPickItem, ActiveRecipe {}

function recipeQuickPickItem (recipe: ActiveRecipe): RecipeQuickPickItem {
  return { ...recipe, label: recipe.isClass ? `${recipe.name} (class)` : recipe.name }
}

export async function selectRecipe (
  bitbakeWorkspace: BitbakeWorkspace,
  bitBakeProjectScanner: BitBakeProjectScanner,
  uri?: unknown,
  canAdd: boolean = true
): Promise<string | undefined> {
  return (await selectRecipeOrClass(bitbakeWorkspace, bitBakeProjectScanner, uri, canAdd, false))?.name
}

export async function selectRecipeOrClass (
  bitbakeWorkspace: BitbakeWorkspace,
  bitBakeProjectScanner: BitBakeProjectScanner,
  uri?: unknown,
  canAdd: boolean = true,
  includeClasses: boolean = true
): Promise<ActiveRecipe | undefined> {
  if (typeof uri === 'string') {
    return { name: uri, isClass: false }
  }

  if (uri instanceof BitbakeClassTreeItem) {
    return includeClasses ? { name: uri.label, isClass: true } : undefined
  }

  if (uri instanceof BitbakeRecipeTreeItem || uri instanceof DevtoolWorkspaceTreeItem) {
    return { name: uri.label as string, isClass: false }
  }

  if (uri instanceof vscode.Uri) {
    const extension = path.extname(uri.fsPath)
    const isClass = extension === '.bbclass'
    if (isClass && !includeClasses) return undefined
    if (isClass || ['.bb', '.bbappend', '.inc'].includes(extension)) {
      const name = isClass ? path.parse(uri.fsPath).name : extractRecipeName(uri.fsPath)
      if (canAdd) await bitbakeWorkspace.addActiveRecipe(name, isClass)
      return { name, isClass }
    }
  }

  const activeRecipes = bitbakeWorkspace.activeRecipes.filter((recipe) => includeClasses || !recipe.isClass)
  const workspaces = bitBakeProjectScanner.activeScanResult._workspaces.map((workspace) => ({ name: workspace.name, isClass: false }))
  const quickPickItems = mergeArraysDistinctly(
    (recipe) => `${recipe.isClass}:${recipe.name}`,
    activeRecipes,
    workspaces
  ).map(recipeQuickPickItem)
  const addLabel = includeClasses ? 'Add another recipe or class...' : 'Add another recipe...'

  if (canAdd || activeRecipes.length === 0) {
    quickPickItems.push({ label: addLabel, name: '', isClass: false })
  }

  const chosenRecipe = await vscode.window.showQuickPick(
    quickPickItems,
    { placeHolder: includeClasses ? 'Select bitbake recipe or class' : 'Select bitbake recipe' }
  )

  if (chosenRecipe?.label === addLabel) {
    return await addActiveRecipe(bitbakeWorkspace, bitBakeProjectScanner, undefined, includeClasses)
  }

  return chosenRecipe === undefined ? undefined : { name: chosenRecipe.name, isClass: chosenRecipe.isClass }
}

export async function addActiveRecipe (
  bitbakeWorkspace: BitbakeWorkspace,
  bitBakeProjectScanner: BitBakeProjectScanner,
  recipe?: string,
  includeClasses: boolean = false
): Promise<ActiveRecipe | undefined> {
  if (typeof recipe === 'string') {
    await bitbakeWorkspace.addActiveRecipe(recipe)
    return { name: recipe, isClass: false }
  }

  const recipes: ActiveRecipe[] = bitBakeProjectScanner.activeScanResult._recipes.map((recipe) => ({ name: recipe.name, isClass: false }))
  if (includeClasses) {
    const classNames = new Set(bitBakeProjectScanner.activeScanResult._classes.map((classInfo) => classInfo.name))
    recipes.push(...Array.from(classNames, (name) => ({ name, isClass: true })))
  }
  const quickPickItems = recipes
    .filter((recipe) => !includeClasses || !bitbakeWorkspace.activeRecipes.some((active) => active.name === recipe.name && active.isClass === recipe.isClass))
    .map(recipeQuickPickItem)
  let chosenRecipe: ActiveRecipe | undefined

  if (quickPickItems.length !== 0) {
    chosenRecipe = await vscode.window.showQuickPick(
      quickPickItems,
      { placeHolder: includeClasses ? 'Select recipe or class to add' : 'Select recipe to add' }
    )
  } else {
    const name = await vscode.window.showInputBox({
      placeHolder: "Type the recipe's name to add. (Bitbake scan not complete yet)"
    })
    if (name !== undefined) chosenRecipe = { name, isClass: false }
  }

  if (chosenRecipe === undefined) return undefined

  const name = sanitizeForShell(chosenRecipe.isClass ? chosenRecipe.name : extractRecipeName(chosenRecipe.name)) as string
  await bitbakeWorkspace.addActiveRecipe(name, chosenRecipe.isClass)
  return { name, isClass: chosenRecipe.isClass }
}
