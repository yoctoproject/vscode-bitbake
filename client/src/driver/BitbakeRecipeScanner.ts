/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as vscode from 'vscode'
import { type LanguageClient } from 'vscode-languageclient/node'
import { logger } from '../lib/src/utils/OutputLogger'
import { runBitbakeTask } from '../ui/BitbakeCommands'
import { type BitbakeCustomExecution, type BitbakeTaskProvider } from '../ui/BitbakeTaskProvider'
import { RequestMethod } from '../lib/src/types/requests'

export class BitbakeRecipeScanner {
  private isPending: boolean = false
  private _languageClient: LanguageClient | undefined

  public scanResults: string = ''

  async scan (chosenRecipe: string, taskProvider: BitbakeTaskProvider): Promise<void> {
    const scanRecipeEnvTask = new vscode.Task(
      { type: 'bitbake', recipes: [chosenRecipe], options: { parseOnly: true, env: true } },
      vscode.TaskScope.Workspace,
      'Bitbake: Scan recipe env',
      'bitbake'
    )

    const runningTasks = vscode.tasks.taskExecutions
    if (runningTasks.some((execution) => execution.task.name === scanRecipeEnvTask.name)) {
      logger.debug('Bitbake parsing task is already running')
      this.isPending = true
    }

    await runBitbakeTask(scanRecipeEnvTask, taskProvider)
  }

  subscribeToTaskEnd (context: vscode.ExtensionContext, taskProvider: BitbakeTaskProvider): void {
    context.subscriptions.push(vscode.tasks.onDidEndTask(async (e) => {
      if (e.execution.task.name === 'Bitbake: Scan recipe env') {
        if (this.isPending) {
          this.isPending = false
          await this.scan(e.execution.task.definition.recipes?.[0] ?? '', taskProvider)
        }

        const executionEngine = e.execution.task.execution as BitbakeCustomExecution
        if (executionEngine !== undefined) {
          this.scanResults = executionEngine.pty?.outputDataString ?? ''
          if (this._languageClient === undefined) {
            logger.error('[onDidEndTask] Language client not set, unable to forward recipe environment to the server')
          } else {
            if (this.scanResults !== '') {
              logger.debug('[onDidEndTask] Sending recipe environment to the server')
              void this._languageClient.sendRequest(RequestMethod.ProcessRecipeScanResults, { scanResults: this.scanResults })
            }
          }
        }
      }
    }))
  }

  setLanguageClient (client: LanguageClient): void {
    this._languageClient = client
  }
}

const bitbakeRecipeScanner = new BitbakeRecipeScanner()
export default bitbakeRecipeScanner
