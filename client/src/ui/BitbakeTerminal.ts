/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as vscode from 'vscode'
import type * as child_process from 'child_process'
import { logger } from '../lib/src/utils/OutputLogger'
import path from 'path'
import { type BitbakeDriver } from '../driver/BitbakeDriver'
import { type BitbakeTaskDefinition } from './BitbakeTaskProvider'

const endOfLine: string = '\r\n'
const emphasisedAsterisk: string = '\x1b[7m * \x1b[0m'

/// Spawn a bitbake process in a dedicated terminal and wait for it to finish
export async function runBitbakeTerminal (bitbakeDriver: BitbakeDriver, bitbakeTaskDefinition: BitbakeTaskDefinition, terminalName: string, isBackground: boolean = false): Promise<child_process.ChildProcess> {
  const command = bitbakeDriver.composeBitbakeCommand(bitbakeTaskDefinition)
  const script = bitbakeDriver.composeBitbakeScript(command)
  return await runBitbakeTerminalScript(bitbakeDriver.spawnBitbakeProcess(command), bitbakeDriver, terminalName, script, isBackground)
}

/// Spawn a bitbake process in a dedicated terminal and wait for it to finish
export async function runBitbakeTerminalCustomCommand (bitbakeDriver: BitbakeDriver, command: string, terminalName: string, isBackground: boolean = false): Promise<child_process.ChildProcess> {
  const script = bitbakeDriver.composeBitbakeScript(command)
  return await runBitbakeTerminalScript(bitbakeDriver.spawnBitbakeProcess(command), bitbakeDriver, terminalName, script, isBackground)
}

const bitbakeTerminals: BitbakeTerminal[] = []
async function runBitbakeTerminalScript (process: Promise<child_process.ChildProcess>, bitbakeDriver: BitbakeDriver, terminalName: string, bitbakeScript: string, isBackground: boolean): Promise<child_process.ChildProcess> {
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
  }

  if (!isBackground) {
    terminal.terminal.show()
  }
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
  lastExitCode: number = 0
  outputDataString: string = ''

  readonly parentTerminal: BitbakeTerminal | undefined
  bitbakeDriver: BitbakeDriver

  private isTaskTerminal (): boolean {
    // If parentTerminal is undefined, we are running in a task terminal which handles some events itself
    return this.parentTerminal === undefined
  }

  open (): void {
    if (!this.isTaskTerminal()) { bitbakeTerminals.push(this.parentTerminal as BitbakeTerminal) }
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
    }
  }

  private process: Promise<child_process.ChildProcess> | undefined

  isBusy (): boolean {
    return this.process !== undefined
  }

  constructor (bitbakeDriver: BitbakeDriver, parentTerminal?: BitbakeTerminal) {
    this.parentTerminal = parentTerminal
    this.bitbakeDriver = bitbakeDriver
  }

  output (line: string): void {
    line = line.replace(/\n/g, endOfLine)
    this.writeEmitter.fire(line)
  }

  error (error: string): void {
    error = error.replace(/\n/g, endOfLine)
    this.writeEmitter.fire(error)
  }

  public async runProcess (process: Promise<child_process.ChildProcess>, bitbakeScript: string, terminalName?: string): Promise<child_process.ChildProcess> {
    if (this.process !== undefined) {
      throw new Error('Bitbake process already running')
    }

    this.process = process
    const processResolved = await this.process

    processResolved.stdout?.on('data', (data) => {
      this.output(data.toString())
      logger.debug(data.toString())
      this.outputDataString += data.toString()
    })
    processResolved.stdout?.once('data', () => {
      // I wanted to use appropriate events like process.on('spawn') or terminal.open() but they are not triggered at the right time for
      // the terminal to be ready to receive input
      this.output(emphasisedAsterisk + ' Executing script: ' + bitbakeScript + '\n')
    })
    processResolved.stderr?.on('data', (data) => {
      this.error(data.toString())
      logger.error(data.toString())
    })
    processResolved.on('error', (error) => {
      this.lastExitCode = -1
      this.error(error.toString())
      logger.error(error.toString())
      this.process = undefined
      if (this.isTaskTerminal()) { this.closeEmitter.fire(-1) }
    })
    processResolved.on('exit', (code) => {
      this.lastExitCode = code ?? -1
      this.process = undefined
      if (code !== 0) {
        this.output(emphasisedAsterisk + ' Bitbake process failed with code ' + code + '\n')
        if (!this.isTaskTerminal()) {
          this.changeNameEmitter.fire('✖ ' + terminalName)
          this.parentTerminal?.terminal.show()
        }
      } else {
        this.output(emphasisedAsterisk + ' Bitbake process exited successfully' + '\n')
        if (!this.isTaskTerminal()) { this.changeNameEmitter.fire('✔ ' + terminalName) }
      }
      if (!this.isTaskTerminal()) { this.output(emphasisedAsterisk + ' Terminal will be reused by BitBake, press any key to close it.' + '\n') }
      if (this.isTaskTerminal()) { this.closeEmitter.fire(code ?? -1) }
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
