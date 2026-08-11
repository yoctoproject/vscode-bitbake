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
    activeRecipes,
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
})
