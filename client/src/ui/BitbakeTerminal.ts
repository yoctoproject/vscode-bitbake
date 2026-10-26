/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { type IPty } from 'node-pty'
import * as vscode from 'vscode'
import { logger } from '../lib/src/utils/OutputLogger'
import path from 'path'
import { type ProcessFrontend, type ProcessSpawner, type ProcessRunOptions } from '../utils/ProcessFrontend'
import { type KillProcessFunction } from '../utils/ProcessUtils'

const endOfLine: string = '\r\n'
const emphasisedAsterisk: string = '\x1b[7m * \x1b[0m'

const bitbakeTerminals: BitbakeTerminal[] = []

export class BitbakePseudoTerminal implements vscode.Pseudoterminal, ProcessFrontend {
  private readonly writeEmitter = new vscode.EventEmitter<string>()
  private readonly closeEmitter = new vscode.EventEmitter<number>()
  readonly changeNameEmitter = new vscode.EventEmitter<string>()
  onDidWrite = this.writeEmitter.event
  onDidClose = this.closeEmitter.event
  onDidChangeName = this.changeNameEmitter.event
  readonly onDidOpen = new vscode.EventEmitter<void>()
  lastExitCode: number = 0
  outputDataString: string = ''
  private dimensions: vscode.TerminalDimensions | undefined

  readonly parentTerminal: BitbakeTerminal | undefined
  private cancel: KillProcessFunction = async (child) => { child.kill() }
  private didOpen!: () => void
  private readonly ready = new Promise<void>((resolve) => { this.didOpen = resolve })

  private isTaskTerminal (): boolean {
    // If parentTerminal is undefined, we are running in a task terminal which handles some events itself
    return this.parentTerminal === undefined
  }

  open (initialDimensions: vscode.TerminalDimensions | undefined): void {
    this.dimensions = initialDimensions
    this.didOpen()
    this.onDidOpen.fire()
    this.resizePty()
  }

  setDimensions (dimensions: vscode.TerminalDimensions): void {
    this.dimensions = dimensions
    this.resizePty()
  }

  private resizePty (): void {
    void this.process?.then((process) => {
      if (this.dimensions === undefined) { return }
      process?.resize(this.dimensions.columns, this.dimensions.rows)
    })
  }

  async close (): Promise<void> {
    this.removeFromPool()
    if (this.isBusy()) {
      await this.cancelProcess()
    }
  }

  handleInput (data: string): void {
    if (this.process === undefined) {
      this.closeEmitter.fire(0)
      this.removeFromPool()
    } else {
      if (!this.isTaskTerminal()) {
        if (data === '\x03') {
          logger.info('Process killed by user')
          void this.cancelProcess()
        }
      }
    }
  }

  private removeFromPool (): void {
    const index = bitbakeTerminals.indexOf(this.parentTerminal as BitbakeTerminal)
    if (index !== -1) { bitbakeTerminals.splice(index, 1) }
  }

  private process: Promise<IPty> | undefined

  isBusy (): boolean {
    return this.process !== undefined
  }

  constructor (parentTerminal?: BitbakeTerminal) {
    this.parentTerminal = parentTerminal
  }

  private async cancelProcess (): Promise<void> {
    const pending = this.process
    if (pending === undefined) { return }
    try {
      const child = await pending
      if (this.process === pending) { await this.cancel(child) }
    } catch {
      // There is nothing to cancel if spawning failed.
    }
  }

  output (line: string): void {
    this.writeEmitter.fire(line)
  }

  public async runProcess (spawn: ProcessSpawner, command: string, options: ProcessRunOptions = {}): Promise<IPty> {
    const terminalName = options.name
    if (this.process !== undefined) {
      throw new Error('Bitbake process already running')
    }

    this.cancel = options.cancel ?? (async (child) => { child.kill() })
    // Reserve this frontend synchronously, including while the process is queued.
    this.process = this.ready.then(async () => await spawn(this.dimensions))
    let processResolved: IPty
    try {
      processResolved = await this.process
    } catch (error) {
      this.process = undefined
      this.lastExitCode = -1
      this.output(emphasisedAsterisk + ' Failed to start process: ' + String(error) + endOfLine)
      if (this.isTaskTerminal()) { this.closeEmitter.fire(-1) }
      throw error
    }
    this.resizePty()

    processResolved.onData((data) => {
      this.output(data.toString())
      if (this.isTaskTerminal()) {
        this.outputDataString += data.toString()
      }
    })
    const listener = processResolved.onData(() => {
      // I wanted to use appropriate events like process.on('spawn') or terminal.open() but they are not triggered at the right time for
      // the terminal to be ready to receive input
      this.output(emphasisedAsterisk + ' Executing script: ' + command + endOfLine)
      listener.dispose()
    })

    processResolved.onExit((event) => {
      this.lastExitCode = event.exitCode ?? -1
      this.process = undefined
      if (event.exitCode !== 0) {
        this.output(emphasisedAsterisk + ' Bitbake process failed with code ' + event.exitCode + endOfLine)
        if (!this.isTaskTerminal()) {
          this.changeNameEmitter.fire('✖ ' + terminalName)
          this.parentTerminal?.terminal?.show()
        }
      } else {
        this.output(emphasisedAsterisk + ' Bitbake process exited successfully' + endOfLine)
        if (!this.isTaskTerminal()) { this.changeNameEmitter.fire('✔ ' + terminalName) }
      }
      if (!this.isTaskTerminal()) { this.output(emphasisedAsterisk + ' Terminal will be reused by BitBake, press any key to close it.' + endOfLine) }
      if (this.isTaskTerminal()) { this.closeEmitter.fire(event.exitCode ?? -1) }
    })

    return processResolved
  }
}

export class BitbakeTerminal {
  readonly terminal: vscode.Terminal
  readonly pty: BitbakePseudoTerminal

  static async runProcess (spawn: ProcessSpawner, command: string, options: ProcessRunOptions = {}): Promise<IPty> {
    const terminalName = options.name ?? 'BitBake'
    const terminal = bitbakeTerminals.find(t => !t.pty.isBusy()) ?? new BitbakeTerminal(terminalName)
    terminal.pty.changeNameEmitter.fire(terminalName)
    return await terminal.pty.runProcess(async (dimensions) => {
      if (options.background !== true) { terminal.terminal.show() }
      return await spawn(dimensions)
    }, command, { ...options, name: terminalName })
  }

  constructor (terminalName: string) {
    this.pty = new BitbakePseudoTerminal(this)
    bitbakeTerminals.push(this)
    const extensionTerminalOptions: vscode.ExtensionTerminalOptions = {
      name: terminalName,
      pty: this.pty,
      iconPath: {
        light: vscode.Uri.file(path.join(__dirname, '/../../images/yocto-light-icon.svg')),
        dark: vscode.Uri.file(path.join(__dirname, '/../../images/yocto-view-icon.svg'))
      }
    }
    this.terminal = vscode.window.createTerminal(extensionTerminalOptions)
  }
}
