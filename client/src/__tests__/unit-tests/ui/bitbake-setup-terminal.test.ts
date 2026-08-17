/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2026 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as vscode from 'vscode'

import { runBitbakeSetupTerminal } from '../../../ui/BitbakeSetupTerminal'
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

describe('BitbakeSetupTerminal', () => {
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

  it('spawns bitbake-setup directly with argv and cwd', async () => {
    const terminal = mockTerminal()
    const process = mockProcess()

    const execution = runBitbakeSetupTerminal(
      '/opt/bin/bitbake-setup',
      [
        'init',
        '--non-interactive',
        '--init-vscode',
        'poky-wrynose',
        'poky'
      ],
      '/workspace'
    )

    terminal.options.pty.open?.({
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
        cols: 120,
        rows: 40
      })
    )

    expect(terminal.show).toHaveBeenCalled()

    const exitListener = process.onExit.mock.calls[0][0]
    exitListener({ exitCode: 0, signal: 0 })

    await expect(execution).resolves.toStrictEqual({
      exitCode: 0,
      output: ''
    })
  })

  it('forwards process output to the pseudoterminal', async () => {
    const terminal = mockTerminal()
    const process = mockProcess()

    const execution = runBitbakeSetupTerminal(
      '/opt/bin/bitbake-setup',
      ['init', '--non-interactive', 'poky-wrynose', 'poky'],
      '/workspace'
    )

    const writes: string[] = []

    terminal.options.pty.onDidWrite?.((data) => {
      writes.push(data)
    })

    terminal.options.pty.open?.({
      columns: 80,
      rows: 30
    })

    const dataListener = process.onData.mock.calls[0][0]
    dataListener('initializing workspace\r\n')

    expect(writes).toStrictEqual([
      'initializing workspace\r\n'
    ])

    const exitListener = process.onExit.mock.calls[0][0]
    exitListener({ exitCode: 0, signal: 0 })

    await expect(execution).resolves.toStrictEqual({
      exitCode: 0,
      output: 'initializing workspace\r\n'
    })
  })

  it('returns a nonzero exit code without converting it into success', async () => {
    const terminal = mockTerminal()
    const process = mockProcess()

    const execution = runBitbakeSetupTerminal(
      '/opt/bin/bitbake-setup',
      ['init', '--non-interactive', 'poky-wrynose', 'poky'],
      '/workspace'
    )

    terminal.options.pty.open?.({
      columns: 80,
      rows: 30
    })

    const exitListener = process.onExit.mock.calls[0][0]
    exitListener({ exitCode: 2, signal: 0 })

    await expect(execution).resolves.toStrictEqual({
      exitCode: 2,
      output: ''
    })
  })

  it('kills the process when the terminal receives Ctrl-C', async () => {
    const terminal = mockTerminal()
    const process = mockProcess()

    const execution = runBitbakeSetupTerminal(
      '/opt/bin/bitbake-setup',
      ['init', '--non-interactive', 'poky-wrynose', 'poky'],
      '/workspace'
    )

    terminal.options.pty.open?.({
      columns: 80,
      rows: 30
    })

    terminal.options.pty.handleInput?.('\x03')

    expect(process.kill).toHaveBeenCalled()

    const exitListener = process.onExit.mock.calls[0][0]
    exitListener({ exitCode: 130, signal: 0 })

    await execution
  })

  it('resizes the spawned pty', async () => {
    const terminal = mockTerminal()
    const process = mockProcess()

    const execution = runBitbakeSetupTerminal(
      '/opt/bin/bitbake-setup',
      ['init', '--non-interactive', 'poky-wrynose', 'poky'],
      '/workspace'
    )

    terminal.options.pty.open?.({
      columns: 80,
      rows: 30
    })

    terminal.options.pty.setDimensions?.({
      columns: 132,
      rows: 48
    })

    expect(process.resize).toHaveBeenCalledWith(132, 48)

    const exitListener = process.onExit.mock.calls[0][0]
    exitListener({ exitCode: 0, signal: 0 })

    await execution
  })
})
