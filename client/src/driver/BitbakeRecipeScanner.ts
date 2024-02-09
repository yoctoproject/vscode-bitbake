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
  static readonly taskName = 'Bitbake: Scan recipe env'

  private _languageClient: LanguageClient | undefined
  private _currentUriForScan: string | undefined = undefined
  private _currentRecipeForScan: string | undefined = undefined
  private _pendingRecipeScanTasks: { task: vscode.Task, uri: string, recipe: string } | null = null

  public scanResults: string = ''
  public processedScanResults: Record<string, unknown> | undefined

  /**
   *
   * @param chosenRecipe The recipe to scan
   * @param taskProvider The task provider, see more in BitbakeTaskProvider
   * @param uri The URI of the chosen recipe
   * @param triggeredByCommandPalette If the scan was triggered by the command palette
   * @returns
   */
  async scan (chosenRecipe: string, taskProvider: BitbakeTaskProvider, uri: any): Promise<void> {
    if (chosenRecipe === '') {
      logger.debug('[BitbakeRecipeScanner] No recipe chosen for scan')
      return
    }

    const taskName = BitbakeRecipeScanner.taskName
    const scanRecipeEnvTask = new vscode.Task(
      { type: 'bitbake', recipes: [chosenRecipe], options: { parseOnly: true, env: true } },
      vscode.TaskScope.Workspace,
      taskName,
      'bitbake'
    )

    const runningTasks = vscode.tasks.taskExecutions
    if (runningTasks.some((execution) => execution.task.name === taskName)) {
      logger.debug('[BitbakeRecipeScanner] Recipe scan is already running, pushing to pending tasks')
      this._pendingRecipeScanTasks = { task: scanRecipeEnvTask, uri, recipe: chosenRecipe }
      return
    }

    this._currentUriForScan = uri
    this._currentRecipeForScan = chosenRecipe

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
              const requestParam: RequestParams['ProcessRecipeScanResults'] = { scanResults: this.scanResults, uri: this._currentUriForScan, chosenRecipe: this._currentRecipeForScan }
              await this._languageClient.sendNotification(RequestMethod.ProcessRecipeScanResults, requestParam)
              this._currentUriForScan = undefined
              this._currentRecipeForScan = undefined
            }
          }
        }

        if (this._pendingRecipeScanTasks !== null) {
          logger.debug(`[onDidEndTask] Running the pending recipe scan task. url: ${this._pendingRecipeScanTasks.uri}`)
          this._currentUriForScan = this._pendingRecipeScanTasks.uri
          this._currentRecipeForScan = this._pendingRecipeScanTasks.recipe
          await runBitbakeTask(this._pendingRecipeScanTasks.task, taskProvider)
          this._pendingRecipeScanTasks = null
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
