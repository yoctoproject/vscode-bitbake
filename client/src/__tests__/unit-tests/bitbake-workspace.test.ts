/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { BitbakeWorkspace } from '../../ui/BitbakeWorkspace'

describe('Bitbake Workspace Test Suite', () => {
  it('should manage a list of active recipes', async () => {
    const bitbakeWorkspace = new BitbakeWorkspace()
    expect(bitbakeWorkspace.activeRecipes).toEqual([])
    await bitbakeWorkspace.addActiveRecipe('foo')
    expect(bitbakeWorkspace.activeRecipes).toEqual(['foo'])

    await bitbakeWorkspace.dropActiveRecipe('foo')
    expect(bitbakeWorkspace.activeRecipes).toEqual([])
  })

  it('loads legacy active recipes unchanged and defaults active classes to empty', () => {
    const bitbakeWorkspace = new BitbakeWorkspace()
    const workspaceState = {
      get: jest.fn((key: string, defaultValue: string[]) => {
        if (key === 'BitbakeWorkspace.activeRecipes') {
          return ['busybox']
        }
        return defaultValue
      }),
      update: jest.fn()
    }

    bitbakeWorkspace.loadBitbakeWorkspace(workspaceState as never)

    expect(bitbakeWorkspace.activeRecipes).toEqual(['busybox'])
    expect(bitbakeWorkspace.activeClasses).toEqual([])
    expect(workspaceState.get).toHaveBeenCalledWith('BitbakeWorkspace.activeRecipes', [])
    expect(workspaceState.get).toHaveBeenCalledWith('BitbakeWorkspace.activeClasses', [])
  })

  it('manages active classes independently from same-name recipes', async () => {
    const bitbakeWorkspace = new BitbakeWorkspace()
    const workspaceState = {
      get: jest.fn((_key: string, defaultValue: string[]) => defaultValue),
      update: jest.fn().mockResolvedValue(undefined)
    }

    bitbakeWorkspace.loadBitbakeWorkspace(workspaceState as never)
    await bitbakeWorkspace.addActiveRecipe('systemd')
    await bitbakeWorkspace.addActiveClass('systemd')
    await bitbakeWorkspace.addActiveClass('systemd')

    expect(bitbakeWorkspace.activeRecipes).toEqual(['systemd'])
    expect(bitbakeWorkspace.activeClasses).toEqual(['systemd'])

    await bitbakeWorkspace.dropActiveClass('systemd')

    expect(bitbakeWorkspace.activeRecipes).toEqual(['systemd'])
    expect(bitbakeWorkspace.activeClasses).toEqual([])
    expect(workspaceState.update).toHaveBeenCalledWith('BitbakeWorkspace.activeClasses', expect.any(Array))
  })

  it('keeps the 20 newest active classes', async () => {
    const bitbakeWorkspace = new BitbakeWorkspace()

    for (let index = 1; index <= 21; index++) {
      await bitbakeWorkspace.addActiveClass(`class-${index}`)
    }

    expect(bitbakeWorkspace.activeClasses).toHaveLength(20)
    expect(bitbakeWorkspace.activeClasses[0]).toBe('class-21')
    expect(bitbakeWorkspace.activeClasses).not.toContain('class-1')
  })
})
