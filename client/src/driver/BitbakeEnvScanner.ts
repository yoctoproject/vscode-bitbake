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

export class BitbakeEnvScanner implements vscode.Disposable {
  static readonly recipeEnvScanTaskName = 'Bitbake: Scan recipe env'
  static readonly globalEnvScanTaskName = 'Bitbake: Scan global env'
  private _languageClient: LanguageClient | undefined
  private _pendingTask: vscode.Task | null = null

  readonly envScanComplete = new vscode.EventEmitter<vscode.TaskDefinition>()

  dispose (): void {
    this.envScanComplete.dispose()
  }

  async scanGlobalEnv (taskProvider: BitbakeTaskProvider): Promise<void> {
    const taskDefinition: vscode.TaskDefinition = { type: 'bitbake', options: { parseOnly: true, env: true } }
    await this.scan(taskProvider, BitbakeEnvScanner.globalEnvScanTaskName, taskDefinition)
  }

  /**
   *
   * @param chosenRecipe The recipe to scan
   * @param taskProvider The task provider, see more in BitbakeTaskProvider
   * @param uri The URI of the chosen recipe
   * @returns
   */
  async scanRecipeEnv (chosenRecipe: string, taskProvider: BitbakeTaskProvider, uri: unknown): Promise<void> {
    if (chosenRecipe === '') {
      logger.debug('[BitbakeEnvScanner] No recipe chosen for scan')
      return
    }

    await this.scan(taskProvider, BitbakeEnvScanner.recipeEnvScanTaskName, { type: 'bitbake', recipes: [chosenRecipe], uri, options: { parseOnly: true, env: true } })
  }

  private async scan (taskProvider: BitbakeTaskProvider, taskName: string, taskDefinition: vscode.TaskDefinition): Promise<void> {
    const scanEnvTask = new vscode.Task(
      taskDefinition,
      vscode.TaskScope.Workspace,
      taskName,
      'bitbake'
    )

    const runningTasks = vscode.tasks.taskExecutions
    if (runningTasks.some((execution) => execution.task.name === BitbakeEnvScanner.recipeEnvScanTaskName || execution.task.name === BitbakeEnvScanner.globalEnvScanTaskName)) {
      logger.debug('[BitbakeEnvScanner] An environment scan is already running, adding this one to the pending tasks')
      this._pendingTask = scanEnvTask
      return
    }

    await runBitbakeTask(scanEnvTask, taskProvider)
    // Wait for the task and server side to have done the processing
    await new Promise<void>((resolve) => {
      const disposable = this.envScanComplete.event((definition) => {
        if (definition === scanEnvTask.definition) {
          disposable.dispose()
          resolve()
        }
      })
    })
  }

  subscribeToTaskEnd (context: vscode.ExtensionContext, taskProvider: BitbakeTaskProvider): void {
    context.subscriptions.push(vscode.tasks.onDidEndTask(async (e) => {
      if (this._languageClient === undefined) {
        logger.error('[onDidEndTask] Language client not set, unable to forward environment to the server')
        return
      }

      const executionEngine = e.execution.task.execution as BitbakeCustomExecution
      if (executionEngine === undefined) {
        logger.error('[onDidEndTask] Execution engine not set, unable to forward environment to the server')
        return
      }

      const scanResults = executionEngine.pty?.outputDataString ?? ''
      if (e.execution.task.name === BitbakeEnvScanner.recipeEnvScanTaskName) {
        const uri = e.execution.task.definition.uri
        const chosenRecipe = e.execution.task.definition.recipes[0]

        logger.debug('[onDidEndTask] Sending recipe environment to the server')
        const requestParam: RequestParams['ProcessRecipeScanResults'] = { scanResults, uri, chosenRecipe }
        await this._languageClient.sendRequest(RequestMethod.ProcessRecipeScanResults, requestParam)
      } else if (e.execution.task.name === BitbakeEnvScanner.globalEnvScanTaskName) {
        logger.debug('[onDidEndTask] Sending global environment to the server')
        const requestParam: RequestParams['ProcessGlobalEnvScanResults'] = { scanResults }
        await this._languageClient.sendRequest(RequestMethod.ProcessGlobalEnvScanResults, requestParam)
      }
      this.envScanComplete.fire(e.execution.task.definition)

      if (this._pendingTask !== null) {
        logger.debug(`[onDidEndTask] Running the pending scan task. url: ${this._pendingTask.definition.uri}`)
        await runBitbakeTask(this._pendingTask, taskProvider)
        this._pendingTask = null
      }
    }))
  }

  setLanguageClient (client: LanguageClient): void {
    this._languageClient = client
  }
}

const bitbakeEnvScanner = new BitbakeEnvScanner()
export default bitbakeEnvScanner
