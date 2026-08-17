/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2026 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as vscode from 'vscode'

import {
  collectBitbakeSetupInitializationSelection
} from '../../../ui/BitbakeSetupInitializationSelection'
import {
  listBitbakeSetupRegistryConfigurations
} from '../../../utils/BitbakeSetupRegistryList'
import {
  probeBitbakeSetupWrynoseConfigurations
} from '../../../utils/BitbakeSetupWrynoseCompatibility'

jest.mock('vscode')
jest.mock('../../../utils/BitbakeSetupRegistryList', () => ({
  listBitbakeSetupRegistryConfigurations: jest.fn()
}))
jest.mock('../../../utils/BitbakeSetupWrynoseCompatibility', () => ({
  probeBitbakeSetupWrynoseConfigurations: jest.fn()
}))

describe('BitbakeSetupInitializationSelection', () => {
  const mockedList =
    listBitbakeSetupRegistryConfigurations as jest.MockedFunction<
    typeof listBitbakeSetupRegistryConfigurations
    >

  const mockedProbe =
    probeBitbakeSetupWrynoseConfigurations as jest.MockedFunction<
    typeof probeBitbakeSetupWrynoseConfigurations
    >

  beforeEach(() => {
    jest.clearAllMocks()

    for (const method of [
      'showOpenDialog',
      'showInputBox',
      'showQuickPick',
      'showErrorMessage'
    ] as const) {
      Object.defineProperty(vscode.window, method, {
        configurable: true,
        writable: true,
        value: jest.fn()
      })
    }

    Object.defineProperty(vscode.workspace, 'workspaceFolders', {
      configurable: true,
      value: undefined
    })
  })

  function mockDirectory (fsPath = '/workspace'): void {
    jest.mocked(vscode.window.showOpenDialog).mockResolvedValueOnce([
      { fsPath } as vscode.Uri
    ])
  }

  function mockRegistryList (): void {
    mockedList.mockResolvedValueOnce({
      kind: 'success',
      configurations: [
        {
          id: 'poky-wrynose',
          description: 'Poky Wrynose',
          expires: '2030-05-31'
        }
      ],
      stdout: '',
      stderr: ''
    })
  }

  function mockProbe (): void {
    mockedProbe.mockResolvedValueOnce({
      kind: 'success',
      configurations: [
        {
          name: 'poky',
          description: 'Poky',
          fragmentGroups: [
            {
              name: 'machine',
              description: 'Target machine',
              options: [
                {
                  name: 'machine/qemuarm64',
                  description: 'ARM64 QEMU'
                }
              ]
            },
            {
              name: 'distro',
              description: 'Target distro',
              options: [
                {
                  name: 'distro/poky',
                  description: 'Poky'
                }
              ]
            }
          ]
        }
      ],
      stdout: '',
      stderr: ''
    })
  }

  function mockSuccessfulQuickPicks (): void {
    jest.spyOn(vscode.window, 'showQuickPick')
      .mockImplementation(async (items) => {
        const values = await Promise.resolve(items)
        return Array.isArray(values) ? values[0] as never : undefined
      })
  }

  it('collects the complete initialization selection using the builtin registry', async () => {
    mockDirectory()
    jest.spyOn(vscode.window, 'showInputBox').mockResolvedValueOnce('')
    mockRegistryList()
    mockProbe()
    mockSuccessfulQuickPicks()

    const result = await collectBitbakeSetupInitializationSelection(
      '/opt/bin/bitbake-setup',
      '/tmp'
    )

    expect(result).toStrictEqual({
      directory: '/workspace',
      registry: undefined,
      registryConfiguration: 'poky-wrynose',
      configuration: 'poky',
      fragments: [
        'machine/qemuarm64',
        'distro/poky'
      ]
    })

    expect(mockedList).toHaveBeenCalledWith(
      '/opt/bin/bitbake-setup',
      '/tmp',
      undefined
    )

    expect(mockedProbe).toHaveBeenCalledWith(
      '/opt/bin/bitbake-setup',
      '/tmp',
      'poky-wrynose',
      undefined
    )
  })

  it('trims and preserves a custom registry through list and probe', async () => {
    mockDirectory()
    jest.spyOn(vscode.window, 'showInputBox').mockResolvedValueOnce(
      '  git://example/registry;protocol=https;branch=main;rev=main  '
    )
    mockRegistryList()
    mockProbe()
    mockSuccessfulQuickPicks()

    const result = await collectBitbakeSetupInitializationSelection(
      '/opt/bin/bitbake-setup',
      '/tmp'
    )

    const registry =
      'git://example/registry;protocol=https;branch=main;rev=main'

    expect(result?.registry).toBe(registry)

    expect(mockedList).toHaveBeenCalledWith(
      '/opt/bin/bitbake-setup',
      '/tmp',
      registry
    )

    expect(mockedProbe).toHaveBeenCalledWith(
      '/opt/bin/bitbake-setup',
      '/tmp',
      'poky-wrynose',
      registry
    )
  })

  it('uses the first workspace folder as the directory picker default', async () => {
    const workspaceUri = { fsPath: '/current-workspace' } as vscode.Uri

    Object.defineProperty(vscode.workspace, 'workspaceFolders', {
      configurable: true,
      value: [{ uri: workspaceUri }]
    })

    jest.mocked(vscode.window.showOpenDialog).mockResolvedValueOnce(undefined)

    await collectBitbakeSetupInitializationSelection(
      '/opt/bin/bitbake-setup',
      '/tmp'
    )

    expect(vscode.window.showOpenDialog).toHaveBeenCalledWith({
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false,
      defaultUri: workspaceUri,
      openLabel: 'Initialize workspace'
    })
  })

  it('returns undefined without listing when directory selection is cancelled', async () => {
    jest.mocked(vscode.window.showOpenDialog).mockResolvedValueOnce(undefined)

    const result = await collectBitbakeSetupInitializationSelection(
      '/opt/bin/bitbake-setup',
      '/tmp'
    )

    expect(result).toBeUndefined()
    expect(vscode.window.showInputBox).not.toHaveBeenCalled()
    expect(mockedList).not.toHaveBeenCalled()
  })

  it('returns undefined without listing when registry input is cancelled', async () => {
    mockDirectory()
    jest.spyOn(vscode.window, 'showInputBox').mockResolvedValueOnce(undefined)

    const result = await collectBitbakeSetupInitializationSelection(
      '/opt/bin/bitbake-setup',
      '/tmp'
    )

    expect(result).toBeUndefined()
    expect(mockedList).not.toHaveBeenCalled()
  })

  it('shows an error and returns undefined when registry listing fails', async () => {
    mockDirectory()
    jest.spyOn(vscode.window, 'showInputBox').mockResolvedValueOnce('')

    mockedList.mockResolvedValueOnce({
      kind: 'failure',
      reason: 'list-failed',
      exitCode: 2,
      stderr: 'registry failure'
    })

    const showErrorMessage =
      jest.spyOn(vscode.window, 'showErrorMessage').mockResolvedValue(undefined)

    const result = await collectBitbakeSetupInitializationSelection(
      '/opt/bin/bitbake-setup',
      '/tmp'
    )

    expect(result).toBeUndefined()
    expect(showErrorMessage).toHaveBeenCalledWith(
      'Failed to list bitbake-setup configuration templates: list-failed'
    )
    expect(mockedProbe).not.toHaveBeenCalled()
  })

  it('shows an error when registry listing returns no templates', async () => {
    mockDirectory()
    jest.spyOn(vscode.window, 'showInputBox').mockResolvedValueOnce('')

    mockedList.mockResolvedValueOnce({
      kind: 'success',
      configurations: [],
      stdout: '',
      stderr: ''
    })

    const showErrorMessage =
      jest.spyOn(vscode.window, 'showErrorMessage').mockResolvedValue(undefined)

    const result = await collectBitbakeSetupInitializationSelection(
      '/opt/bin/bitbake-setup',
      '/tmp'
    )

    expect(result).toBeUndefined()
    expect(showErrorMessage).toHaveBeenCalledWith(
      'bitbake-setup did not report any available configuration templates.'
    )
    expect(mockedProbe).not.toHaveBeenCalled()
  })

  it('returns undefined when the configuration template QuickPick is cancelled', async () => {
    mockDirectory()
    jest.spyOn(vscode.window, 'showInputBox').mockResolvedValueOnce('')
    mockRegistryList()
    jest.spyOn(vscode.window, 'showQuickPick').mockResolvedValueOnce(undefined)

    const result = await collectBitbakeSetupInitializationSelection(
      '/opt/bin/bitbake-setup',
      '/tmp'
    )

    expect(result).toBeUndefined()
    expect(mockedProbe).not.toHaveBeenCalled()
  })

  it('shows an error and returns undefined when the Wrynose probe fails', async () => {
    mockDirectory()
    jest.spyOn(vscode.window, 'showInputBox').mockResolvedValueOnce('')
    mockRegistryList()
    mockSuccessfulQuickPicks()

    mockedProbe.mockResolvedValueOnce({
      kind: 'failure',
      reason: 'missing-diagnostic-marker',
      exitCode: 1,
      stdout: 'unexpected output',
      stderr: ''
    })

    const showErrorMessage =
      jest.spyOn(vscode.window, 'showErrorMessage').mockResolvedValue(undefined)

    const result = await collectBitbakeSetupInitializationSelection(
      '/opt/bin/bitbake-setup',
      '/tmp'
    )

    expect(result).toBeUndefined()
    expect(showErrorMessage).toHaveBeenCalledWith(
      'Failed to inspect the selected bitbake-setup configuration template: missing-diagnostic-marker'
    )
  })

  it('returns undefined when the internal configuration QuickPick is cancelled', async () => {
    mockDirectory()
    jest.spyOn(vscode.window, 'showInputBox').mockResolvedValueOnce('')
    mockRegistryList()
    mockProbe()

    jest.spyOn(vscode.window, 'showQuickPick')
      .mockImplementationOnce(async (items) => {
        const values = await Promise.resolve(items)
        return Array.isArray(values) ? values[0] as never : undefined
      })
      .mockResolvedValueOnce(undefined)

    const result = await collectBitbakeSetupInitializationSelection(
      '/opt/bin/bitbake-setup',
      '/tmp'
    )

    expect(result).toBeUndefined()
  })

  it('returns undefined when a fragment QuickPick is cancelled', async () => {
    mockDirectory()
    jest.spyOn(vscode.window, 'showInputBox').mockResolvedValueOnce('')
    mockRegistryList()
    mockProbe()

    let call = 0
    jest.spyOn(vscode.window, 'showQuickPick')
      .mockImplementation(async (items) => {
        call++

        if (call === 3) {
          return undefined
        }

        const values = await Promise.resolve(items)
        return Array.isArray(values) ? values[0] as never : undefined
      })

    const result = await collectBitbakeSetupInitializationSelection(
      '/opt/bin/bitbake-setup',
      '/tmp'
    )

    expect(result).toBeUndefined()
  })
})
