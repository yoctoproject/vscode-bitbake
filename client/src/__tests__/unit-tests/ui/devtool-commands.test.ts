/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as vscode from 'vscode'
import type childProcess from 'child_process'
import { BitbakeWorkspace } from '../../../ui/BitbakeWorkspace'
import { BitBakeProjectScanner } from '../../../driver/BitBakeProjectScanner'
import { mockVscodeExtensionContext } from '../../utils/vscodeMock'
import { BitbakeDriver } from '../../../driver/BitbakeDriver'
import { addDevtoolDebugBuild, registerDevtoolCommands } from '../../../ui/DevtoolCommands'
import { setBitbakeESDKMode } from '../../../driver/BitbakeESDK'
import * as RecipeSelection from '../../../ui/RecipeSelection'
import { clientNotificationManager } from '../../../ui/ClientNotificationManager'
import * as BitbakeTerminal from '../../../ui/BitbakeTerminal'
import * as ProcessUtils from '../../../utils/ProcessUtils'
import { LanguageClient } from 'vscode-languageclient/node'
import { IPty } from 'node-pty'
import { BitbakeScanResult } from '../../../lib/src/types/BitbakeScanResult'
import { BitbakeSettings } from '../../../lib/src/BitbakeSettings'

jest.mock('vscode')

function mockExtensionContext (bitBakeProjectScanner: BitBakeProjectScanner): (...args: unknown[]) => unknown {
  const bitbakeWorkspace = new BitbakeWorkspace()
  const contextMock = mockVscodeExtensionContext()
  const clientMock = jest.fn() as unknown as LanguageClient

  let ideSDKCommand = () => {}
  vscode.commands.registerCommand = jest.fn().mockImplementation(
    (command: string, callback: (...args: unknown[]) => unknown): void => {
      if (command === 'bitbake.devtool-ide-sdk') {
        ideSDKCommand = callback
      }
    })
  registerDevtoolCommands(contextMock, bitbakeWorkspace, bitBakeProjectScanner, clientMock)
  expect(ideSDKCommand).toBeDefined()
  return ideSDKCommand
}

