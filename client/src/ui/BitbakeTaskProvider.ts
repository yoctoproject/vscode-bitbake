/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import type * as child_process from 'child_process'
import * as vscode from 'vscode'
import { type BitbakeDriver } from '../lib/src/BitbakeDriver'
import { logger } from '../lib/src/utils/OutputLogger'

const endOfLine: string = '\r\n'

/// Reflects the task definition in package.json
interface BitbakeTaskDefinition extends vscode.TaskDefinition {
  recipes: string[]
  task?: string
  options?: {
    continue: boolean
    force: boolean
  }
}

export class BitbakeTaskProvider implements vscode.TaskProvider {
  private readonly bitbakeDriver: BitbakeDriver

  constructor (bitbakeDriver: BitbakeDriver) {
    this.bitbakeDriver = bitbakeDriver
  }

  provideTasks (token: vscode.CancellationToken): vscode.ProviderResult<vscode.Task[]> {
    return []
  }

  resolveTask (task: vscode.Task, token: vscode.CancellationToken): vscode.ProviderResult<vscode.Task> | undefined {
    const bitbakeTaskDefinition: BitbakeTaskDefinition = task.definition as any
    if (bitbakeTaskDefinition.recipes?.[0] !== undefined) {
      const resolvedTask = new vscode.Task(
        bitbakeTaskDefinition,
        task.scope ?? vscode.TaskScope.Workspace,
        `Run bitbake -c ${bitbakeTaskDefinition.task ?? 'build'} ${bitbakeTaskDefinition.recipes.join(' ')}`,
        'bitbake',
        new vscode.CustomExecution(async (resolvedDefinition: vscode.TaskDefinition): Promise<vscode.Pseudoterminal> =>
          new BitbakeBuildTaskTerminal(this.composeBitbakeCommand(bitbakeTaskDefinition), this.bitbakeDriver)),
        ['$bitbake-ParseError', '$bitbake-Variable', '$bitbake-generic']
      )
      if (bitbakeTaskDefinition.task === undefined || bitbakeTaskDefinition.task.includes('build')) {
        resolvedTask.group = vscode.TaskGroup.Build
      }
      if (bitbakeTaskDefinition.task !== undefined && bitbakeTaskDefinition.task.includes('clean')) {
        resolvedTask.group = vscode.TaskGroup.Clean
      }
      return resolvedTask
    }
    return undefined
  }

  private composeBitbakeCommand (bitbakeTaskDefinition: BitbakeTaskDefinition): string {
    let command = 'bitbake'

    for (const recipe of bitbakeTaskDefinition.recipes) {
      command = this.appendCommandParam(command, `${recipe}`)
    }
    if (bitbakeTaskDefinition.task !== undefined) {
      command = this.appendCommandParam(command, `-c ${bitbakeTaskDefinition.task}`)
    }
    if (bitbakeTaskDefinition.options?.continue !== undefined) {
      command = this.appendCommandParam(command, '-k')
    }
    if (bitbakeTaskDefinition.options?.force !== undefined) {
      command = this.appendCommandParam(command, '-f')
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
  private child: child_process.ChildProcess | undefined = undefined
  private readonly command: string = ''
  private readonly bitbakeDriver: BitbakeDriver

  onDidWrite: vscode.Event<string> = this.writeEmitter.event
  onDidClose?: vscode.Event<number> = this.closeEmitter.event

  constructor (command: string, bitbakeDriver: BitbakeDriver) {
    this.command = command
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

  async open (_initialDimensions: vscode.TerminalDimensions | undefined): Promise<void> {
    await new Promise<void>((resolve) => {
      this.writeEmitter.fire('Starting bitbake command: ' + this.command + endOfLine)
      this.child = this.bitbakeDriver.spawnBitbakeProcess(this.command)
      this.child.stdout?.on('data', (data) => {
        this.output(data.toString())
        logger.debug(data.toString())
      })
      this.child.stderr?.on('data', (data) => {
        this.error(data.toString())
        logger.debug(data.toString())
      })
      this.child.on('error', (error) => {
        this.error(error.toString())
        logger.error(error.toString())
        resolve()
      })
      this.child.on('exit', (code) => {
        this.closeEmitter.fire(code ?? 0)
        resolve()
      })
    })
  }

  async close (): Promise<void> {
    if (this.child !== undefined) {
      this.child.kill()
    }
  }
}
