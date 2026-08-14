/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as vscode from 'vscode'
import * as child_process from 'child_process'
import type childProcess from 'child_process'
import { type IPty } from 'node-pty'

import { BitbakeDriver } from '../../../driver/BitbakeDriver'
import { BitbakeToaster } from '../../../ui/BitbakeToaster'
import { clientNotificationManager } from '../../../ui/ClientNotificationManager'
import * as BitbakeTerminal from '../../../ui/BitbakeTerminal'
import * as ProcessUtils from '../../../utils/ProcessUtils'

jest.mock('vscode')
jest.mock('child_process', () => ({
  execSync: jest.fn()
}))

function createExitProcess (): {
  process: IPty
  finish: (exitCode: number) => void
} {
  let exitHandler:
    ((event: { exitCode: number, signal: number }) => void) | undefined

  const process = {
    onExit: jest.fn(
      (
        callback: (event: { exitCode: number, signal: number }) => void
      ) => {
        exitHandler = callback
        return { dispose: jest.fn() }
      }
    )
  } as unknown as IPty

  return {
    process,
    finish: (exitCode: number): void => {
      expect(exitHandler).toBeDefined()
      exitHandler?.({ exitCode, signal: 0 })
    }
  }
}

function createToaster (): {
  toaster: BitbakeToaster
  driver: BitbakeDriver
} {
  const driver = new BitbakeDriver()
  return {
    toaster: new BitbakeToaster(driver),
    driver
  }
}

describe('BitbakeToaster', () => {
  beforeEach(() => {
    jest.spyOn(vscode.env, 'openExternal').mockResolvedValue(true)
    jest.spyOn(
      clientNotificationManager,
      'showToasterStarted'
    ).mockImplementation(() => {})
  })

  afterEach(() => {
    jest.restoreAllMocks()
    jest.clearAllMocks()
  })

  it('starts Toaster and opens the browser after a successful exit', async () => {
    const { toaster, driver } = createToaster()
    const fakeProcess = createExitProcess()

    const terminalSpy = jest.spyOn(
      BitbakeTerminal,
      'runBitbakeTerminalCustomCommand'
    ).mockResolvedValue(fakeProcess.process)

    await toaster.startInBrowser()

    expect(terminalSpy).toHaveBeenCalledWith(
      driver,
      'nohup bash -c "source toaster start"',
      'Toaster'
    )
    expect(vscode.env.openExternal).not.toHaveBeenCalled()
    expect(
      clientNotificationManager.showToasterStarted
    ).not.toHaveBeenCalled()

    fakeProcess.finish(0)

    expect(vscode.Uri.parse).toHaveBeenCalledWith(
      'http://localhost:8000'
    )
    expect(vscode.env.openExternal).toHaveBeenCalledTimes(1)
    expect(
      clientNotificationManager.showToasterStarted
    ).toHaveBeenCalledTimes(1)
  })

  it('reopens the browser without starting another process', async () => {
    const { toaster } = createToaster()
    const fakeProcess = createExitProcess()

    const terminalSpy = jest.spyOn(
      BitbakeTerminal,
      'runBitbakeTerminalCustomCommand'
    ).mockResolvedValue(fakeProcess.process)

    await toaster.startInBrowser()
    fakeProcess.finish(0)

    terminalSpy.mockClear()
    jest.mocked(vscode.env.openExternal).mockClear()
    jest.mocked(
      clientNotificationManager.showToasterStarted
    ).mockClear()

    await toaster.startInBrowser()

    expect(terminalSpy).not.toHaveBeenCalled()
    expect(vscode.env.openExternal).toHaveBeenCalledTimes(1)
    expect(
      clientNotificationManager.showToasterStarted
    ).toHaveBeenCalledTimes(1)
  })

  it('reports a failed start and remains stopped', async () => {
    const { toaster } = createToaster()
    const fakeProcess = createExitProcess()

    const terminalSpy = jest.spyOn(
      BitbakeTerminal,
      'runBitbakeTerminalCustomCommand'
    ).mockResolvedValue(fakeProcess.process)

    const errorSpy = jest.spyOn(
      vscode.window,
      'showErrorMessage'
    )

    await toaster.startInBrowser()
    fakeProcess.finish(7)

    expect(errorSpy).toHaveBeenCalledWith(
      'Failed to start Toaster with exit code 7. See terminal output.'
    )
    expect(vscode.env.openExternal).not.toHaveBeenCalled()
    expect(
      clientNotificationManager.showToasterStarted
    ).not.toHaveBeenCalled()

    terminalSpy.mockClear()

    await toaster.stop()

    expect(terminalSpy).not.toHaveBeenCalled()
    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
      'Toaster has not been started'
    )
  })

  it('does not run a stop process when already stopped', async () => {
    const { toaster } = createToaster()

    const terminalSpy = jest.spyOn(
      BitbakeTerminal,
      'runBitbakeTerminalCustomCommand'
    )

    await toaster.stop()

    expect(terminalSpy).not.toHaveBeenCalled()
    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
      'Toaster has not been started'
    )
  })

  it('waits for the stop command and marks Toaster as stopped', async () => {
    const { toaster, driver } = createToaster()
    const startProcess = createExitProcess()

    const terminalSpy = jest.spyOn(
      BitbakeTerminal,
      'runBitbakeTerminalCustomCommand'
    ).mockResolvedValue(startProcess.process)

    await toaster.startInBrowser()
    startProcess.finish(0)

    terminalSpy.mockClear()

    const stopProcess = Promise.resolve(
      createExitProcess().process
    )
    terminalSpy.mockReturnValue(stopProcess)

    const finishSpy = jest.spyOn(
      ProcessUtils,
      'finishProcessExecution'
    ).mockResolvedValue(
      {} as childProcess.SpawnSyncReturns<Buffer>
    )

    await toaster.stop()

    expect(terminalSpy).toHaveBeenCalledWith(
      driver,
      'source toaster stop',
      'Toaster'
    )
    expect(finishSpy).toHaveBeenCalledWith(stopProcess)

    terminalSpy.mockClear()

    await toaster.stop()

    expect(terminalSpy).not.toHaveBeenCalled()
    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
      'Toaster has not been started'
    )
  })

  it('stops a running Toaster synchronously on shutdown', async () => {
    const { toaster } = createToaster()
    const startProcess = createExitProcess()

    jest.spyOn(
      BitbakeTerminal,
      'runBitbakeTerminalCustomCommand'
    ).mockResolvedValue(startProcess.process)

    await toaster.startInBrowser()
    startProcess.finish(0)

    const execMock = child_process.execSync as unknown as jest.Mock
    execMock.mockReturnValue(Buffer.from(''))

    await toaster.stopOnShutdown()

    expect(execMock).toHaveBeenCalledWith(
      'source toaster stop',
      { shell: '/bin/bash' }
    )

    execMock.mockClear()

    await toaster.stopOnShutdown()

    expect(execMock).not.toHaveBeenCalled()
  })
})
