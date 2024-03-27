/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { type IPty } from 'node-pty'
import * as vscode from 'vscode'
import { logger } from '../lib/src/utils/OutputLogger'
import path from 'path'
import { type BitbakeDriver } from '../driver/BitbakeDriver'
import { type BitbakeTaskDefinition } from './BitbakeTaskProvider'

const endOfLine: string = '\r\n'
const emphasisedAsterisk: string = '\x1b[7m * \x1b[0m'

/// Spawn a bitbake process in a dedicated terminal and wait for it to finish
export async function runBitbakeTerminal (bitbakeDriver: BitbakeDriver, bitbakeTaskDefinition: BitbakeTaskDefinition, terminalName: string, isBackground: boolean = false): Promise<IPty> {
  const command = bitbakeDriver.composeBitbakeCommand(bitbakeTaskDefinition)
  const script = bitbakeDriver.composeBitbakeScript(command)
  return await runBitbakeTerminalScript(command, bitbakeDriver, terminalName, script, isBackground)
}

/// Spawn a bitbake process in a dedicated terminal and wait for it to finish
export async function runBitbakeTerminalCustomCommand (bitbakeDriver: BitbakeDriver, command: string, terminalName: string, isBackground: boolean = false): Promise<IPty> {
  const script = bitbakeDriver.composeBitbakeScript(command)
  return await runBitbakeTerminalScript(command, bitbakeDriver, terminalName, script, isBackground)
}

const bitbakeTerminals: BitbakeTerminal[] = []
async function runBitbakeTerminalScript (command: string, bitbakeDriver: BitbakeDriver, terminalName: string, bitbakeScript: string, isBackground: boolean): Promise<IPty> {
  let terminal: BitbakeTerminal | undefined
  for (const t of bitbakeTerminals) {
    if (!t.pty.isBusy()) {
      terminal = t
      terminal.pty.changeNameEmitter.fire(terminalName)
      break
    }
  }
  if (terminal === undefined) {
    // All bitbake calls are serialized under one big lock to prevent bitbake server container issues
    // We want to open another terminal right away to show the user that the command is queued
    // But the process will have to wait for the previous one to finish (await process)
    terminal = new BitbakeTerminal(terminalName, bitbakeDriver)
    // Wait for the terminal to be ready to receive input before spawning the process
    // Otherwise it might miss the first input, or the whole process!
    await new Promise(resolve => terminal?.pty.onDidOpen.event(resolve))
  }

  if (!isBackground) {
    terminal.terminal.show()
  }
  const process = bitbakeDriver.spawnBitbakeProcess(command)
  await terminal.pty.runProcess(process, bitbakeScript, terminalName)
  return await process
}

export class BitbakePseudoTerminal implements vscode.Pseudoterminal {
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
  bitbakeDriver: BitbakeDriver

  private isTaskTerminal (): boolean {
    // If parentTerminal is undefined, we are running in a task terminal which handles some events itself
    return this.parentTerminal === undefined
  }

  open (initialDimensions: vscode.TerminalDimensions | undefined): void {
    if (!this.isTaskTerminal()) { bitbakeTerminals.push(this.parentTerminal as BitbakeTerminal) }
    this.onDidOpen.fire()
    this.dimensions = initialDimensions
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
    if (!this.isTaskTerminal()) { bitbakeTerminals.splice(bitbakeTerminals.indexOf(this.parentTerminal as BitbakeTerminal), 1) }
    if (this.isBusy()) {
      // Wait for this process to be the one executed by bitbakeDriver
      await this.process
      void this.bitbakeDriver.killBitbake()
    }
  }

  handleInput (data: string): void {
    if (this.process === undefined) {
      this.closeEmitter.fire(0)
      if (!this.isTaskTerminal()) { bitbakeTerminals.splice(bitbakeTerminals.indexOf(this.parentTerminal as BitbakeTerminal), 1) }
    } else {
      if (!this.isTaskTerminal()) {
        if (data === '\x03') {
          logger.info('Bitbake process killed by user')
          void this.bitbakeDriver.killBitbake()
        }
      }
    }
  }

  private process: Promise<IPty> | undefined

  isBusy (): boolean {
    return this.process !== undefined
  }

  constructor (bitbakeDriver: BitbakeDriver, parentTerminal?: BitbakeTerminal) {
    this.parentTerminal = parentTerminal
    this.bitbakeDriver = bitbakeDriver
  }

  output (line: string): void {
    this.writeEmitter.fire(line)
  }

  public async runProcess (process: Promise<IPty>, bitbakeScript: string, terminalName?: string): Promise<IPty> {
    if (this.process !== undefined) {
      throw new Error('Bitbake process already running')
    }

    this.process = process
    const processResolved = await this.process
    this.resizePty()

    processResolved.onData((data) => {
      this.output(data.toString())
      logger.debug(data.toString())
      if (this.isTaskTerminal()) {
        this.outputDataString += data.toString()
      }
    })
    const listener = processResolved.onData(() => {
      // I wanted to use appropriate events like process.on('spawn') or terminal.open() but they are not triggered at the right time for
      // the terminal to be ready to receive input
      this.output(emphasisedAsterisk + ' Executing script: ' + bitbakeScript + endOfLine)
      listener.dispose()
    })

    processResolved.onExit((event) => {
      this.lastExitCode = event.exitCode ?? -1
      this.process = undefined
      if (event.exitCode !== 0) {
        this.output(emphasisedAsterisk + ' Bitbake process failed with code ' + event.exitCode + endOfLine)
        if (!this.isTaskTerminal()) {
          this.changeNameEmitter.fire('✖ ' + terminalName)
          this.parentTerminal?.terminal.show()
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

class BitbakeTerminal {
  readonly terminal: vscode.Terminal
  readonly pty: BitbakePseudoTerminal

  constructor (terminalName: string, bitbakeDriver: BitbakeDriver) {
    this.pty = new BitbakePseudoTerminal(bitbakeDriver, this)
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
