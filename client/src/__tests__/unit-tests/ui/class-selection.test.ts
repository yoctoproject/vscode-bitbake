/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as vscode from 'vscode'

import { type BitBakeProjectScanner } from '../../../driver/BitBakeProjectScanner'
import { type BitbakeWorkspace } from '../../../ui/BitbakeWorkspace'
import { addActiveClass } from '../../../ui/ClassSelection'

jest.mock('vscode')

function createWorkspace (activeRecipes: string[] = [], activeClasses: string[] = []): BitbakeWorkspace {
  return {
    activeRecipes,
    activeClasses,
    addActiveClass: jest.fn()
  } as unknown as BitbakeWorkspace
}

function createScanner (classes: string[] = [], recipes: string[] = []): BitBakeProjectScanner {
  return {
    activeScanResult: {
      _classes: classes.map((name) => ({ name })),
      _recipes: recipes.map((name) => ({ name }))
    }
  } as unknown as BitBakeProjectScanner
}

describe('ClassSelection', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  it('adds a class selected from scanned classes', async () => {
    const workspace = createWorkspace()
    const scanner = createScanner(['systemd'])

    jest.spyOn(vscode.window, 'showQuickPick').mockResolvedValue('systemd' as never)

    await expect(addActiveClass(workspace, scanner)).resolves.toEqual('systemd')
    expect(vscode.window.showQuickPick).toHaveBeenCalledWith(
      ['systemd'],
      { placeHolder: 'Select class to add' }
    )
    expect(workspace.addActiveClass).toHaveBeenCalledWith('systemd')
  })

  it('excludes active classes from add candidates', async () => {
    const workspace = createWorkspace([], ['base'])
    const scanner = createScanner(['base', 'systemd'])

    jest.spyOn(vscode.window, 'showQuickPick').mockResolvedValue('systemd' as never)

    await expect(addActiveClass(workspace, scanner)).resolves.toEqual('systemd')
    expect(vscode.window.showQuickPick).toHaveBeenCalledWith(
      ['systemd'],
      { placeHolder: 'Select class to add' }
    )
  })

  it('deduplicates scanned class candidates in first-seen order', async () => {
    const workspace = createWorkspace()
    const scanner = createScanner(['base', 'base', 'systemd'])

    jest.spyOn(vscode.window, 'showQuickPick').mockResolvedValue('base' as never)

    await expect(addActiveClass(workspace, scanner)).resolves.toEqual('base')
    expect(vscode.window.showQuickPick).toHaveBeenCalledWith(
      ['base', 'systemd'],
      { placeHolder: 'Select class to add' }
    )
  })

  it('does not let recipe state exclude same-name class candidates', async () => {
    const workspace = createWorkspace(['systemd'], [])
    const scanner = createScanner(['systemd'], ['systemd'])

    jest.spyOn(vscode.window, 'showQuickPick').mockResolvedValue('systemd' as never)

    await expect(addActiveClass(workspace, scanner)).resolves.toEqual('systemd')
    expect(vscode.window.showQuickPick).toHaveBeenCalledWith(
      ['systemd'],
      { placeHolder: 'Select class to add' }
    )
    expect(workspace.addActiveClass).toHaveBeenCalledWith('systemd')
  })

  it('adds a class supplied directly', async () => {
    const workspace = createWorkspace()
    const scanner = createScanner()

    await expect(addActiveClass(workspace, scanner, 'systemd')).resolves.toEqual('systemd')
    expect(workspace.addActiveClass).toHaveBeenCalledWith('systemd')
    expect(vscode.window.showQuickPick).not.toHaveBeenCalled()
  })
})
