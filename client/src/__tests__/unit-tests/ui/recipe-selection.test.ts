/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as vscode from 'vscode'

import { type BitBakeProjectScanner } from '../../../driver/BitBakeProjectScanner'
import { type BitbakeWorkspace } from '../../../ui/BitbakeWorkspace'
import { addActiveRecipe, selectRecipe } from '../../../ui/RecipeSelection'

jest.mock('vscode')

function createWorkspace (activeRecipes: string[] = []): BitbakeWorkspace {
  return {
    activeRecipes: activeRecipes.map((name) => ({ name, isClass: false })),
    addActiveRecipe: jest.fn()
  } as unknown as BitbakeWorkspace
}

function createScanner (
  workspaces: string[] = [],
  recipes: string[] = []
): BitBakeProjectScanner {
  return {
    activeScanResult: {
      _workspaces: workspaces.map((name) => ({ name })),
      _recipes: recipes.map((name) => ({ name }))
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

    jest.spyOn(vscode.window, 'showQuickPick').mockResolvedValue({ label: 'workspace-recipe', name: 'workspace-recipe', isClass: false } as never)

    await expect(selectRecipe(workspace, scanner)).resolves.toEqual('workspace-recipe')

    expect(vscode.window.showQuickPick).toHaveBeenCalledWith(
      expect.arrayContaining([
        { label: 'busybox', name: 'busybox', isClass: false },
        { label: 'workspace-recipe', name: 'workspace-recipe', isClass: false },
        { label: 'Add another recipe...', name: '', isClass: false }
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
})
