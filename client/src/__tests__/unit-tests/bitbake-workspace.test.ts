/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { BitbakeWorkspace } from '../../ui/BitbakeWorkspace'
import { mockVscodeExtensionContext } from '../utils/vscodeMock'

describe('Bitbake Workspace Test Suite', () => {
  const bitbakeWorkspace = new BitbakeWorkspace()

  it('should manage a list of active recipes', async () => {
    expect(bitbakeWorkspace.activeRecipes).toEqual([])
    await bitbakeWorkspace.addActiveRecipe('foo')
    expect(bitbakeWorkspace.activeRecipes).toEqual([{ name: 'foo', isClass: false }])

    await bitbakeWorkspace.dropActiveRecipe('foo')
    expect(bitbakeWorkspace.activeRecipes).toEqual([])
  })

  it('persists active recipes', async () => {
    const workspace = new BitbakeWorkspace()
    const { workspaceState } = mockVscodeExtensionContext()
    workspaceState.get.mockReturnValue(['foo'])

    workspace.loadBitbakeWorkspace(workspaceState)
    expect(workspaceState.get).toHaveBeenCalledWith('BitbakeWorkspace.activeRecipes', [])
    expect(workspace.activeRecipes).toEqual([{ name: 'foo', isClass: false }])

    await workspace.addActiveRecipe('bar')
    expect(workspaceState.update).toHaveBeenLastCalledWith('BitbakeWorkspace.activeRecipes', [
      { name: 'bar', isClass: false },
      { name: 'foo', isClass: false }
    ])

    await workspace.dropActiveRecipe('foo')
    expect(workspaceState.update).toHaveBeenLastCalledWith('BitbakeWorkspace.activeRecipes', [{ name: 'bar', isClass: false }])
    expect(workspaceState.update).toHaveBeenCalledTimes(2)
  })
})
