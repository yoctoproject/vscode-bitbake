/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { BitbakeWorkspace } from '../../ui/BitbakeWorkspace'
import { mockVscodeExtensionContext } from '../utils/vscodeMock'

describe('Bitbake Workspace Test Suite', () => {
  it('should manage a list of active recipes', async () => {
    const bitbakeWorkspace = new BitbakeWorkspace()
    expect(bitbakeWorkspace.activeRecipes).toEqual([])
    await bitbakeWorkspace.addActiveRecipe('foo')
    expect(bitbakeWorkspace.activeRecipes).toEqual([{ name: 'foo', isClass: false }])

    await bitbakeWorkspace.dropActiveRecipe('foo')
    expect(bitbakeWorkspace.activeRecipes).toEqual([])
  })

  it('persists active recipes', async () => {
    const bitbakeWorkspace = new BitbakeWorkspace()
    const { workspaceState } = mockVscodeExtensionContext()
    workspaceState.get.mockReturnValue(['busybox'])
    workspaceState.update.mockResolvedValue(undefined)

    bitbakeWorkspace.loadBitbakeWorkspace(workspaceState)
    expect(workspaceState.get).toHaveBeenCalledWith('BitbakeWorkspace.activeRecipes', [])
    expect(bitbakeWorkspace.activeRecipes).toEqual([{ name: 'busybox', isClass: false }])

    await bitbakeWorkspace.addActiveRecipe('systemd')
    expect(workspaceState.update).toHaveBeenLastCalledWith('BitbakeWorkspace.activeRecipes', [
      { name: 'systemd', isClass: false },
      { name: 'busybox', isClass: false }
    ])

    await bitbakeWorkspace.dropActiveRecipe('busybox')
    expect(workspaceState.update).toHaveBeenLastCalledWith('BitbakeWorkspace.activeRecipes', [
      { name: 'systemd', isClass: false }
    ])
  })

  it('persists active classes', async () => {
    const bitbakeWorkspace = new BitbakeWorkspace()
    const { workspaceState } = mockVscodeExtensionContext()
    workspaceState.get.mockReturnValue([
      { name: 'image', isClass: true },
      { name: 'systemd', isClass: false }
    ])
    workspaceState.update.mockResolvedValue(undefined)

    bitbakeWorkspace.loadBitbakeWorkspace(workspaceState)
    expect(bitbakeWorkspace.activeRecipes).toEqual([
      { name: 'image', isClass: true },
      { name: 'systemd', isClass: false }
    ])

    await bitbakeWorkspace.addActiveRecipe('systemd', true)
    expect(workspaceState.update).toHaveBeenLastCalledWith('BitbakeWorkspace.activeRecipes', [
      { name: 'systemd', isClass: true },
      { name: 'image', isClass: true },
      { name: 'systemd', isClass: false }
    ])
    await bitbakeWorkspace.addActiveRecipe('systemd', true)
    expect(workspaceState.update).toHaveBeenCalledTimes(1)

    await bitbakeWorkspace.dropActiveRecipe('systemd', true)
    expect(workspaceState.update).toHaveBeenLastCalledWith('BitbakeWorkspace.activeRecipes', [
      { name: 'image', isClass: true },
      { name: 'systemd', isClass: false }
    ])
  })

  it('preserves legacy recipe overflow behavior by discarding new additions at 20 items', async () => {
    const bitbakeWorkspace = new BitbakeWorkspace()

    for (let index = 1; index <= 20; index++) {
      await bitbakeWorkspace.addActiveRecipe(`item-${index}`)
    }
    const activeRecipes = [...bitbakeWorkspace.activeRecipes]
    // Legacy unshift/shift behavior discards the newly added item, rather than the oldest.
    await bitbakeWorkspace.addActiveRecipe('another-class', true)
    await bitbakeWorkspace.addActiveRecipe('another-recipe')

    expect(bitbakeWorkspace.activeRecipes).toHaveLength(20)
    expect(bitbakeWorkspace.activeRecipes).toEqual(activeRecipes)
  })
})
