/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as vscode from 'vscode'
import { BitbakePseudoTerminal, BitbakeTerminal } from '../../../ui/BitbakeTerminal'
import { BitbakeDriver } from '../../../driver/BitbakeDriver'
import { finishProcessExecution, pty } from '../../../utils/ProcessUtils'
import { createProcessMock } from '../../utils/processMock'

jest.mock('vscode')

describe('BitbakeTerminal process frontend', () => {
  let terminals: Array<{ pty: BitbakePseudoTerminal, show: jest.Mock }>

  beforeEach(() => {
    // Exercise the public terminal events with an event-delivering VS Code mock.
    jest.mocked(vscode.EventEmitter).mockImplementation(() => {
      const listeners = new Set<(value: unknown) => void>()
      return {
        fire: jest.fn(value => { listeners.forEach(listener => { listener(value) }) }),
        event: jest.fn(listener => {
          listeners.add(listener)
          return { dispose: () => listeners.delete(listener) }
        }),
        dispose: jest.fn(() => { listeners.clear() })
      }
    })
    terminals = []
    jest.spyOn(vscode.window, 'createTerminal').mockImplementation(options => {
      const terminal = {
        pty: (options as vscode.ExtensionTerminalOptions).pty as BitbakePseudoTerminal,
        show: jest.fn()
      }
      terminals.push(terminal)
      return terminal as unknown as vscode.Terminal
    })
  })

  afterEach(async () => {
    await Promise.all(terminals.map(async terminal => await terminal.pty.close()))
    jest.restoreAllMocks()
  })

  it('spawns executable and literal argv with cwd, current environment and initial dimensions', async () => {
    const process = createProcessMock()
    const spawn = jest.spyOn(pty, 'spawn').mockReturnValue(process.child)
    const args = ['init', '/path with spaces', '$(touch unexpected); $HOME', "quote'\""]
    const running = BitbakeTerminal.runProgram('/path with spaces/bitbake-setup', args, {
      cwd: '/workspace', name: 'Setup', env: { SETUP_TEST: 'value' }
    })
    expect(spawn).not.toHaveBeenCalled()
    expect(terminals[0].pty.isBusy()).toBe(true)
    terminals[0].pty.open({ columns: 120, rows: 40 })

    await expect(running).resolves.toBe(process.child)
    expect(spawn).toHaveBeenCalledWith('/path with spaces/bitbake-setup', args, {
      cwd: '/workspace', env: { ...global.process.env, SETUP_TEST: 'value' }, cols: 120, rows: 40
    })
    expect(terminals[0].show).toHaveBeenCalledTimes(1)
    process.exit(0)
  })

  it('forwards output, resizes and reuses the terminal after a successful background execution', async () => {
    const process = createProcessMock()
    jest.spyOn(pty, 'spawn').mockReturnValue(process.child)
    const running = BitbakeTerminal.runProgram('bitbake-setup', ['list'], { background: true })
    const frontend = terminals[0].pty
    const output = jest.fn()
    frontend.onDidWrite(output)
    frontend.open(undefined)
    await running
    expect(terminals[0].show).not.toHaveBeenCalled()

    process.data('configurations\r\n')
    expect(output).toHaveBeenCalledWith('configurations\r\n')
    frontend.setDimensions({ columns: 100, rows: 30 })
    await Promise.resolve()
    expect(process.child.resize).toHaveBeenLastCalledWith(100, 30)
    process.exit(0)
    expect(frontend.isBusy()).toBe(false)
    expect(frontend.lastExitCode).toBe(0)

    const next = createProcessMock()
    jest.spyOn(pty, 'spawn').mockReturnValue(next.child)
    await BitbakeTerminal.runProgram('bitbake-setup', ['init'], { name: 'Initialize' })
    expect(vscode.window.createTerminal).toHaveBeenCalledTimes(1)
    expect(frontend.changeNameEmitter.fire).toHaveBeenCalledWith('Initialize')
    next.exit(0)
  })

  it('reveals a failed background process and reports its exit code', async () => {
    const process = createProcessMock()
    jest.spyOn(pty, 'spawn').mockReturnValue(process.child)
    const running = BitbakeTerminal.runProgram('program', [], { name: 'Setup', background: true })
    const frontend = terminals[0].pty
    frontend.open(undefined)
    await running
    process.exit(7)

    expect(frontend.lastExitCode).toBe(7)
    expect(frontend.changeNameEmitter.fire).toHaveBeenCalledWith('✖ Setup')
    expect(terminals[0].show).toHaveBeenCalledTimes(1)
  })

  it('reserves separate terminals for simultaneous executions and rejects a busy frontend', async () => {
    const first = createProcessMock()
    const second = createProcessMock()
    jest.spyOn(pty, 'spawn').mockReturnValueOnce(first.child).mockReturnValueOnce(second.child)
    const running = BitbakeTerminal.runProgram('first', [])
    const other = BitbakeTerminal.runProgram('second', [])
    expect(terminals).toHaveLength(2)
    const spawnAgain = jest.fn().mockResolvedValue(second.child)
    await expect(terminals[0].pty.runProcess(spawnAgain, 'third')).rejects.toThrow('Process already running')
    expect(spawnAgain).not.toHaveBeenCalled()
    terminals.forEach(terminal => { terminal.pty.open(undefined) })
    await Promise.all([running, other])
    first.exit(0)
    second.exit(0)
  })

  it('terminates only its own process on Ctrl-C or terminal close', async () => {
    const first = createProcessMock()
    const second = createProcessMock()
    jest.spyOn(pty, 'spawn').mockReturnValueOnce(first.child).mockReturnValueOnce(second.child)
    const running = BitbakeTerminal.runProgram('first', [])
    const other = BitbakeTerminal.runProgram('second', [])
    terminals.forEach(terminal => { terminal.pty.open(undefined) })
    await Promise.all([running, other])
    terminals[0].pty.handleInput('\x03')
    await Promise.resolve()
    expect(first.child.kill).toHaveBeenCalledTimes(1)
    expect(second.child.kill).not.toHaveBeenCalled()
    await terminals[1].pty.close()
    expect(second.child.kill).toHaveBeenCalledTimes(1)
    first.exit(0)
    second.exit(0)
  })

  it('waits for its queued process before cancelling it', async () => {
    const process = createProcessMock()
    let start!: (child: typeof process.child) => void
    const queued = new Promise<typeof process.child>(resolve => { start = resolve })
    const running = BitbakeTerminal.runProcess(async () => await queued, 'queued')
    terminals[0].pty.open(undefined)
    const closing = terminals[0].pty.close()
    expect(process.child.kill).not.toHaveBeenCalled()
    start(process.child)
    await Promise.all([running, closing])
    expect(process.child.kill).toHaveBeenCalledTimes(1)
    process.exit(0)
  })

  it('keeps raw processes independent of the BitBake lock and cancels the queued BitBake process', async () => {
    const driver = new BitbakeDriver()
    const active = createProcessMock()
    const raw = createProcessMock()
    const queued = createProcessMock()
    const spawn = jest.spyOn(pty, 'spawn')
      .mockReturnValueOnce(active.child).mockReturnValueOnce(raw.child).mockReturnValueOnce(queued.child)
    const kill = jest.spyOn(driver, 'killBitbake').mockResolvedValue()
    const first = driver.runBitbakeCommand('first', 'First')
    terminals[0].pty.open(undefined)
    await first
    const program = BitbakeTerminal.runProgram('bitbake-setup', ['list'], { background: true })
    terminals[1].pty.open(undefined)
    await program
    expect(spawn).toHaveBeenCalledTimes(2)
    expect(driver.bitbakeProcess).toBe(active.child)

    const next = driver.runBitbakeCommand('next', 'Next')
    terminals[2].pty.open(undefined)
    const closing = terminals[2].pty.close()
    expect(kill).not.toHaveBeenCalled()
    active.exit(0)
    await Promise.all([next, closing])
    expect(driver.bitbakeProcess).toBe(queued.child)
    expect(kill).toHaveBeenCalledTimes(1)
    expect(raw.child.kill).not.toHaveBeenCalled()
    raw.exit(0)
    queued.exit(0)
  })

  it('releases a frontend after spawn failure and closes failed tasks', async () => {
    const frontend = new BitbakePseudoTerminal()
    frontend.open(undefined)
    const output = jest.spyOn(frontend, 'output')
    const close = jest.fn()
    frontend.onDidClose(close)
    await expect(frontend.runProcess(async () => { throw new Error('spawn failed') }, 'program')).rejects.toThrow('spawn failed')
    expect(frontend.isBusy()).toBe(false)
    expect(frontend.lastExitCode).toBe(-1)
    expect(close).toHaveBeenCalledWith(-1)
    expect(output).toHaveBeenCalledWith(expect.stringContaining('spawn failed'))
    const process = createProcessMock()
    await frontend.runProcess(async () => process.child, 'retry')
    process.data('task output')
    process.exit(3)
    expect(frontend.outputDataString).toBe('task output')
    expect(close).toHaveBeenLastCalledWith(3)
  })

  it('handles spawn failure while a terminal resize is pending', async () => {
    jest.spyOn(pty, 'spawn').mockImplementation(() => { throw new Error('missing executable') })
    const running = BitbakeTerminal.runProgram('missing-program', [])
    const rejected = expect(running).rejects.toThrow('missing executable')
    terminals[0].pty.open({ columns: 100, rows: 30 })
    await rejected
    await new Promise(resolve => { setImmediate(resolve) })
    expect(terminals[0].pty.isBusy()).toBe(false)
  })

  it('captures real executable output and cwd through the shared lifecycle', async () => {
    const running = BitbakeTerminal.runProgram(global.process.execPath, [
      '-e', 'console.log(JSON.stringify({ cwd: process.cwd(), arg: process.argv[1], env: process.env.FRONTEND_TEST, columns: process.stdout.columns, rows: process.stdout.rows }))',
      'literal $HOME; $(exit 9)'
    ], { cwd: '/tmp', env: { FRONTEND_TEST: 'inherited' }, background: true })
    const result = finishProcessExecution(running, undefined, 10000)
    terminals[0].pty.open({ columns: 90, rows: 25 })
    const completed = await result
    expect(completed.status).toBe(0)
    expect(JSON.parse(completed.stdout.toString())).toEqual({
      cwd: '/tmp', arg: 'literal $HOME; $(exit 9)', env: 'inherited', columns: 90, rows: 25
    })
    expect(terminals[0].pty.isBusy()).toBe(false)
  })

  it.each(['Ctrl-C', 'close'])('terminates a real process on %s', async action => {
    const running = BitbakeTerminal.runProgram(global.process.execPath, [
      '-e', "console.log('ready'); setInterval(() => {}, 1000)"
    ], { background: true })
    const completed = finishProcessExecution(running, undefined, 10000)
    const frontend = terminals[0].pty
    frontend.open(undefined)
    const child = await running
    await new Promise<void>(resolve => {
      const listener = child.onData(data => {
        if (data.includes('ready')) {
          listener.dispose()
          resolve()
        }
      })
    })
    if (action === 'Ctrl-C') {
      frontend.handleInput('\x03')
    } else {
      await frontend.close()
    }
    await completed
    expect(frontend.isBusy()).toBe(false)
  })

})
