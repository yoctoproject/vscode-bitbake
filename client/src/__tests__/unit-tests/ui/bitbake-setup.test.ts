/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2026 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import fs from 'fs'
import os from 'os'
import path from 'path'
import * as vscode from 'vscode'

import { BitbakeSetup } from '../../../ui/BitbakeSetup'
import { resolveBitbakeSetupExecutablePath } from '../../../ui/BitbakeSetupAvailability'
import { runRawProcessTerminal } from '../../../ui/BitbakeTerminal'
import {
  listBitbakeSetupRegistryConfigurations
} from '../../../utils/BitbakeSetupRegistryList'
import {
  probeBitbakeSetupWrynoseConfigurations
} from '../../../utils/BitbakeSetupWrynoseCompatibility'

jest.mock('vscode')
jest.mock('../../../ui/BitbakeSetupAvailability')
jest.mock('../../../ui/BitbakeTerminal')
jest.mock('../../../utils/BitbakeSetupRegistryList', () => ({
  listBitbakeSetupRegistryConfigurations: jest.fn()
}))
jest.mock('../../../utils/BitbakeSetupWrynoseCompatibility', () => ({
  probeBitbakeSetupWrynoseConfigurations: jest.fn()
}))

describe('BitbakeSetup', () => {
  const executablePath = '/usr/bin/bitbake-setup'
  const globalStoragePath = '/extension/storage'
  const tempRoots: string[] = []

  const mockedResolve =
    resolveBitbakeSetupExecutablePath as jest.MockedFunction<
    typeof resolveBitbakeSetupExecutablePath
    >

  const mockedRun =
    runRawProcessTerminal as jest.MockedFunction<
    typeof runRawProcessTerminal
    >

  const mockedList =
    listBitbakeSetupRegistryConfigurations as jest.MockedFunction<
    typeof listBitbakeSetupRegistryConfigurations
    >

  const mockedProbe =
    probeBitbakeSetupWrynoseConfigurations as jest.MockedFunction<
    typeof probeBitbakeSetupWrynoseConfigurations
    >

  beforeEach(() => {
    jest.restoreAllMocks()
    jest.clearAllMocks()

    for (const method of [
      'showOpenDialog',
      'showInputBox',
      'showQuickPick',
      'showErrorMessage',
      'showInformationMessage',
      'showWarningMessage'
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

    mockedResolve.mockResolvedValue(executablePath)
    mockedList.mockResolvedValue([
      {
        id: 'poky-wrynose',
        description: 'Poky Wrynose',
        expires: '2030-05-31'
      }
    ])
    mockedProbe.mockResolvedValue([
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
    ])
    mockedRun.mockResolvedValue({
      exitCode: 0,
      output: 'human-readable output is ignored'
    })
    jest.spyOn(fs, 'statSync').mockReturnValue({
      isFile: () => true
    } as fs.Stats)
    jest.mocked(vscode.window.showInformationMessage).mockResolvedValue(
      undefined
    )
  })

  afterEach(() => {
    jest.restoreAllMocks()

    while (tempRoots.length > 0) {
      const tempRoot = tempRoots.pop()

      if (tempRoot !== undefined) {
        fs.rmSync(tempRoot, {
          recursive: true,
          force: true
        })
      }
    }
  })

  function createTempDirectory (): string {
    const directory = fs.mkdtempSync(
      path.join(os.tmpdir(), 'bitbake-setup-')
    )

    tempRoots.push(directory)
    return directory
  }

  function createContext (): vscode.ExtensionContext {
    return {
      globalStorageUri: {
        fsPath: globalStoragePath
      }
    } as unknown as vscode.ExtensionContext
  }

  async function initialize (): Promise<void> {
    await new BitbakeSetup(createContext()).initializeWorkspace()
  }

  function mockDirectory (fsPath: string): void {
    jest.mocked(vscode.window.showOpenDialog).mockResolvedValueOnce([
      { fsPath } as vscode.Uri
    ])
  }

  function mockRegistry (value = ''): void {
    jest.mocked(vscode.window.showInputBox).mockResolvedValueOnce(value)
  }

  function mockSuccessfulQuickPicks (): void {
    jest.mocked(vscode.window.showQuickPick).mockImplementation(
      async (items) => {
        const values = await Promise.resolve(items)
        return Array.isArray(values) ? values[0] as never : undefined
      }
    )
  }

  function mockSuccessfulSelection (directory: string): void {
    mockDirectory(directory)
    mockRegistry()
    mockSuccessfulQuickPicks()
    mockedRun.mockResolvedValue({
      exitCode: 0,
      output: 'arbitrary bitbake-setup output'
    })
  }

  function expectedArgv (directory: string): string[] {
    return [
      '--setting',
      'default',
      'top-dir-prefix',
      path.dirname(directory),
      '--setting',
      'default',
      'top-dir-name',
      path.basename(directory),
      'init',
      '--non-interactive',
      '--init-vscode',
      'poky-wrynose',
      'poky',
      'machine/qemuarm64',
      'distro/poky'
    ]
  }

  it('runs the complete initialization flow', async () => {
    const directory = createTempDirectory()
    mockSuccessfulSelection(directory)

    await initialize()

    expect(mockedResolve).toHaveBeenCalledWith(
      expect.objectContaining({
        globalStorageUri: expect.objectContaining({
          fsPath: globalStoragePath
        })
      })
    )
    expect(vscode.window.showOpenDialog).toHaveBeenCalledWith({
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false,
      defaultUri: undefined,
      openLabel: 'Initialize workspace'
    })
    expect(mockedList).toHaveBeenCalledWith(
      executablePath,
      globalStoragePath,
      undefined
    )
    expect(mockedProbe).toHaveBeenCalledWith(
      executablePath,
      globalStoragePath,
      'poky-wrynose',
      undefined
    )
    expect(mockedRun).toHaveBeenCalledWith(
      executablePath,
      expectedArgv(directory),
      path.dirname(directory),
      'BitBake: Initialize workspace with bitbake-setup'
    )
    expect(fs.statSync).toHaveBeenCalledWith(
      path.join(directory, 'bitbake.code-workspace')
    )
    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
      'bitbake-setup workspace initialized successfully.',
      'Open Workspace'
    )
  })

  it('maps top-dir-prefix and top-dir-name exactly to the selected directory', async () => {
    const directory = path.join(createTempDirectory(), 'selected-workspace')
    mockSuccessfulSelection(directory)

    await initialize()

    expect(mockedRun.mock.calls[0][1]).toEqual(expectedArgv(directory))
  })

  it('adds a custom registry only to the init invocation in the expected order', async () => {
    const directory = createTempDirectory()
    mockDirectory(directory)
    mockRegistry('  /registries/custom.json  ')
    mockSuccessfulQuickPicks()

    await initialize()

    expect(mockedList).toHaveBeenCalledWith(
      executablePath,
      globalStoragePath,
      '/registries/custom.json'
    )
    expect(mockedProbe).toHaveBeenCalledWith(
      executablePath,
      globalStoragePath,
      'poky-wrynose',
      '/registries/custom.json'
    )
    expect(mockedRun.mock.calls[0][1]).toEqual([
      '--setting',
      'default',
      'top-dir-prefix',
      path.dirname(directory),
      '--setting',
      'default',
      'top-dir-name',
      path.basename(directory),
      '--setting',
      'default',
      'registry',
      '/registries/custom.json',
      'init',
      '--non-interactive',
      '--init-vscode',
      'poky-wrynose',
      'poky',
      'machine/qemuarm64',
      'distro/poky'
    ])
  })

  it('preserves selected fragment ordering in the init invocation', async () => {
    const directory = createTempDirectory()
    mockDirectory(directory)
    mockRegistry()
    mockedProbe.mockResolvedValueOnce([
      {
        name: 'poky',
        description: 'Poky',
        fragmentGroups: [
          {
            name: 'machine',
            description: 'Target machine',
            options: [
              {
                name: 'machine/beaglebone-yocto',
                description: 'BeagleBone'
              },
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
                name: 'distro/poky-altcfg',
                description: 'Poky alternate'
              },
              {
                name: 'distro/poky',
                description: 'Poky'
              }
            ]
          }
        ]
      }
    ])
    let call = 0
    jest.mocked(vscode.window.showQuickPick).mockImplementation(
      async (items) => {
        call++
        const values = await Promise.resolve(items)

        if (!Array.isArray(values)) {
          return undefined
        }

        return values[call >= 3 ? 1 : 0] as never
      }
    )

    await initialize()

    expect(mockedRun.mock.calls[0][1].slice(-2)).toEqual([
      'machine/qemuarm64',
      'distro/poky'
    ])
  })

  it('stops when bitbake-setup is unavailable', async () => {
    mockedResolve.mockResolvedValue(undefined)

    await initialize()

    expect(vscode.window.showOpenDialog).not.toHaveBeenCalled()
    expect(mockedRun).not.toHaveBeenCalled()
  })

  it('stops when directory selection is cancelled', async () => {
    jest.mocked(vscode.window.showOpenDialog).mockResolvedValueOnce(undefined)

    await initialize()

    expect(vscode.window.showInputBox).not.toHaveBeenCalled()
    expect(mockedList).not.toHaveBeenCalled()
    expect(mockedRun).not.toHaveBeenCalled()
  })

  it('stops when registry input is cancelled', async () => {
    mockDirectory(createTempDirectory())
    jest.mocked(vscode.window.showInputBox).mockResolvedValueOnce(undefined)

    await initialize()

    expect(mockedList).not.toHaveBeenCalled()
    expect(mockedRun).not.toHaveBeenCalled()
  })

  it('shows an error and stops when registry listing fails', async () => {
    mockDirectory(createTempDirectory())
    mockRegistry()
    mockedList.mockRejectedValueOnce(
      new Error('bitbake-setup registry list failed with exit code 2')
    )

    await initialize()

    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
      'Failed to list bitbake-setup configuration templates: bitbake-setup registry list failed with exit code 2'
    )
    expect(mockedProbe).not.toHaveBeenCalled()
    expect(mockedRun).not.toHaveBeenCalled()
  })

  it('stops when the template picker is cancelled', async () => {
    mockDirectory(createTempDirectory())
    mockRegistry()
    jest.mocked(vscode.window.showQuickPick).mockResolvedValueOnce(undefined)

    await initialize()

    expect(mockedProbe).not.toHaveBeenCalled()
    expect(mockedRun).not.toHaveBeenCalled()
  })

  it('shows an error and stops when the Wrynose probe fails', async () => {
    mockDirectory(createTempDirectory())
    mockRegistry()
    mockSuccessfulQuickPicks()
    mockedProbe.mockRejectedValueOnce(
      new Error('missing expected configurations marker')
    )

    await initialize()

    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
      'Failed to inspect the selected bitbake-setup configuration template: missing expected configurations marker'
    )
    expect(mockedRun).not.toHaveBeenCalled()
  })

  it('stops when the configuration picker is cancelled', async () => {
    mockDirectory(createTempDirectory())
    mockRegistry()
    jest.mocked(vscode.window.showQuickPick)
      .mockImplementationOnce(async (items) => {
        const values = await Promise.resolve(items)
        return Array.isArray(values) ? values[0] as never : undefined
      })
      .mockResolvedValueOnce(undefined)

    await initialize()

    expect(mockedRun).not.toHaveBeenCalled()
  })

  it('stops when a fragment picker is cancelled', async () => {
    mockDirectory(createTempDirectory())
    mockRegistry()

    let call = 0
    jest.mocked(vscode.window.showQuickPick).mockImplementation(
      async (items) => {
        call++

        if (call === 3) {
          return undefined
        }

        const values = await Promise.resolve(items)
        return Array.isArray(values) ? values[0] as never : undefined
      }
    )

    await initialize()

    expect(mockedRun).not.toHaveBeenCalled()
  })

  it('proceeds without warning for an empty directory', async () => {
    const directory = createTempDirectory()
    mockSuccessfulSelection(directory)

    await initialize()

    expect(vscode.window.showWarningMessage).not.toHaveBeenCalled()
    expect(mockedRun).toHaveBeenCalled()
  })

  it('proceeds without warning for a nonexistent directory', async () => {
    const root = createTempDirectory()
    const directory = path.join(root, 'new-workspace')
    mockSuccessfulSelection(directory)

    await initialize()

    expect(vscode.window.showWarningMessage).not.toHaveBeenCalled()
    expect(mockedRun).toHaveBeenCalled()
  })

  it('requires Continue for a non-empty directory', async () => {
    const directory = createTempDirectory()
    fs.writeFileSync(path.join(directory, 'README.md'), 'existing content\n')
    mockSuccessfulSelection(directory)
    jest.mocked(vscode.window.showWarningMessage).mockResolvedValueOnce(
      'Continue' as never
    )

    await initialize()

    expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
      'The selected directory is not empty. bitbake-setup may create or modify files in it. Continue?',
      { modal: true },
      'Continue',
      'Cancel'
    )
    expect(mockedRun).toHaveBeenCalled()
  })

  it('uses the generic warning for directories with bitbake-setup workspace files', async () => {
    const directory = createTempDirectory()
    fs.mkdirSync(path.join(directory, 'build'), { recursive: true })
    fs.writeFileSync(path.join(directory, 'build', 'init-build-env'), '')
    fs.mkdirSync(path.join(directory, 'layers'))
    fs.mkdirSync(path.join(directory, 'config'))
    fs.writeFileSync(path.join(directory, 'bitbake.code-workspace'), '{}')
    mockSuccessfulSelection(directory)
    jest.mocked(vscode.window.showWarningMessage).mockResolvedValueOnce(
      'Continue' as never
    )

    await initialize()

    expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
      'The selected directory is not empty. bitbake-setup may create or modify files in it. Continue?',
      { modal: true },
      'Continue',
      'Cancel'
    )
    expect(mockedRun).toHaveBeenCalled()
  })

  it('stops before init when non-empty directory confirmation is cancelled', async () => {
    const directory = createTempDirectory()
    fs.writeFileSync(path.join(directory, 'README.md'), 'existing content\n')
    mockSuccessfulSelection(directory)
    jest.mocked(vscode.window.showWarningMessage).mockResolvedValueOnce(
      'Cancel' as never
    )

    await initialize()

    expect(mockedRun).not.toHaveBeenCalled()
  })

  it('reports a directory inspection error as a preparation failure', async () => {
    const directory = createTempDirectory()
    mockSuccessfulSelection(directory)
    jest.spyOn(fs.promises, 'readdir').mockRejectedValueOnce(
      new Error('permission denied')
    )

    await initialize()

    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
      'Failed to prepare bitbake-setup initialization: permission denied'
    )
    expect(mockedRun).not.toHaveBeenCalled()
  })

  it('rejects a filesystem root before invoking bitbake-setup init', async () => {
    mockSuccessfulSelection(path.parse(process.cwd()).root)
    jest.mocked(vscode.window.showWarningMessage).mockResolvedValueOnce(
      'Continue' as never
    )

    await initialize()

    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
      'Failed to prepare bitbake-setup initialization: The bitbake-setup initialization directory must not be a filesystem root.'
    )
    expect(mockedRun).not.toHaveBeenCalled()
  })

  it('reports a terminal startup failure', async () => {
    const directory = createTempDirectory()
    mockSuccessfulSelection(directory)
    mockedRun.mockRejectedValue(new Error('pty failed'))

    await initialize()

    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
      'Failed to start bitbake-setup: pty failed'
    )
    expect(fs.statSync).not.toHaveBeenCalled()
    expect(vscode.window.showInformationMessage).not.toHaveBeenCalled()
  })

  it('reports a nonzero bitbake-setup exit code', async () => {
    const directory = createTempDirectory()
    mockSuccessfulSelection(directory)
    mockedRun.mockResolvedValue({
      exitCode: 2,
      output: 'init failed'
    })

    await initialize()

    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
      'bitbake-setup initialization failed with exit code 2. See terminal output for details.'
    )
    expect(fs.statSync).not.toHaveBeenCalled()
    expect(vscode.window.showInformationMessage).not.toHaveBeenCalled()
  })

  it('ignores arbitrary stdout when checking the successful postcondition', async () => {
    const directory = createTempDirectory()
    mockSuccessfulSelection(directory)
    mockedRun.mockResolvedValue({
      exitCode: 0,
      output: [
        'completed without any parseable setup path',
        `this unrelated path is ignored: ${path.join(path.dirname(directory), 'unrelated')}`
      ].join('\n')
    })

    await initialize()

    expect(fs.statSync).toHaveBeenCalledWith(
      path.join(directory, 'bitbake.code-workspace')
    )
    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
      'bitbake-setup workspace initialized successfully.',
      'Open Workspace'
    )
  })

  it('reports a missing generated workspace file', async () => {
    const directory = createTempDirectory()
    mockSuccessfulSelection(directory)
    jest.mocked(fs.statSync).mockImplementationOnce(() => {
      throw Object.assign(new Error('missing'), { code: 'ENOENT' })
    })

    await initialize()

    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
      `bitbake-setup completed successfully but did not generate the expected workspace file: ${path.join(directory, 'bitbake.code-workspace')}`
    )
    expect(vscode.window.showInformationMessage).not.toHaveBeenCalled()
  })

  it('reports a non-file generated workspace path', async () => {
    const directory = createTempDirectory()
    mockSuccessfulSelection(directory)
    jest.mocked(fs.statSync).mockReturnValueOnce({
      isFile: () => false
    } as fs.Stats)

    await initialize()

    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
      `bitbake-setup completed successfully but did not generate the expected workspace file: ${path.join(directory, 'bitbake.code-workspace')}`
    )
    expect(vscode.window.showInformationMessage).not.toHaveBeenCalled()
  })

  it('opens the generated workspace in a new window when requested', async () => {
    const directory = createTempDirectory()
    mockSuccessfulSelection(directory)
    jest.mocked(vscode.window.showInformationMessage).mockResolvedValueOnce(
      'Open Workspace' as never
    )

    await initialize()

    expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
      'vscode.openFolder',
      path.join(directory, 'bitbake.code-workspace'),
      { forceNewWindow: true }
    )
  })

  it('does not open the workspace when the success message is dismissed', async () => {
    const directory = createTempDirectory()
    mockSuccessfulSelection(directory)

    await initialize()

    expect(vscode.commands.executeCommand).not.toHaveBeenCalled()
  })
})
