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
  private _pendingRecipeScanTasks: vscode.Task | null = null

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
      { type: 'bitbake', recipes: [chosenRecipe], uri, options: { parseOnly: true, env: true } },
      vscode.TaskScope.Workspace,
      taskName,
      'bitbake'
    )

    const runningTasks = vscode.tasks.taskExecutions
    if (runningTasks.some((execution) => execution.task.name === taskName)) {
      logger.debug('[BitbakeRecipeScanner] Recipe scan is already running, pushing to pending tasks')
      this._pendingRecipeScanTasks = scanRecipeEnvTask
      return
    }

    await runBitbakeTask(scanRecipeEnvTask, taskProvider)
  }

  subscribeToTaskEnd (context: vscode.ExtensionContext, taskProvider: BitbakeTaskProvider): void {
    context.subscriptions.push(vscode.tasks.onDidEndTask(async (e) => {
      if (e.execution.task.name === 'Bitbake: Scan recipe env') {
        const uri = e.execution.task.definition.uri
        const chosenRecipe = e.execution.task.definition.recipes[0]

        const executionEngine = e.execution.task.execution as BitbakeCustomExecution
        if (executionEngine !== undefined) {
          this.scanResults = executionEngine.pty?.outputDataString ?? ''
          if (this._languageClient === undefined) {
            logger.error('[onDidEndTask] Language client not set, unable to forward recipe environment to the server')
          } else {
            if (this.scanResults !== '' && uri !== undefined && chosenRecipe !== undefined) {
              logger.debug('[onDidEndTask] Sending recipe environment to the server')
              const requestParam: RequestParams['ProcessRecipeScanResults'] = { scanResults: this.scanResults, uri, chosenRecipe }
              await this._languageClient.sendNotification(RequestMethod.ProcessRecipeScanResults, requestParam)
            }
          }
        }

        if (this._pendingRecipeScanTasks !== null) {
          logger.debug(`[onDidEndTask] Running the pending recipe scan task. url: ${this._pendingRecipeScanTasks.definition.uri}`)
          await runBitbakeTask(this._pendingRecipeScanTasks, taskProvider)
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
