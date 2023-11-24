/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import type * as child_process from 'child_process'
import * as vscode from 'vscode'
import { type BitbakeDriver } from '../driver/BitbakeDriver'
import { logger } from '../lib/src/utils/OutputLogger'

const endOfLine: string = '\r\n'
export let lastParsingExitCode = 0

/// Reflects the task definition in package.json
interface BitbakeTaskDefinition extends vscode.TaskDefinition {
  recipes?: string[]
  task?: string
  options?: {
    continue?: boolean
    force?: boolean
    parseOnly?: boolean
  }
}

export class BitbakeTaskProvider implements vscode.TaskProvider {
  readonly bitbakeDriver: BitbakeDriver

  constructor (bitbakeDriver: BitbakeDriver) {
    this.bitbakeDriver = bitbakeDriver
  }

  provideTasks (token: vscode.CancellationToken): vscode.ProviderResult<vscode.Task[]> {
    return []
  }

  resolveTask (task: vscode.Task, token: vscode.CancellationToken): vscode.ProviderResult<vscode.Task> | undefined {
    const bitbakeTaskDefinition: BitbakeTaskDefinition = task.definition as any
    const parseAllRecipes: boolean = task.name === 'Parse all recipes'
    if (bitbakeTaskDefinition.recipes?.[0] !== undefined || bitbakeTaskDefinition.options?.parseOnly === true) {
      const resolvedTask = new vscode.Task(
        task.definition,
        task.scope ?? vscode.TaskScope.Workspace,
        task.name,
        task.source ?? 'bitbake',
        new vscode.CustomExecution(async (resolvedDefinition: vscode.TaskDefinition): Promise<vscode.Pseudoterminal> =>
          new BitbakeBuildTaskTerminal(this.composeBitbakeCommand(bitbakeTaskDefinition), this.bitbakeDriver, parseAllRecipes)),
        ['$bitbake-ParseError', '$bitbake-Variable', '$bitbake-generic', '$bitbake-task-error', '$bitbake-UnableToParse']
      )
      if ((bitbakeTaskDefinition.task === undefined || bitbakeTaskDefinition.task.includes('build')) &&
          bitbakeTaskDefinition.options?.parseOnly !== true) {
        resolvedTask.group = vscode.TaskGroup.Build
      }
      if (bitbakeTaskDefinition.task !== undefined && bitbakeTaskDefinition.task.includes('clean')) {
        resolvedTask.group = vscode.TaskGroup.Clean
      }
      if (bitbakeTaskDefinition.options?.parseOnly === true) {
        resolvedTask.presentationOptions.reveal = vscode.TaskRevealKind.Silent
        resolvedTask.presentationOptions.focus = false
      }
      return resolvedTask
    }
    return undefined
  }

  private composeBitbakeCommand (bitbakeTaskDefinition: BitbakeTaskDefinition): string {
    let command = 'bitbake'

    bitbakeTaskDefinition.recipes?.forEach(recipe => {
      command = this.appendCommandParam(command, `${recipe}`)
    })
    if (bitbakeTaskDefinition.task !== undefined) {
      command = this.appendCommandParam(command, `-c ${bitbakeTaskDefinition.task}`)
    }
    if (bitbakeTaskDefinition.options?.continue === true) {
      command = this.appendCommandParam(command, '-k')
    }
    if (bitbakeTaskDefinition.options?.force === true) {
      command = this.appendCommandParam(command, '-f')
    }
    if (bitbakeTaskDefinition.options?.parseOnly === true) {
      command = this.appendCommandParam(command, '-p')
    }

    return command
  }

  private appendCommandParam (command: string, param: string): string {
    return command + ' ' + param
  }
}

class BitbakeBuildTaskTerminal implements vscode.Pseudoterminal {
  private readonly writeEmitter = new vscode.EventEmitter<string>()
  private readonly closeEmitter = new vscode.EventEmitter<number>()
  private child: Promise<child_process.ChildProcess> | undefined = undefined
  private readonly command: string = ''
  private readonly bitbakeDriver: BitbakeDriver
  private readonly updateParseStatus: boolean | undefined

  onDidWrite: vscode.Event<string> = this.writeEmitter.event
  onDidClose?: vscode.Event<number> = this.closeEmitter.event

  constructor (command: string, bitbakeDriver: BitbakeDriver, updateParseStatus: boolean) {
    this.command = command
    this.bitbakeDriver = bitbakeDriver
    this.updateParseStatus = updateParseStatus
  }

  output (line: string): void {
    line = line.replace(/\n/g, endOfLine)
    this.writeEmitter.fire(line)
  }

  error (error: string): void {
    error = error.replace(/\n/g, endOfLine)
    this.writeEmitter.fire(error)
  }

  async open (_initialDimensions: vscode.TerminalDimensions | undefined): Promise<void> {
    await new Promise<void>((resolve) => {
      this.writeEmitter.fire('Starting bitbake command: ' + this.command + endOfLine)
      this.writeEmitter.fire('Executing script: ' + this.bitbakeDriver.composeBitbakeScript(this.command) + endOfLine)
      this.child = this.bitbakeDriver.spawnBitbakeProcess(this.command)
      void this.child.then((child) => {
        child.stdout?.on('data', (data) => {
          this.output(data.toString())
          logger.debug(data.toString())
        })
        child.stderr?.on('data', (data) => {
          this.error(data.toString())
          logger.debug(data.toString())
        })
        child.on('error', (error) => {
          this.error(error.toString())
          logger.error(error.toString())
          resolve()
        })
        child.on('exit', (code) => {
          this.closeEmitter.fire(code ?? -1)
          if (this.updateParseStatus === true) { lastParsingExitCode = code ?? -1 }
          resolve()
        })
      })
    })
  }

  async close (): Promise<void> {
    if (this.child !== undefined) {
      if (this.updateParseStatus === true) { lastParsingExitCode = -1 }
      (await this.child).kill()
    }
  }
}
