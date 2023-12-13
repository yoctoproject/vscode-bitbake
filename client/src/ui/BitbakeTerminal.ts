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
export async function runBitbakeTerminal (bitbakeDriver: BitbakeDriver, bitbakeTaskDefinition: BitbakeTaskDefinition, terminalName: string, isBackground: boolean = true): Promise<child_process.ChildProcess> {
  const command = bitbakeDriver.composeBitbakeCommand(bitbakeTaskDefinition)
  const script = bitbakeDriver.composeBitbakeScript(command)
  return await runBitbakeTerminalScript(bitbakeDriver.spawnBitbakeProcess(command), terminalName, script, isBackground)
}

/// Spawn a bitbake process in a dedicated terminal and wait for it to finish
export async function runBitbakeTerminalCustomCommand (bitbakeDriver: BitbakeDriver, command: string, terminalName: string, isBackground: boolean = true): Promise<child_process.ChildProcess> {
  const script = bitbakeDriver.composeBitbakeScript(command)
  return await runBitbakeTerminalScript(bitbakeDriver.spawnBitbakeProcess(command), terminalName, script, isBackground)
}

const bitbakeTerminals: BitbakeTerminal[] = []
async function runBitbakeTerminalScript (process: Promise<child_process.ChildProcess>, terminalName: string, bitbakeScript: string, isBackground: boolean): Promise<child_process.ChildProcess> {
  for (const terminal of bitbakeTerminals) {
    if (!terminal.pty.isBusy()) {
      if (!isBackground) {
        terminal.terminal.show()
      }
      terminal.pty.changeNameEmitter.fire(terminalName)
      await terminal.pty.runProcess(process, bitbakeScript, terminalName)
      return await process
    }
  }
  const terminal = new BitbakeTerminal(terminalName)
  // All bitbake calls are serialized under one big lock to prevent bitbake server container issues
  // We want to open another terminal right away to show the user that the command is queued
  // But the process will have to wait for the previous one to finish (await process)
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

  readonly parentTerminal: BitbakeTerminal | undefined

  private isTaskTerminal (): boolean {
    // If parentTerminal is undefined, we are running in a task terminal which handles some events itself
    return this.parentTerminal === undefined
  }

  open (): void {
    if (!this.isTaskTerminal()) { bitbakeTerminals.push(this.parentTerminal as BitbakeTerminal) }
  }

  close (): void {
    this.process?.kill()
    if (!this.isTaskTerminal()) { bitbakeTerminals.splice(bitbakeTerminals.indexOf(this.parentTerminal as BitbakeTerminal), 1) }
  }

  handleInput (data: string): void {
    if (this.process === undefined) {
      this.closeEmitter.fire(0)
      if (!this.isTaskTerminal()) { bitbakeTerminals.splice(bitbakeTerminals.indexOf(this.parentTerminal as BitbakeTerminal), 1) }
    }
  }

  private process: child_process.ChildProcess | undefined

  getProcess (): child_process.ChildProcess | undefined {
    return this.process
  }

  isBusy (): boolean {
    return this.process !== undefined
  }

  constructor (parentTerminal?: BitbakeTerminal) {
    this.parentTerminal = parentTerminal
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

    this.process = await process

    this.process.stdout?.on('data', (data) => {
      this.output(data.toString())
      logger.debug(data.toString())
    })
    this.process.stdout?.once('data', () => {
      // I wanted to use appropriate events like process.on('spawn') or terminal.open() but they are not triggered at the right time for
      // the terminal to be ready to receive input
      this.output(emphasisedAsterisk + ' Executing script: ' + bitbakeScript + '\n')
    })
    this.process.stderr?.on('data', (data) => {
      this.error(data.toString())
      logger.error(data.toString())
    })
    this.process.on('error', (error) => {
      this.lastExitCode = -1
      this.error(error.toString())
      logger.error(error.toString())
      this.process = undefined
      if (this.isTaskTerminal()) { this.closeEmitter.fire(-1) }
    })
    this.process.on('exit', (code) => {
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

    return this.process
  }
}

class BitbakeTerminal {
  readonly terminal: vscode.Terminal
  readonly pty: BitbakePseudoTerminal

  constructor (terminalName: string) {
    this.pty = new BitbakePseudoTerminal(this)
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

  getProcess (): child_process.ChildProcess | undefined {
    return this.pty.getProcess()
  }
}
