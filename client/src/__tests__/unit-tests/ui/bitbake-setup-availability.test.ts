/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import fs from 'fs'
import os from 'os'
import path from 'path'
import * as vscode from 'vscode'

import { resolveBitbakeSetupExecutablePath } from '../../../ui/BitbakeSetupAvailability'
import { installBitbakeSetup } from '../../../ui/BitbakeSetupInstaller'
import { mockVscodeExtensionContext } from '../../utils/vscodeMock'

jest.mock('vscode')
jest.mock('../../../ui/BitbakeSetupInstaller', () => ({
  getManagedBitbakeSetupExecutablePath: jest.fn((context: { globalStorageUri: { fsPath: string } }) => {
    const pathModule = jest.requireActual<typeof import('path')>('path')
    return pathModule.join(context.globalStorageUri.fsPath, 'bitbake-setup', 'bin', 'bitbake-setup')
  }),
  installBitbakeSetup: jest.fn()
}))

describe('BitbakeSetupAvailability', () => {
  const tempRoots: string[] = []
  const originalPath = process.env.PATH
  const mockedInstall = installBitbakeSetup as jest.MockedFunction<typeof installBitbakeSetup>

  beforeEach(() => {
    jest.clearAllMocks()
    process.env.PATH = originalPath
  })

  afterEach(() => {
    while (tempRoots.length > 0) {
      const tempRoot = tempRoots.pop()
      if (tempRoot !== undefined) {
        fs.rmSync(tempRoot, { recursive: true, force: true })
      }
    }

    process.env.PATH = originalPath
  })

  function createTempRoot (): string {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bitbake-setup-availability-'))
    tempRoots.push(tempRoot)
    return tempRoot
  }

  function createExecutableFile (filePath: string): void {
    fs.mkdirSync(path.dirname(filePath), { recursive: true })
    fs.writeFileSync(filePath, '#!/bin/sh\nexit 0\n')
    fs.chmodSync(filePath, 0o755)
  }

  function mockBitbakeSetupPath (bitbakeSetupPath: string | undefined): void {
    jest.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue({
      get: jest.fn().mockReturnValue(bitbakeSetupPath)
    } as unknown as vscode.WorkspaceConfiguration)
  }

  function createExtensionContext (): vscode.ExtensionContext {
    const context = mockVscodeExtensionContext()
    context.globalStorageUri.fsPath = createTempRoot()
    return context
  }

  function managedExecutablePath (context: vscode.ExtensionContext): string {
    return path.join(context.globalStorageUri.fsPath, 'bitbake-setup', 'bin', 'bitbake-setup')
  }

  it('returns a configured executable path when the configured executable resolves', async () => {
    const tempRoot = createTempRoot()
    const configuredPath = path.join(tempRoot, 'configured', 'bitbake-setup')
    createExecutableFile(configuredPath)
    mockBitbakeSetupPath(configuredPath)

    const result = await resolveBitbakeSetupExecutablePath(createExtensionContext())

    expect(vscode.workspace.getConfiguration).toHaveBeenCalledWith('bitbake')
    expect(result).toBe(configuredPath)
    expect(vscode.window.showErrorMessage).not.toHaveBeenCalled()
    expect(vscode.window.showWarningMessage).not.toHaveBeenCalled()
    expect(vscode.commands.executeCommand).not.toHaveBeenCalled()
    expect(mockedInstall).not.toHaveBeenCalled()
  })

  it('delegates to the installer when the configured executable is the exact managed executable path', async () => {
    const context = createExtensionContext()
    const configuredPath = managedExecutablePath(context)
    const installedPath = path.join(context.globalStorageUri.fsPath, 'replacement', 'bin', 'bitbake-setup')
    createExecutableFile(configuredPath)
    mockBitbakeSetupPath(configuredPath)
    mockedInstall.mockResolvedValue(installedPath)

    const result = await resolveBitbakeSetupExecutablePath(context)

    expect(mockedInstall).toHaveBeenCalledTimes(1)
    expect(mockedInstall).toHaveBeenCalledWith(context)
    expect(result).toBe(installedPath)
    expect(vscode.window.showErrorMessage).not.toHaveBeenCalled()
    expect(vscode.window.showWarningMessage).not.toHaveBeenCalled()
    expect(vscode.commands.executeCommand).not.toHaveBeenCalled()
  })

  it('returns undefined when managed configured-path migration install fails', async () => {
    const context = createExtensionContext()
    const configuredPath = managedExecutablePath(context)
    createExecutableFile(configuredPath)
    mockBitbakeSetupPath(configuredPath)
    mockedInstall.mockResolvedValue(undefined)

    const result = await resolveBitbakeSetupExecutablePath(context)

    expect(mockedInstall).toHaveBeenCalledTimes(1)
    expect(mockedInstall).toHaveBeenCalledWith(context)
    expect(result).toBeUndefined()
    expect(vscode.window.showErrorMessage).not.toHaveBeenCalled()
    expect(vscode.window.showWarningMessage).not.toHaveBeenCalled()
    expect(vscode.commands.executeCommand).not.toHaveBeenCalled()
  })

  it('returns a PATH executable when discovery resolves from PATH', async () => {
    const tempRoot = createTempRoot()
    const pathEntry = path.join(tempRoot, 'bin')
    const executablePath = path.join(pathEntry, 'bitbake-setup')
    createExecutableFile(executablePath)
    mockBitbakeSetupPath(undefined)
    process.env.PATH = pathEntry

    const result = await resolveBitbakeSetupExecutablePath(createExtensionContext())

    expect(result).toBe(executablePath)
    expect(vscode.window.showErrorMessage).not.toHaveBeenCalled()
    expect(vscode.window.showWarningMessage).not.toHaveBeenCalled()
    expect(vscode.commands.executeCommand).not.toHaveBeenCalled()
    expect(mockedInstall).not.toHaveBeenCalled()
  })

  it('shows an error and returns undefined when the configured path is invalid', async () => {
    const tempRoot = createTempRoot()
    const configuredPath = path.join(tempRoot, 'configured', 'bitbake-setup')
    mockBitbakeSetupPath(configuredPath)

    const showErrorMessage = jest.spyOn(vscode.window, 'showErrorMessage').mockResolvedValue(undefined)

    const result = await resolveBitbakeSetupExecutablePath(createExtensionContext())

    expect(showErrorMessage).toHaveBeenCalledWith(
      `The configured bitbake-setup path is invalid: ${configuredPath}`,
      'Open Settings'
    )
    expect(result).toBeUndefined()
    expect(vscode.window.showWarningMessage).not.toHaveBeenCalled()
    expect(vscode.commands.executeCommand).not.toHaveBeenCalled()
    expect(mockedInstall).not.toHaveBeenCalled()
  })

  it('does not fall back to PATH when the configured path is invalid', async () => {
    const tempRoot = createTempRoot()
    const configuredPath = path.join(tempRoot, 'configured', 'bitbake-setup')
    const pathEntry = path.join(tempRoot, 'bin')
    const executablePath = path.join(pathEntry, 'bitbake-setup')
    createExecutableFile(executablePath)
    mockBitbakeSetupPath(configuredPath)
    process.env.PATH = pathEntry

    jest.spyOn(vscode.window, 'showErrorMessage').mockResolvedValue(undefined)

    const result = await resolveBitbakeSetupExecutablePath(createExtensionContext())

    expect(result).toBeUndefined()
    expect(vscode.window.showErrorMessage).toHaveBeenCalled()
    expect(vscode.window.showWarningMessage).not.toHaveBeenCalled()
    expect(vscode.commands.executeCommand).not.toHaveBeenCalled()
    expect(mockedInstall).not.toHaveBeenCalled()
  })

  it('opens settings for an invalid configured path when requested', async () => {
    const tempRoot = createTempRoot()
    const configuredPath = path.join(tempRoot, 'configured', 'bitbake-setup')
    mockBitbakeSetupPath(configuredPath)

    const showErrorMessage = jest.spyOn(vscode.window, 'showErrorMessage').mockResolvedValue('Open Settings' as never)

    const result = await resolveBitbakeSetupExecutablePath(createExtensionContext())

    expect(showErrorMessage).toHaveBeenCalledWith(
      `The configured bitbake-setup path is invalid: ${configuredPath}`,
      'Open Settings'
    )
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
      'workbench.action.openSettings',
      'bitbake.bitbakeSetupPath'
    )
    expect(result).toBeUndefined()
    expect(mockedInstall).not.toHaveBeenCalled()
  })

  it('offers install and open settings when bitbake-setup is missing', async () => {
    mockBitbakeSetupPath(undefined)
    process.env.PATH = ''

    const showWarningMessage = jest.spyOn(vscode.window, 'showWarningMessage').mockResolvedValue(undefined)

    const result = await resolveBitbakeSetupExecutablePath(createExtensionContext())

    expect(showWarningMessage).toHaveBeenCalledWith(
      'bitbake-setup was not found in PATH and no explicit bitbake.bitbakeSetupPath is configured.',
      'Install',
      'Open Settings'
    )
    expect(result).toBeUndefined()
    expect(vscode.window.showErrorMessage).not.toHaveBeenCalled()
    expect(vscode.commands.executeCommand).not.toHaveBeenCalled()
    expect(mockedInstall).not.toHaveBeenCalled()
  })

  it('returns the installed executable path when install succeeds', async () => {
    mockBitbakeSetupPath(undefined)
    process.env.PATH = ''
    const installedPath = path.join(createTempRoot(), 'bitbake-setup', 'bin', 'bitbake-setup')
    mockedInstall.mockResolvedValue(installedPath)

    const showWarningMessage = jest.spyOn(vscode.window, 'showWarningMessage').mockResolvedValue('Install' as never)

    const result = await resolveBitbakeSetupExecutablePath(createExtensionContext())

    expect(showWarningMessage).toHaveBeenCalledWith(
      'bitbake-setup was not found in PATH and no explicit bitbake.bitbakeSetupPath is configured.',
      'Install',
      'Open Settings'
    )
    expect(mockedInstall).toHaveBeenCalledTimes(1)
    expect(result).toBe(installedPath)
    expect(vscode.commands.executeCommand).not.toHaveBeenCalled()
  })

  it('returns undefined when install fails', async () => {
    mockBitbakeSetupPath(undefined)
    process.env.PATH = ''
    mockedInstall.mockResolvedValue(undefined)

    jest.spyOn(vscode.window, 'showWarningMessage').mockResolvedValue('Install' as never)

    const result = await resolveBitbakeSetupExecutablePath(createExtensionContext())

    expect(mockedInstall).toHaveBeenCalledTimes(1)
    expect(result).toBeUndefined()
    expect(vscode.commands.executeCommand).not.toHaveBeenCalled()
  })

  it('opens settings for the not-found message when requested', async () => {
    mockBitbakeSetupPath(undefined)
    process.env.PATH = ''

    const showWarningMessage = jest.spyOn(vscode.window, 'showWarningMessage').mockResolvedValue('Open Settings' as never)

    const result = await resolveBitbakeSetupExecutablePath(createExtensionContext())

    expect(showWarningMessage).toHaveBeenCalledWith(
      'bitbake-setup was not found in PATH and no explicit bitbake.bitbakeSetupPath is configured.',
      'Install',
      'Open Settings'
    )
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
      'workbench.action.openSettings',
      'bitbake.bitbakeSetupPath'
    )
    expect(result).toBeUndefined()
    expect(mockedInstall).not.toHaveBeenCalled()
  })

  it('returns undefined without side effects when the invalid-path message is dismissed', async () => {
    const tempRoot = createTempRoot()
    const configuredPath = path.join(tempRoot, 'configured', 'bitbake-setup')
    mockBitbakeSetupPath(configuredPath)
    const showErrorMessage = jest.spyOn(vscode.window, 'showErrorMessage').mockResolvedValue(undefined)

    const result = await resolveBitbakeSetupExecutablePath(createExtensionContext())

    expect(showErrorMessage).toHaveBeenCalled()
    expect(result).toBeUndefined()
    expect(vscode.commands.executeCommand).not.toHaveBeenCalled()
    expect(mockedInstall).not.toHaveBeenCalled()
  })

  it('returns undefined without side effects when the not-found message is dismissed', async () => {
    mockBitbakeSetupPath(undefined)
    process.env.PATH = ''
    const showWarningMessage = jest.spyOn(vscode.window, 'showWarningMessage').mockResolvedValue(undefined)

    const result = await resolveBitbakeSetupExecutablePath(createExtensionContext())

    expect(showWarningMessage).toHaveBeenCalled()
    expect(result).toBeUndefined()
    expect(vscode.commands.executeCommand).not.toHaveBeenCalled()
    expect(mockedInstall).not.toHaveBeenCalled()
  })
})