describe('Devtool ide-sdk command', () => {
  afterEach(() => {
    jest.restoreAllMocks()
    setBitbakeESDKMode(false)
    jest.clearAllMocks()
  })

  it.each([undefined, ''])('should reject sdkImage %s', async (sdkImage) => {
    const bitBakeProjectScanner = new BitBakeProjectScanner(new BitbakeDriver())
    bitBakeProjectScanner.bitbakeDriver.bitbakeSettings = { pathToBitbakeFolder: '', sdkImage }
    bitBakeProjectScanner.activeScanResult._workspaces = [{ name: 'busybox', path: '/busybox' }]
    const ideSDKCommand = mockExtensionContext(bitBakeProjectScanner)

    jest.spyOn(clientNotificationManager, 'showSDKConfigurationError').mockImplementation(() => {})
    const terminal = jest.spyOn(BitbakeTerminal, 'runBitbakeTerminalCustomCommand')
    await ideSDKCommand()
    expect(clientNotificationManager.showSDKConfigurationError).toHaveBeenCalled()
    expect(terminal).not.toHaveBeenCalled()
  })

  it('should detect ide-sdk missing', async () => {
    const bitBakeProjectScanner = new BitBakeProjectScanner(new BitbakeDriver())
    bitBakeProjectScanner.bitbakeDriver.bitbakeSettings = {
      pathToBitbakeFolder: '',
      sdkImage: 'core-image-minimal'
    }
    jest.spyOn(bitBakeProjectScanner, 'activeScanResult', 'get').mockReturnValue({_bitbakeVersion: '1.0.0', _workspaces: [{ name: 'busybox', path: '/busybox' }]} as BitbakeScanResult)
    const ideSDKCommand = mockExtensionContext(bitBakeProjectScanner)

    jest.spyOn(BitbakeTerminal, 'runBitbakeTerminalCustomCommand').mockReturnValue(undefined as unknown as Promise<IPty>)
    jest.spyOn(ProcessUtils, 'finishProcessExecution').mockReturnValue({ status: 1 } as unknown as Promise<childProcess.SpawnSyncReturns<Buffer>>)

    jest.spyOn(clientNotificationManager, 'showSDKUnavailableError').mockImplementation(() => {})
    await ideSDKCommand()
    expect(clientNotificationManager.showSDKUnavailableError).toHaveBeenCalledWith('busybox')
    expect(BitbakeTerminal.runBitbakeTerminalCustomCommand).not.toHaveBeenCalled()
  })

  it('should properly format ide-sdk command', async () => {
    const bitBakeProjectScanner = new BitBakeProjectScanner(new BitbakeDriver())
    bitBakeProjectScanner.bitbakeDriver.bitbakeSettings = {
      pathToBitbakeFolder: '',
      sdkImage: 'core-image-minimal',
      sshTarget: 'root@192.168.0.3'
    }
    jest.spyOn(bitBakeProjectScanner, 'activeScanResult', 'get').mockReturnValue({_bitbakeVersion: '3.0.0', _workspaces: [{ name: 'busybox', path: '/busybox' }]} as BitbakeScanResult)
    const ideSDKCommand = mockExtensionContext(bitBakeProjectScanner)

    const commandSpy = jest.spyOn(BitbakeTerminal, 'runBitbakeTerminalCustomCommand').mockReturnValue(undefined as unknown as Promise<IPty>)
    jest.spyOn(ProcessUtils, 'finishProcessExecution').mockReturnValue({ status: 0 } as unknown as Promise<childProcess.SpawnSyncReturns<Buffer>>)

    jest.spyOn(vscode.window, 'showInformationMessage').mockReturnValue({ then: jest.fn() } as unknown as Thenable<vscode.MessageItem | undefined>)
    await ideSDKCommand()
    expect(commandSpy).toHaveBeenCalledWith(expect.anything(), 'devtool ide-sdk -i code busybox core-image-minimal -t root@192.168.0.3', expect.anything())
  })

  it('should wait for ide-sdk to finish successfully before notifying', async () => {
    const bitBakeProjectScanner = new BitBakeProjectScanner(new BitbakeDriver())
    bitBakeProjectScanner.bitbakeDriver.bitbakeSettings = {
      pathToBitbakeFolder: '',
      sdkImage: 'core-image-minimal'
    }
    jest.spyOn(bitBakeProjectScanner, 'activeScanResult', 'get').mockReturnValue({_bitbakeVersion: '3.0.0', _workspaces: [{ name: 'busybox', path: '/busybox' }]} as BitbakeScanResult)
    const ideSDKCommand = mockExtensionContext(bitBakeProjectScanner)
    const process = Promise.resolve({} as IPty)
    let finishProcess: (result: childProcess.SpawnSyncReturns<Buffer>) => void
    const processFinished = new Promise<childProcess.SpawnSyncReturns<Buffer>>((resolve) => {
      finishProcess = resolve
    })

    jest.spyOn(BitbakeTerminal, 'runBitbakeTerminalCustomCommand').mockReturnValue(process)
    jest.spyOn(ProcessUtils, 'finishProcessExecution').mockReturnValue(processFinished)
    const informationMessageSpy = jest.spyOn(vscode.window, 'showInformationMessage').mockReturnValue({ then: jest.fn() } as unknown as Thenable<vscode.MessageItem | undefined>)

    const commandPromise = ideSDKCommand()
    await Promise.resolve()
    expect(informationMessageSpy).not.toHaveBeenCalled()

    finishProcess!({ status: 0 } as childProcess.SpawnSyncReturns<Buffer>)
    await commandPromise
    expect(informationMessageSpy).toHaveBeenCalledWith('Devtool workspace for busybox successfully configured', 'Open Workspace')
  })

  it('should configure all scanned workspaces once in scan order, ignoring command arguments', async () => {
    const scanner = new BitBakeProjectScanner(new BitbakeDriver())
    scanner.bitbakeDriver.bitbakeSettings = { pathToBitbakeFolder: '', sdkImage: 'core-image-minimal' }
    scanner.activeScanResult._bitbakeVersion = '2.8.0'
    scanner.activeScanResult._workspaces = [
      { name: 'zlib', path: '/zlib' },
      { name: 'busybox', path: '/busybox' }
    ]
    const command = mockExtensionContext(scanner)
    const picker = jest.spyOn(RecipeSelection, 'selectRecipe')
    const process = Promise.resolve({} as IPty)
    const terminal = jest.spyOn(BitbakeTerminal, 'runBitbakeTerminalCustomCommand').mockReturnValue(process)
    const finish = jest.spyOn(ProcessUtils, 'finishProcessExecution').mockResolvedValue({ status: 0 } as childProcess.SpawnSyncReturns<Buffer>)
    const message = jest.spyOn(vscode.window, 'showInformationMessage').mockResolvedValue(undefined)
    const execute = jest.spyOn(vscode.commands, 'executeCommand')

    await command('unscanned-recipe')

    expect(picker).not.toHaveBeenCalled()
    expect(terminal).toHaveBeenCalledTimes(1)
    expect(terminal).toHaveBeenCalledWith(scanner.bitbakeDriver, 'devtool ide-sdk -i code zlib busybox core-image-minimal', expect.anything())
    expect(finish).toHaveBeenCalledWith(process, undefined, ProcessUtils.BITBAKE_BUILD_TIMEOUT)
    expect(message).toHaveBeenCalledWith('Devtool workspaces successfully configured')
    expect(execute).not.toHaveBeenCalled()
  })

  it('should do nothing when there are no devtool workspaces', async () => {
    const scanner = new BitBakeProjectScanner(new BitbakeDriver())
    scanner.activeScanResult._workspaces = []
    const command = mockExtensionContext(scanner)
    const terminal = jest.spyOn(BitbakeTerminal, 'runBitbakeTerminalCustomCommand')
    const picker = jest.spyOn(RecipeSelection, 'selectRecipe')

    await command('busybox')

    expect(terminal).not.toHaveBeenCalled()
    expect(picker).not.toHaveBeenCalled()
  })

  it.each([0, 1])('should preserve the eSDK availability probe (status %s)', async (status) => {
    setBitbakeESDKMode(true)
    const scanner = new BitBakeProjectScanner(new BitbakeDriver())
    scanner.bitbakeDriver.bitbakeSettings = { pathToBitbakeFolder: '', sdkImage: 'core-image-minimal' }
    scanner.activeScanResult._workspaces = [{ name: 'zlib', path: '/zlib' }, { name: 'busybox', path: '/busybox' }]
    const command = mockExtensionContext(scanner)
    const terminal = jest.spyOn(BitbakeTerminal, 'runBitbakeTerminalCustomCommand').mockResolvedValue({} as IPty)
    jest.spyOn(ProcessUtils, 'finishProcessExecution').mockResolvedValue({ status } as childProcess.SpawnSyncReturns<Buffer>)
    jest.spyOn(vscode.window, 'showInformationMessage').mockResolvedValue(undefined)
    const unavailable = jest.spyOn(clientNotificationManager, 'showSDKUnavailableError').mockImplementation(() => {})

    await command()

    expect(terminal).toHaveBeenNthCalledWith(1, scanner.bitbakeDriver, "devtool --help | grep 'ide-sdk'", expect.anything())
    expect(terminal).toHaveBeenCalledTimes(status === 0 ? 2 : 1)
    if (status !== 0) {
      expect(unavailable).toHaveBeenCalledWith(undefined)
    }
  })

  it.each([1, null])('should not notify success after an unsuccessful or cancelled process (status %s)', async (status) => {
    const scanner = new BitBakeProjectScanner(new BitbakeDriver())
    scanner.bitbakeDriver.bitbakeSettings = { pathToBitbakeFolder: '', sdkImage: 'core-image-minimal' }
    scanner.activeScanResult._bitbakeVersion = '3.0.0'
    scanner.activeScanResult._workspaces = [{ name: 'busybox', path: '/busybox' }]
    const command = mockExtensionContext(scanner)
    jest.spyOn(BitbakeTerminal, 'runBitbakeTerminalCustomCommand').mockResolvedValue({} as IPty)
    jest.spyOn(ProcessUtils, 'finishProcessExecution').mockResolvedValue({ status } as childProcess.SpawnSyncReturns<Buffer>)
    const message = jest.spyOn(vscode.window, 'showInformationMessage')

    await command()

    expect(message).not.toHaveBeenCalled()
  })

  it.each([
    ['Configure SDK', 'bitbake.devtool-ide-sdk', []],
    ['Configure devtool fallback', 'bitbake.devtool-sdk-fallback', ['busybox']]
  ])('should route the SDK suggestion action %s with the correct scope', async (choice, command, args) => {
    clientNotificationManager.setMemento(mockVscodeExtensionContext().workspaceState)
    jest.spyOn(vscode.window, 'showInformationMessage').mockResolvedValue(choice as unknown as vscode.MessageItem)
    const execute = jest.spyOn(vscode.commands, 'executeCommand')

    clientNotificationManager.showSDKSuggestion('busybox')
    await Promise.resolve()

    expect(execute).toHaveBeenCalledWith(command, ...args)
  })

  it('should properly detect devtool modify options', async () => {
    // Test addDevtoolDebugBuild
    expect(await addDevtoolDebugBuild('', {_bitbakeVersion: '3.0.0'} as BitbakeScanResult, {disableDevtoolDebugBuild: false} as BitbakeSettings, undefined as unknown as BitbakeDriver)).toBe(' --debug-build')
    expect(await addDevtoolDebugBuild('', {_bitbakeVersion: '3.0.0'} as BitbakeScanResult, {disableDevtoolDebugBuild: true} as BitbakeSettings, undefined as unknown as BitbakeDriver)).toBe('')
    expect(await addDevtoolDebugBuild('', {_bitbakeVersion: '1.0.0'} as BitbakeScanResult, {disableDevtoolDebugBuild: false} as BitbakeSettings, undefined as unknown as BitbakeDriver)).toBe('')
  })
})
