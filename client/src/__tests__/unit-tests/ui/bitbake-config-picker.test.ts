/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as vscode from 'vscode'
import { BitbakeConfigPicker } from '../../../ui/BitbakeConfigPicker'
import { type BitbakeSettings } from '../../../lib/src/BitbakeSettings'
import { createStatusBarItemMock, mockVscodeExtensionContext, type StatusBarItemMock } from '../../utils/vscodeMock'

jest.mock('vscode')


function createBitbakeSettings (): BitbakeSettings {
  return {
    pathToBitbakeFolder: '',
    buildConfigurations: [
      {
        name: 'Default',
        pathToBuildFolder: '/tmp/default-build'
      },
      {
        name: 'Alternative',
        pathToBuildFolder: '/tmp/alternative-build'
      }
    ]
  }
}

function mockShowQuickPickSelection (selection: string | undefined): void {
  jest.spyOn(vscode.window, 'showQuickPick').mockResolvedValue(
    selection as unknown as vscode.QuickPickItem
  )
}

function createPicker (): {
  picker: BitbakeConfigPicker
  statusBarItem: StatusBarItemMock
} {
  const statusBarItem = createStatusBarItemMock()
  jest.spyOn(vscode.window, 'createStatusBarItem').mockReturnValue(statusBarItem)

  const extensionContext = mockVscodeExtensionContext()
  extensionContext.workspaceState.get.mockReturnValue('No BitBake configuration')
  extensionContext.workspaceState.update.mockResolvedValue(undefined)

  const picker = new BitbakeConfigPicker(createBitbakeSettings(), extensionContext)

  return {
    picker,
    statusBarItem
  }
}

describe('BitbakeConfigPicker', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  it('selects and shows the first build configuration by default', () => {
    const { picker, statusBarItem } = createPicker()

    expect(picker.activeBuildConfiguration).toBe('Default')
    expect(statusBarItem.text).toBe('$(list-selection) Default')
    expect(statusBarItem.command).toBe('bitbake.pick-configuration')
    expect(statusBarItem.tooltip).toBe('Select BitBake buildConfiguration')
    expect(statusBarItem.show).toHaveBeenCalled()
  })

  it('updates the status bar when picking a configuration by name', async () => {
    const { picker, statusBarItem } = createPicker()

    await picker.pickConfiguration('Alternative')

    expect(picker.activeBuildConfiguration).toBe('Alternative')
    expect(statusBarItem.text).toBe('$(list-selection) Alternative')
    expect(statusBarItem.show).toHaveBeenCalled()
    expect(vscode.window.showQuickPick).not.toHaveBeenCalled()
  })

  it('updates the status bar when picking a configuration from the QuickPick', async () => {
    const { picker, statusBarItem } = createPicker()
    mockShowQuickPickSelection('Alternative')

    await picker.pickConfiguration()

    expect(vscode.window.showQuickPick).toHaveBeenCalledWith(
      ['Default', 'Alternative'],
      { placeHolder: 'Select a BitBake configuration' }
    )
    expect(picker.activeBuildConfiguration).toBe('Alternative')
    expect(statusBarItem.text).toBe('$(list-selection) Alternative')
  })

  it('keeps the current configuration when the QuickPick is cancelled', async () => {
    const { picker, statusBarItem } = createPicker()
    mockShowQuickPickSelection(undefined)

    await picker.pickConfiguration('Unknown')

    expect(vscode.window.showQuickPick).toHaveBeenCalled()
    expect(picker.activeBuildConfiguration).toBe('Default')
    expect(statusBarItem.text).toBe('$(list-selection) Default')
  })
})
