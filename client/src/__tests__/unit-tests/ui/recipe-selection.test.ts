/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as vscode from 'vscode'

import { type BitBakeProjectScanner } from '../../../driver/BitBakeProjectScanner'
import { type BitbakeWorkspace } from '../../../ui/BitbakeWorkspace'
import { addActiveRecipe, addActiveRecipeOrClass, selectRecipe } from '../../../ui/RecipeSelection'

jest.mock('vscode')

function createWorkspace (activeRecipes: string[] = [], activeClasses: string[] = []): BitbakeWorkspace {
  return {
    activeRecipes,
    activeClasses,
    addActiveRecipe: jest.fn(),
    addActiveClass: jest.fn()
  } as unknown as BitbakeWorkspace
}

function createScanner (
  workspaces: string[] = [],
  recipes: string[] = [],
  classes: string[] = []
): BitBakeProjectScanner {
  return {
    activeScanResult: {
      _workspaces: workspaces.map((name) => ({ name })),
      _recipes: recipes.map((name) => ({ name })),
      _classes: classes.map((name) => ({ name }))
    }
  } as unknown as BitBakeProjectScanner
}

describe('RecipeSelection', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  it('returns a recipe supplied directly by a command caller', async () => {
    const workspace = createWorkspace()
    const scanner = createScanner()

    await expect(selectRecipe(workspace, scanner, 'busybox')).resolves.toEqual('busybox')
    expect(vscode.window.showQuickPick).not.toHaveBeenCalled()
  })

  it('offers active recipes and Devtool workspaces', async () => {
    const workspace = createWorkspace(['busybox'])
    const scanner = createScanner(['workspace-recipe'])

    jest.spyOn(vscode.window, 'showQuickPick').mockResolvedValue('workspace-recipe' as never)

    await expect(selectRecipe(workspace, scanner)).resolves.toEqual('workspace-recipe')

    expect(vscode.window.showQuickPick).toHaveBeenCalledWith(
      expect.arrayContaining([
        'busybox',
        'workspace-recipe',
        'Add another recipe...'
      ]),
      { placeHolder: 'Select bitbake recipe' }
    )
  })

  it('adds a recipe selected from the scanned recipes', async () => {
    const workspace = createWorkspace()
    const scanner = createScanner([], ['busybox'])

    jest.spyOn(vscode.window, 'showQuickPick').mockResolvedValue('busybox' as never)

    await expect(addActiveRecipe(workspace, scanner)).resolves.toEqual('busybox')
    expect(workspace.addActiveRecipe).toHaveBeenCalledWith('busybox')
  })

  it('adds a recipe supplied directly', async () => {
    const workspace = createWorkspace()
    const scanner = createScanner()

    await expect(addActiveRecipe(workspace, scanner, 'busybox')).resolves.toEqual('busybox')
    expect(workspace.addActiveRecipe).toHaveBeenCalledWith('busybox')
    expect(vscode.window.showQuickPick).not.toHaveBeenCalled()
  })

  it('adds a recipe selected from the recipe-or-class picker', async () => {
    const workspace = createWorkspace()
    const scanner = createScanner([], ['busybox'], ['image'])
    const chosenItem = { label: 'busybox', itemType: 'recipe', name: 'busybox' }

    jest.spyOn(vscode.window, 'showQuickPick').mockResolvedValue(chosenItem as never)

    await expect(addActiveRecipeOrClass(workspace, scanner)).resolves.toEqual('busybox')
    expect(workspace.addActiveRecipe).toHaveBeenCalledWith('busybox')
    expect(workspace.addActiveClass).not.toHaveBeenCalled()
  })

  it('adds a class selected from the recipe-or-class picker', async () => {
    const workspace = createWorkspace()
    const scanner = createScanner([], ['busybox'], ['image'])
    const chosenItem = { label: 'image (class)', itemType: 'class', name: 'image' }

    jest.spyOn(vscode.window, 'showQuickPick').mockResolvedValue(chosenItem as never)

    await expect(addActiveRecipeOrClass(workspace, scanner)).resolves.toEqual('image')
    expect(workspace.addActiveClass).toHaveBeenCalledWith('image')
    expect(workspace.addActiveRecipe).not.toHaveBeenCalled()
  })

  it('offers recipes and classes with class labels in the recipe-or-class picker', async () => {
    const workspace = createWorkspace()
    const scanner = createScanner([], ['busybox'], ['image'])

    jest.spyOn(vscode.window, 'showQuickPick').mockResolvedValue(undefined as never)

    await addActiveRecipeOrClass(workspace, scanner)

    expect(vscode.window.showQuickPick).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ label: 'busybox', itemType: 'recipe', name: 'busybox' }),
        expect.objectContaining({ label: 'image (class)', itemType: 'class', name: 'image' })
      ]),
      { placeHolder: 'Select recipe or class to add' }
    )
  })

  it('deduplicates scanned class names in the recipe-or-class picker', async () => {
    const workspace = createWorkspace()
    const scanner = createScanner([], [], ['image', 'image'])

    jest.spyOn(vscode.window, 'showQuickPick').mockResolvedValue(undefined as never)

    await addActiveRecipeOrClass(workspace, scanner)

    const quickPickItems = (vscode.window.showQuickPick as jest.Mock).mock.calls[0][0] as Array<{ label: string }>
    expect(quickPickItems.filter((item) => item.label === 'image (class)')).toHaveLength(1)
  })

  it('keeps same-name recipes and classes available in the recipe-or-class picker', async () => {
    const workspace = createWorkspace()
    const scanner = createScanner([], ['systemd'], ['systemd'])

    jest.spyOn(vscode.window, 'showQuickPick').mockResolvedValue(undefined as never)

    await addActiveRecipeOrClass(workspace, scanner)

    expect(vscode.window.showQuickPick).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ label: 'systemd', itemType: 'recipe', name: 'systemd' }),
        expect.objectContaining({ label: 'systemd (class)', itemType: 'class', name: 'systemd' })
      ]),
      { placeHolder: 'Select recipe or class to add' }
    )
  })

  it('keeps selectRecipe recipe-only', async () => {
    const workspace = createWorkspace(['busybox'], ['image'])
    const scanner = createScanner([], ['busybox'], ['image'])

    jest.spyOn(vscode.window, 'showQuickPick').mockResolvedValue('busybox' as never)

    await expect(selectRecipe(workspace, scanner)).resolves.toEqual('busybox')
    expect(vscode.window.showQuickPick).toHaveBeenCalledWith(
      expect.not.arrayContaining(['image', 'image (class)']),
      { placeHolder: 'Select bitbake recipe' }
    )
  })
})
