/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as vscode from 'vscode'
import type childProcess from 'child_process'
import { BitbakeWorkspace } from '../../../ui/BitbakeWorkspace'
import { BitBakeProjectScanner } from '../../../driver/BitBakeProjectScanner'
import { BitbakeDriver } from '../../../driver/BitbakeDriver'
import { registerDevtoolCommands } from '../../../ui/BitbakeCommands'
import { clientNotificationManager } from '../../../ui/ClientNotificationManager'
import * as BitbakeTerminal from '../../../ui/BitbakeTerminal'
import * as ProcessUtils from '../../../utils/ProcessUtils'
import { LanguageClient } from 'vscode-languageclient/node'
import { IPty } from 'node-pty'

jest.mock('vscode')

function mockExtensionContext (bitBakeProjectScanner: BitBakeProjectScanner): (...args: unknown[]) => unknown {
  const bitbakeWorkspace = new BitbakeWorkspace()
  const contextMock: vscode.ExtensionContext = {
    subscriptions: {
      push: jest.fn()
    }
  } as unknown as vscode.ExtensionContext
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
    jest.clearAllMocks()
  })

  it('should detect missing settings', async () => {
    const bitBakeProjectScanner = new BitBakeProjectScanner(new BitbakeDriver())
    const ideSDKCommand = mockExtensionContext(bitBakeProjectScanner)

    clientNotificationManager.showSDKConfigurationError = jest.fn()
    await ideSDKCommand('busybox')
    expect(clientNotificationManager.showSDKConfigurationError).toHaveBeenCalled()
  })

  it('should detect ide-sdk missing', async () => {
    const bitBakeProjectScanner = new BitBakeProjectScanner(new BitbakeDriver())
    bitBakeProjectScanner.bitbakeDriver.bitbakeSettings = {
      pathToBitbakeFolder: '',
      sdkImage: 'core-image-minimal'
    }
    const ideSDKCommand = mockExtensionContext(bitBakeProjectScanner)

    jest.spyOn(BitbakeTerminal, 'runBitbakeTerminalCustomCommand').mockReturnValue(undefined as unknown as Promise<IPty>)
    jest.spyOn(ProcessUtils, 'finishProcessExecution').mockReturnValue({ status: 1 } as unknown as Promise<childProcess.SpawnSyncReturns<Buffer>>)

    clientNotificationManager.showSDKUnavailableError = jest.fn()
    await ideSDKCommand('busybox')
    expect(clientNotificationManager.showSDKUnavailableError).toHaveBeenCalled()
  })

  it('should properly format ide-sdk command', async () => {
    const bitBakeProjectScanner = new BitBakeProjectScanner(new BitbakeDriver())
    bitBakeProjectScanner.bitbakeDriver.bitbakeSettings = {
      pathToBitbakeFolder: '',
      sdkImage: 'core-image-minimal',
      sshTarget: 'root@192.168.0.3'
    }
    const ideSDKCommand = mockExtensionContext(bitBakeProjectScanner)

    const commandSpy = jest.spyOn(BitbakeTerminal, 'runBitbakeTerminalCustomCommand').mockReturnValue(undefined as unknown as Promise<IPty>)
    jest.spyOn(ProcessUtils, 'finishProcessExecution').mockReturnValue({ status: 0 } as unknown as Promise<childProcess.SpawnSyncReturns<Buffer>>)

    jest.spyOn(vscode.window, 'showInformationMessage').mockReturnValue({ then: jest.fn() } as unknown as Thenable<vscode.MessageItem | undefined>)
    await ideSDKCommand('busybox')
    expect(commandSpy).toHaveBeenCalledWith(expect.anything(), 'devtool ide-sdk -i code busybox core-image-minimal -t root@192.168.0.3', expect.anything())
  })
})
