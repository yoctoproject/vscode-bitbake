/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2026 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as vscode from 'vscode'

import { runRawProcessTerminal } from '../../../ui/BitbakeTerminal'
import { pty } from '../../../utils/ProcessUtils'

jest.mock('vscode', () => ({
  EventEmitter: jest.fn().mockImplementation(() => {
    const listeners: Array<(data: unknown) => void> = []

    return {
      event: (listener: (data: unknown) => void) => {
        listeners.push(listener)

        return {
          dispose: jest.fn()
        }
      },
      fire: (data: unknown) => {
        for (const listener of listeners) {
          listener(data)
        }
      },
      dispose: jest.fn()
    }
  }),
  window: {
    createTerminal: jest.fn()
  },
  Uri: {
    file: jest.fn((fsPath: string) => ({ fsPath }))
  }
}))
jest.mock('../../../utils/ProcessUtils', () => ({
  pty: {
    spawn: jest.fn()
  }
}))

describe('BitbakeTerminal raw process execution', () => {
  const mockedSpawn = pty.spawn as jest.MockedFunction<typeof pty.spawn>

  beforeEach(() => {
    jest.clearAllMocks()
  })

  function mockTerminal (): {
    show: jest.Mock
    options: vscode.ExtensionTerminalOptions
  } {
    const show = jest.fn()
    let options: vscode.ExtensionTerminalOptions | undefined

    jest.mocked(vscode.window.createTerminal).mockImplementation(
      (receivedOptions: vscode.ExtensionTerminalOptions) => {
        options = receivedOptions

        return {
          show
        } as unknown as vscode.Terminal
      }
    )

    return {
      show,
      get options () {
        if (options === undefined) {
          throw new Error('Expected terminal options')
        }

        return options
      }
    }
  }

  function mockProcess (): {
    onData: jest.Mock
    onExit: jest.Mock
    kill: jest.Mock
    resize: jest.Mock
  } {
    const process = {
      onData: jest.fn(),
      onExit: jest.fn(),
      kill: jest.fn(),
      resize: jest.fn()
    }

    mockedSpawn.mockReturnValue(
      process as unknown as ReturnType<typeof pty.spawn>
    )

    return process
  }

  async function openTerminal (
    terminal: { options: vscode.ExtensionTerminalOptions },
    dimensions: vscode.TerminalDimensions
  ): Promise<void> {
    terminal.options.pty.open?.(dimensions)
    await Promise.resolve()
    await Promise.resolve()
  }

  it('spawns a raw process directly with argv, cwd, and the normal environment', async () => {
    const terminal = mockTerminal()
    const ptyProcess = mockProcess()

    const execution = runRawProcessTerminal(
      '/opt/bin/bitbake-setup',
      [
        'init',
        '--non-interactive',
        '--init-vscode',
        'poky-wrynose',
        'poky'
      ],
      '/workspace',
      'BitBake: Initialize workspace with bitbake-setup'
    )

    await openTerminal(terminal, {
      columns: 120,
      rows: 40
    })

    expect(mockedSpawn).toHaveBeenCalledWith(
      '/opt/bin/bitbake-setup',
      [
        'init',
        '--non-interactive',
        '--init-vscode',
        'poky-wrynose',
        'poky'
      ],
      expect.objectContaining({
        cwd: '/workspace',
        env: expect.objectContaining({
          PATH: process.env.PATH
        }),
        cols: 120,
        rows: 40
      })
    )

    expect(terminal.show).toHaveBeenCalled()

    const exitListener = ptyProcess.onExit.mock.calls[0][0]
    exitListener({ exitCode: 0, signal: 0 })

    await expect(execution).resolves.toStrictEqual({
      exitCode: 0,
      output: ''
    })
  })

  it('keeps the terminal in the background when requested', async () => {
    const terminal = mockTerminal()
    const ptyProcess = mockProcess()

    const execution = runRawProcessTerminal(
      '/opt/bin/bitbake-setup',
      ['list', '--write-json', '/tmp/configurations.json'],
      '/workspace',
      'BitBake: Inspect bitbake-setup registry',
      true
    )

    await openTerminal(terminal, {
      columns: 80,
      rows: 30
    })

    expect(terminal.show).not.toHaveBeenCalled()

    const exitListener = ptyProcess.onExit.mock.calls[0][0]
    exitListener({ exitCode: 0, signal: 0 })

    await expect(execution).resolves.toStrictEqual({
      exitCode: 0,
      output: ''
    })
  })

  it('forwards process output and resolves with the captured output and status', async () => {
    const terminal = mockTerminal()
    const ptyProcess = mockProcess()

    const execution = runRawProcessTerminal(
      '/opt/bin/bitbake-setup',
      ['init', '--non-interactive', 'poky-wrynose', 'poky'],
      '/workspace',
      'BitBake: Initialize workspace with bitbake-setup'
    )

    const writes: string[] = []

    terminal.options.pty.onDidWrite?.((data) => {
      writes.push(data)
    })

    await openTerminal(terminal, {
      columns: 80,
      rows: 30
    })

    const dataListener = ptyProcess.onData.mock.calls[0][0]
    dataListener('initializing workspace\r\n')

    expect(writes).toStrictEqual([
      'initializing workspace\r\n'
    ])

    const exitListener = ptyProcess.onExit.mock.calls[0][0]
    exitListener({ exitCode: 2, signal: 0 })

    await expect(execution).resolves.toStrictEqual({
      exitCode: 2,
      output: 'initializing workspace\r\n'
    })
  })

  it('kills and resizes the spawned process from terminal events', async () => {
    const terminal = mockTerminal()
    const ptyProcess = mockProcess()

    const execution = runRawProcessTerminal(
      '/opt/bin/bitbake-setup',
      ['init', '--non-interactive', 'poky-wrynose', 'poky'],
      '/workspace',
      'BitBake: Initialize workspace with bitbake-setup'
    )

    await openTerminal(terminal, {
      columns: 80,
      rows: 30
    })

    terminal.options.pty.setDimensions?.({
      columns: 132,
      rows: 48
    })
    await Promise.resolve()

    terminal.options.pty.handleInput?.('\x03')

    expect(ptyProcess.resize).toHaveBeenCalledWith(132, 48)
    expect(ptyProcess.kill).toHaveBeenCalled()

    const exitListener = ptyProcess.onExit.mock.calls[0][0]
    exitListener({ exitCode: 130, signal: 0 })

    await execution
  })
})
