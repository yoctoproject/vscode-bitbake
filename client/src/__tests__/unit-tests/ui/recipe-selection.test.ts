/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as vscode from 'vscode'

import { type BitBakeProjectScanner } from '../../../driver/BitBakeProjectScanner'
import { BitbakeWorkspace } from '../../../ui/BitbakeWorkspace'
import { addActiveRecipe, selectRecipe, selectRecipeOrClass } from '../../../ui/RecipeSelection'
import { BitbakeClassTreeItem, BitbakeRecipeTreeItem } from '../../../ui/BitbakeRecipesView'
import { DevtoolWorkspaceTreeItem } from '../../../ui/DevtoolWorkspacesView'

jest.mock('vscode')

function createWorkspace (activeRecipes: string[] = [], activeClasses: string[] = []): BitbakeWorkspace {
  return {
    activeRecipes: [
      ...activeRecipes.map((name) => ({ name, isClass: false })),
      ...activeClasses.map((name) => ({ name, isClass: true }))
    ],
    addActiveRecipe: jest.fn()
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

    await expect(selectRecipe(workspace, scanner, 'busybox')).resolves.toBe('busybox')
    expect(vscode.window.showQuickPick).not.toHaveBeenCalled()
  })

  it('offers active recipes and Devtool workspaces', async () => {
    const workspace = createWorkspace(['busybox'])
    const scanner = createScanner(['workspace-recipe'])

    jest.spyOn(vscode.window, 'showQuickPick').mockResolvedValue({ label: 'workspace-recipe', name: 'workspace-recipe', isClass: false } as never)

    await expect(selectRecipe(workspace, scanner)).resolves.toBe('workspace-recipe')

    expect(vscode.window.showQuickPick).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ label: 'busybox', isClass: false }),
        expect.objectContaining({ label: 'workspace-recipe', isClass: false }),
        expect.objectContaining({ label: 'Add another recipe...' })
      ]),
      { placeHolder: 'Select bitbake recipe' }
    )
  })

  it('adds a recipe selected from the scanned recipes', async () => {
    const workspace = createWorkspace()
    const scanner = createScanner([], ['busybox'])

    jest.spyOn(vscode.window, 'showQuickPick').mockResolvedValue({ label: 'busybox', name: 'busybox', isClass: false } as never)

    await expect(addActiveRecipe(workspace, scanner)).resolves.toEqual({ name: 'busybox', isClass: false })
    expect(workspace.addActiveRecipe).toHaveBeenCalledWith('busybox', false)
  })

  it('adds a recipe supplied directly', async () => {
    const workspace = createWorkspace()
    const scanner = createScanner()

    await expect(addActiveRecipe(workspace, scanner, 'busybox')).resolves.toEqual({ name: 'busybox', isClass: false })
    expect(workspace.addActiveRecipe).toHaveBeenCalledWith('busybox')
    expect(vscode.window.showQuickPick).not.toHaveBeenCalled()
  })

  it('adds a class selected from the recipe-or-class picker', async () => {
    const workspace = createWorkspace()
    const scanner = createScanner([], ['busybox'], ['image_types'])
    const chosenItem = { label: 'image_types (class)', isClass: true, name: 'image_types' }

    jest.spyOn(vscode.window, 'showQuickPick').mockResolvedValue(chosenItem as never)

    await expect(addActiveRecipe(workspace, scanner, undefined, true)).resolves.toEqual({ name: 'image_types', isClass: true })
    expect(workspace.addActiveRecipe).toHaveBeenCalledWith('image_types', true)
  })

  it('offers recipes and classes with class labels in the recipe-or-class picker', async () => {
    const workspace = createWorkspace()
    const scanner = createScanner([], ['busybox'], ['image'])

    jest.spyOn(vscode.window, 'showQuickPick').mockResolvedValue(undefined as never)

    await addActiveRecipe(workspace, scanner, undefined, true)

    expect(vscode.window.showQuickPick).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ label: 'busybox', isClass: false, name: 'busybox' }),
        expect.objectContaining({ label: 'image (class)', isClass: true, name: 'image' })
      ]),
      { placeHolder: 'Select recipe or class to add' }
    )
  })

  it('deduplicates scanned class names in the recipe-or-class picker', async () => {
    const workspace = createWorkspace()
    const scanner = createScanner([], [], ['image', 'image'])

    jest.spyOn(vscode.window, 'showQuickPick').mockResolvedValue(undefined as never)

    await addActiveRecipe(workspace, scanner, undefined, true)

    const quickPickItems = (vscode.window.showQuickPick as jest.Mock).mock.calls[0][0] as Array<{ label: string }>
    expect(quickPickItems.filter((item) => item.label === 'image (class)')).toHaveLength(1)
  })

  it('keeps same-name recipes and classes available in the recipe-or-class picker', async () => {
    const workspace = createWorkspace()
    const scanner = createScanner([], ['systemd'], ['systemd'])

    jest.spyOn(vscode.window, 'showQuickPick').mockResolvedValue(undefined as never)

    await addActiveRecipe(workspace, scanner, undefined, true)

    expect(vscode.window.showQuickPick).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ label: 'systemd', isClass: false, name: 'systemd' }),
        expect.objectContaining({ label: 'systemd (class)', isClass: true, name: 'systemd' })
      ]),
      { placeHolder: 'Select recipe or class to add' }
    )
  })

  it('keeps selectRecipe recipe-only', async () => {
    const workspace = createWorkspace(['busybox'], ['image'])
    const scanner = createScanner([], ['busybox'], ['image'])

    jest.spyOn(vscode.window, 'showQuickPick').mockResolvedValue({ label: 'busybox', name: 'busybox', isClass: false } as never)

    await expect(selectRecipe(workspace, scanner)).resolves.toBe('busybox')
    expect(vscode.window.showQuickPick).toHaveBeenCalledWith(
      expect.not.arrayContaining([expect.objectContaining({ isClass: true })]),
      { placeHolder: 'Select bitbake recipe' }
    )
  })

  it('keeps an inactive class available when its same-name recipe is active', async () => {
    const workspace = createWorkspace(['systemd'])
    const scanner = createScanner([], ['systemd'], ['systemd'])
    jest.spyOn(vscode.window, 'showQuickPick').mockResolvedValue(undefined)

    await addActiveRecipe(workspace, scanner, undefined, true)

    expect(vscode.window.showQuickPick).toHaveBeenCalledWith(
      [{ label: 'systemd (class)', name: 'systemd', isClass: true }],
      { placeHolder: 'Select recipe or class to add' }
    )
  })

  it('keeps the add-another-recipe flow recipe-only', async () => {
    const workspace = createWorkspace([], ['image'])
    const scanner = createScanner([], ['busybox'], ['image'])
    jest.spyOn(vscode.window, 'showQuickPick')
      .mockResolvedValueOnce({ label: 'Add another recipe...', name: '', isClass: false } as never)
      .mockResolvedValueOnce({ label: 'busybox', name: 'busybox', isClass: false } as never)

    await expect(selectRecipe(workspace, scanner)).resolves.toBe('busybox')
    expect(vscode.window.showQuickPick).toHaveBeenLastCalledWith(
      [{ label: 'busybox', name: 'busybox', isClass: false }],
      { placeHolder: 'Select recipe to add' }
    )
  })

  it('accepts recipe and Devtool tree items without showing a picker', async () => {
    const workspace = createWorkspace()
    const scanner = createScanner()
    const recipe = new BitbakeRecipeTreeItem('busybox', vscode.TreeItemCollapsibleState.Collapsed)
    const devtoolWorkspace = Object.assign(new DevtoolWorkspaceTreeItem({ name: 'busybox', path: '' }), { label: 'busybox' })

    for (const item of [recipe, devtoolWorkspace]) {
      await expect(selectRecipe(workspace, scanner, item)).resolves.toBe('busybox')
    }
    expect(vscode.window.showQuickPick).not.toHaveBeenCalled()
  })

  it('accepts class tree items only when classes are allowed', async () => {
    const workspace = createWorkspace()
    const scanner = createScanner()
    const item = new BitbakeClassTreeItem('image')

    await expect(selectRecipe(workspace, scanner, item)).resolves.toBeUndefined()
    await expect(selectRecipeOrClass(workspace, scanner, item, false)).resolves.toEqual({ name: 'image', isClass: true })
    expect(vscode.window.showQuickPick).not.toHaveBeenCalled()
  })

  it.each(['.bb', '.bbappend', '.inc'])('accepts a recipe %s URI', async (extension) => {
    const workspace = createWorkspace()
    const scanner = createScanner()
    const uri = Object.assign(Object.create(vscode.Uri.prototype), { fsPath: `/recipes/busybox_1.0${extension}` }) as vscode.Uri

    await expect(selectRecipe(workspace, scanner, uri)).resolves.toBe('busybox')
    expect(workspace.addActiveRecipe).toHaveBeenCalledWith('busybox', false)
    expect(vscode.window.showQuickPick).not.toHaveBeenCalled()
  })

  it('accepts a class URI only when classes are allowed and respects canAdd', async () => {
    const workspace = createWorkspace()
    const scanner = createScanner()
    const uri = Object.assign(Object.create(vscode.Uri.prototype), { fsPath: '/classes/image.bbclass' }) as vscode.Uri

    await expect(selectRecipe(workspace, scanner, uri)).resolves.toBeUndefined()
    await expect(selectRecipeOrClass(workspace, scanner, uri, false)).resolves.toEqual({ name: 'image', isClass: true })
    expect(workspace.addActiveRecipe).not.toHaveBeenCalled()
    await expect(selectRecipeOrClass(workspace, scanner, uri)).resolves.toEqual({ name: 'image', isClass: true })
    expect(workspace.addActiveRecipe).toHaveBeenCalledWith('image', true)
  })
})
