/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as vscode from 'vscode'
import { type LanguageClient } from 'vscode-languageclient/node'
import { logger } from '../lib/src/utils/OutputLogger'
import { runBitbakeTask } from '../ui/BitbakeCommands'
import { type BitbakeCustomExecution, type BitbakeTaskProvider } from '../ui/BitbakeTaskProvider'
import { RequestMethod, type RequestParams } from '../lib/src/types/requests'

export class BitbakeRecipeScanner {
  private _languageClient: LanguageClient | undefined
  private _currentUriForScan: string = ''
  private readonly _pendingRecipeScanTasks: Array<{ task: vscode.Task, uri: string }> = []

  public scanResults: string = ''
  public processedScanResults: Record<string, unknown> | undefined

  async scan (chosenRecipe: string, taskProvider: BitbakeTaskProvider, uri: any): Promise<void> {
    if (chosenRecipe === '') {
      logger.debug('[BitbakeRecipeScanner] No recipe chosen for scan')
      return
    }

    const taskName = 'Bitbake: Scan recipe env'
    const scanRecipeEnvTask = new vscode.Task(
      { type: 'bitbake', recipes: [chosenRecipe], options: { parseOnly: true, env: true } },
      vscode.TaskScope.Workspace,
      taskName,
      'bitbake'
    )

    const runningTasks = vscode.tasks.taskExecutions
    if (runningTasks.some((execution) => execution.task.name === taskName)) {
      logger.debug('[BitbakeRecipeScanner] Recipe scan is already running, pushing to pending tasks')
      this._pendingRecipeScanTasks.push({ task: scanRecipeEnvTask, uri })
      return
    }

    logger.debug(`[BitbakeRecipeScanner] Scanning recipe env: ${uri}`)
    this._currentUriForScan = uri

    await runBitbakeTask(scanRecipeEnvTask, taskProvider)
  }

  subscribeToTaskEnd (context: vscode.ExtensionContext, taskProvider: BitbakeTaskProvider): void {
    context.subscriptions.push(vscode.tasks.onDidEndTask(async (e) => {
      if (e.execution.task.name === 'Bitbake: Scan recipe env') {
        const executionEngine = e.execution.task.execution as BitbakeCustomExecution
        if (executionEngine !== undefined) {
          this.scanResults = executionEngine.pty?.outputDataString ?? ''
          if (this._languageClient === undefined) {
            logger.error('[onDidEndTask] Language client not set, unable to forward recipe environment to the server')
          } else {
            if (this.scanResults !== '') {
              logger.debug('[onDidEndTask] Sending recipe environment to the server')
              const requestParam: RequestParams['ProcessRecipeScanResults'] = { scanResults: this.scanResults, uri: this._currentUriForScan }
              await this._languageClient.sendNotification(RequestMethod.ProcessRecipeScanResults, requestParam)
            }
          }
        }

        const nextRecipeScanTask = this._pendingRecipeScanTasks.shift()
        if (nextRecipeScanTask !== undefined) {
          logger.debug(`[onDidEndTask] Running next pending recipe scan task. url: ${nextRecipeScanTask.uri}`)
          this._currentUriForScan = nextRecipeScanTask.uri
          await runBitbakeTask(nextRecipeScanTask.task, taskProvider)
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
