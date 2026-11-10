/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as vscode from 'vscode'
import { type LanguageClient } from 'vscode-languageclient/node'
import { type BitBakeProjectScanner } from '../../../driver/BitBakeProjectScanner'
import { registerBitbakeCommands } from '../../../ui/BitbakeCommands'
import { type BitbakeTaskProvider } from '../../../ui/BitbakeTaskProvider'
import { type BitbakeTerminalProfileProvider } from '../../../ui/BitbakeTerminalProfile'
import { BitbakeWorkspace } from '../../../ui/BitbakeWorkspace'
import { mockVscodeExtensionContext } from '../../utils/vscodeMock'

jest.mock('vscode', () => ({
  ...jest.requireActual('../../../../../__mocks__/vscode'),
  tasks: { onDidEndTask: jest.fn() }
}))

describe('BitBake Drop commands', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  it('drops a class through the unified command without dropping its same-name recipe, then drops all', async () => {
    const workspace = new BitbakeWorkspace()
    await workspace.addActiveRecipe('systemd')
    await workspace.addActiveRecipe('systemd', true)
    const scanner = {
      activeScanResult: {
        _recipes: [{ name: 'systemd' }],
        _classes: [{ name: 'systemd' }],
        _workspaces: []
      }
    } as unknown as BitBakeProjectScanner
    registerBitbakeCommands(
      mockVscodeExtensionContext(),
      workspace,
      {} as BitbakeTaskProvider,
      scanner,
      {} as BitbakeTerminalProfileProvider,
      {} as LanguageClient
    )
    const registeredCommands = (vscode.commands.registerCommand as jest.Mock).mock.calls as Array<[string, (uri?: unknown) => Promise<void>]>
    const commands = new Map(registeredCommands)
    expect(commands.has('bitbake.drop-class')).toBe(false)
    const chosenClass = { label: 'systemd (class)', name: 'systemd', isClass: true }
    jest.spyOn(vscode.window, 'showQuickPick').mockResolvedValue(chosenClass as never)

    await commands.get('bitbake.drop-recipe')?.()
    expect(workspace.activeRecipes).toEqual([{ name: 'systemd', isClass: false }])
    expect(vscode.window.showQuickPick).toHaveBeenCalledWith(
      [chosenClass, { label: 'systemd', name: 'systemd', isClass: false }],
      { placeHolder: 'Select bitbake recipe or class' }
    )

    await workspace.addActiveRecipe('image', true)
    await commands.get('bitbake.drop-all-recipes')?.()
    expect(workspace.activeRecipes).toEqual([])
  })
})
