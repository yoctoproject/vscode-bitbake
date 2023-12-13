/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as vscode from 'vscode'
import { type BitbakeDriver } from '../driver/BitbakeDriver'
import { BitbakePseudoTerminal } from './BitbakeTerminal'

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

export class BitbakeCustomExecution extends vscode.CustomExecution {
  pty: BitbakePseudoTerminal | undefined
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
    if (bitbakeTaskDefinition.recipes?.[0] !== undefined || bitbakeTaskDefinition.options?.parseOnly === true) {
      const resolvedTask = new vscode.Task(
        task.definition,
        task.scope ?? vscode.TaskScope.Workspace,
        task.name,
        task.source ?? 'bitbake',
        new BitbakeCustomExecution(async (resolvedDefinition: vscode.TaskDefinition): Promise<vscode.Pseudoterminal> => {
          const pty = new BitbakePseudoTerminal();
          (resolvedTask.execution as BitbakeCustomExecution).pty = pty
          void pty.runProcess(this.bitbakeDriver.spawnBitbakeProcess(this.composeBitbakeCommand(bitbakeTaskDefinition)), this.bitbakeDriver.composeBitbakeScript(this.composeBitbakeCommand(bitbakeTaskDefinition)))
          return pty
        }),
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
