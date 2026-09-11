/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2026 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import fs from 'fs'
import path from 'path'
import * as vscode from 'vscode'

import { initializeWorkspaceWithBitbakeSetup } from '../../../ui/BitbakeSetupInitialization'
import { resolveBitbakeSetupExecutablePath } from '../../../ui/BitbakeSetupAvailability'
import { collectBitbakeSetupInitializationSelection } from '../../../ui/BitbakeSetupInitializationSelection'
import { confirmBitbakeSetupInitialization } from '../../../ui/BitbakeSetupInitializationGuard'
import { runBitbakeSetupTerminal } from '../../../ui/BitbakeSetupTerminal'
import { buildBitbakeSetupInitArguments } from '../../../utils/BitbakeSetupInitArguments'

jest.mock('vscode')
jest.mock('../../../ui/BitbakeSetupAvailability')
jest.mock('../../../ui/BitbakeSetupInitializationSelection')
jest.mock('../../../ui/BitbakeSetupInitializationGuard')
jest.mock('../../../ui/BitbakeSetupTerminal')
jest.mock('../../../utils/BitbakeSetupInitArguments')
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn()
}))

describe('BitbakeSetupInitialization', () => {
  const executablePath = '/usr/bin/bitbake-setup'
  const directory = '/workspaces/poky'
  const globalStoragePath = '/extension/storage'

  const selection = {
    directory,
    registry: undefined,
    registryConfiguration: 'poky-wrynose',
    configuration: 'poky',
    fragments: [
      'machine/qemuarm64',
      'distro/poky'
    ]
  }

  const argv = [
    '--setting',
    'default',
    'top-dir-prefix',
    '/workspaces',
    '--setting',
    'default',
    'top-dir-name',
    '.',
    'init',
    '--non-interactive',
    '--setup-dir-name',
    'poky',
    '--init-vscode',
    'poky-wrynose',
    'poky',
    'machine/qemuarm64',
    'distro/poky'
  ]

  const mockedResolve =
    resolveBitbakeSetupExecutablePath as jest.MockedFunction<
    typeof resolveBitbakeSetupExecutablePath
    >

  const mockedCollect =
    collectBitbakeSetupInitializationSelection as jest.MockedFunction<
    typeof collectBitbakeSetupInitializationSelection
    >

  const mockedConfirm =
    confirmBitbakeSetupInitialization as jest.MockedFunction<
    typeof confirmBitbakeSetupInitialization
    >

  const mockedRun =
    runBitbakeSetupTerminal as jest.MockedFunction<
    typeof runBitbakeSetupTerminal
    >

  const mockedBuild =
    buildBitbakeSetupInitArguments as jest.MockedFunction<
    typeof buildBitbakeSetupInitArguments
    >

  const mockedExistsSync = fs.existsSync as jest.MockedFunction<
  typeof fs.existsSync
  >

  function createContext (): vscode.ExtensionContext {
    return {
      globalStorageUri: {
        fsPath: globalStoragePath
      }
    } as unknown as vscode.ExtensionContext
  }

  beforeEach(() => {
    jest.clearAllMocks()

    mockedResolve.mockResolvedValue(executablePath)
    mockedCollect.mockResolvedValue(selection)
    mockedConfirm.mockResolvedValue(true)
    mockedBuild.mockReturnValue(argv)
    mockedRun.mockResolvedValue({
      exitCode: 0,
      output: 'Initializing a setup directory in\n    /workspaces/poky/poky-wrynose\n'
    })
    mockedExistsSync.mockReturnValue(true)

    jest.spyOn(
      vscode.window,
      'showInformationMessage'
    ).mockResolvedValue(undefined)
  })

  it('runs the complete initialization flow', async () => {
    await initializeWorkspaceWithBitbakeSetup(createContext())

    expect(mockedResolve).toHaveBeenCalledWith(
      expect.objectContaining({
        globalStorageUri: expect.objectContaining({
          fsPath: globalStoragePath
        })
      })
    )

    expect(mockedCollect).toHaveBeenCalledWith(
      executablePath,
      globalStoragePath
    )

    expect(mockedConfirm).toHaveBeenCalledWith(directory)

    expect(mockedBuild).toHaveBeenCalledWith({
      ...selection,
      initializeVsCode: true
    })

    expect(mockedRun).toHaveBeenCalledWith(
      executablePath,
      argv,
      '/workspaces'
    )

    expect(mockedExistsSync).toHaveBeenCalledWith(
      path.join('/workspaces/poky/poky-wrynose', 'bitbake.code-workspace')
    )

    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
      'bitbake-setup workspace initialized successfully.',
      'Open Workspace'
    )
  })

  it('stops when bitbake-setup is unavailable', async () => {
    mockedResolve.mockResolvedValue(undefined)

    await initializeWorkspaceWithBitbakeSetup(createContext())

    expect(mockedCollect).not.toHaveBeenCalled()
    expect(mockedConfirm).not.toHaveBeenCalled()
    expect(mockedBuild).not.toHaveBeenCalled()
    expect(mockedRun).not.toHaveBeenCalled()
  })

  it('stops when selection is cancelled', async () => {
    mockedCollect.mockResolvedValue(undefined)

    await initializeWorkspaceWithBitbakeSetup(createContext())

    expect(mockedConfirm).not.toHaveBeenCalled()
    expect(mockedBuild).not.toHaveBeenCalled()
    expect(mockedRun).not.toHaveBeenCalled()
  })

  it('stops when target confirmation is declined', async () => {
    mockedConfirm.mockResolvedValue(false)

    await initializeWorkspaceWithBitbakeSetup(createContext())

    expect(mockedBuild).not.toHaveBeenCalled()
    expect(mockedRun).not.toHaveBeenCalled()
  })

  it('reports a target inspection failure', async () => {
    mockedConfirm.mockRejectedValue(new Error('permission denied'))

    await initializeWorkspaceWithBitbakeSetup(createContext())

    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
      'Failed to prepare bitbake-setup initialization: permission denied'
    )
    expect(mockedBuild).not.toHaveBeenCalled()
    expect(mockedRun).not.toHaveBeenCalled()
  })

  it('reports an init argument construction failure', async () => {
    mockedBuild.mockImplementation(() => {
      throw new Error('invalid initialization directory')
    })

    await initializeWorkspaceWithBitbakeSetup(createContext())

    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
      'Failed to prepare bitbake-setup initialization: invalid initialization directory'
    )
    expect(mockedRun).not.toHaveBeenCalled()
  })

  it('rejects an initialized directory outside the selected directory', async () => {
    mockedRun.mockResolvedValue({
      exitCode: 0,
      output: 'Initializing a setup directory in\n    /workspaces/unrelated\n'
    })

    await initializeWorkspaceWithBitbakeSetup(createContext())

    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
      'bitbake-setup reported an initialized setup directory outside the selected directory: /workspaces/unrelated'
    )
    expect(mockedExistsSync).not.toHaveBeenCalled()
    expect(vscode.window.showInformationMessage).not.toHaveBeenCalled()
  })

  it('reports a terminal startup failure', async () => {
    mockedRun.mockRejectedValue(new Error('pty failed'))

    await initializeWorkspaceWithBitbakeSetup(createContext())

    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
      'Failed to start bitbake-setup: pty failed'
    )
    expect(mockedExistsSync).not.toHaveBeenCalled()
    expect(vscode.window.showInformationMessage).not.toHaveBeenCalled()
  })

  it('reports a nonzero bitbake-setup exit code', async () => {
    mockedRun.mockResolvedValue({
      exitCode: 2,
      output: 'init failed'
    })

    await initializeWorkspaceWithBitbakeSetup(createContext())

    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
      'bitbake-setup initialization failed with exit code 2. See terminal output for details.'
    )
    expect(mockedExistsSync).not.toHaveBeenCalled()
    expect(vscode.window.showInformationMessage).not.toHaveBeenCalled()
  })

  it('reports success without a setup directory as an error', async () => {
    mockedRun.mockResolvedValue({
      exitCode: 0,
      output: 'completed without setup path'
    })

    await initializeWorkspaceWithBitbakeSetup(createContext())

    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
      'bitbake-setup completed successfully but did not report the initialized setup directory.'
    )
    expect(mockedExistsSync).not.toHaveBeenCalled()
    expect(vscode.window.showInformationMessage).not.toHaveBeenCalled()
  })

  it('reports a missing generated workspace file', async () => {
    mockedExistsSync.mockReturnValue(false)

    await initializeWorkspaceWithBitbakeSetup(createContext())

    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
      `bitbake-setup completed successfully but did not generate the expected workspace file: ${path.join('/workspaces/poky/poky-wrynose', 'bitbake.code-workspace')}`
    )
    expect(vscode.window.showInformationMessage).not.toHaveBeenCalled()
  })

  it('opens the generated workspace in a new window when requested', async () => {
    jest.spyOn(
      vscode.window,
      'showInformationMessage'
    ).mockResolvedValue('Open Workspace' as never)

    await initializeWorkspaceWithBitbakeSetup(createContext())

    expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
      'vscode.openFolder',
      vscode.Uri.file(
        path.join('/workspaces/poky/poky-wrynose', 'bitbake.code-workspace')
      ),
      { forceNewWindow: true }
    )
  })

  it('does not open the workspace when the success message is dismissed', async () => {
    await initializeWorkspaceWithBitbakeSetup(createContext())

    expect(vscode.commands.executeCommand).not.toHaveBeenCalled()
  })
})
