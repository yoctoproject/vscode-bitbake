/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as vscode from 'vscode'
import { assertWillComeTrue, delay } from './async'
import path from 'path'

// Increased timeout for CI headless environments where language servers take longer to respond
export const BITBAKE_TIMEOUT = 10 * 60 * 1000 // 10 minutes

const isBitbakeTaskExecution = (execution: vscode.TaskExecution): boolean => {
  return execution.task.definition.type === 'bitbake'
}

export async function awaitBitbakeIdle (quietPeriod: number = 1500, timeout: number = BITBAKE_TIMEOUT): Promise<void> {
  const startTime = Date.now()
  let idleStartTime: number | undefined

  while (Date.now() - startTime < timeout) {
    const hasRunningBitbakeTask = vscode.tasks.taskExecutions.some(isBitbakeTaskExecution)
    if (hasRunningBitbakeTask) {
      idleStartTime = undefined
    } else if (idleStartTime === undefined) {
      idleStartTime = Date.now()
    } else if (Date.now() - idleStartTime >= quietPeriod) {
      return
    }

    await delay(250)
  }

  throw new Error('Timed out waiting for BitBake tasks to become idle')
}

/// Wait for the bitbake parsing task to finish
export async function awaitBitbakeParsingResult (): Promise<void> {
  let taskExecuted = vscode.tasks.taskExecutions.some((execution) => execution.task.definition.type === 'bitbake' && execution.task.definition.options?.parseOnly === true)
  const disposable = vscode.tasks.onDidEndTask((e) => {
    if (e.execution.task.definition.type === 'bitbake' && e.execution.task.definition.options?.parseOnly === true) {
      taskExecuted = true
    }
  })

  try {
    await assertWillComeTrue(async () => taskExecuted)
    await awaitBitbakeIdle()
  } finally {
    disposable.dispose()
  }
}

/// Copy a recipe into poky
export async function importRecipe (recipePath: string, pokyPath: string): Promise<void> {
  const pokyDestinationPath = path.resolve(pokyPath, 'meta/recipes-core/base-files', path.basename(recipePath))
  await vscode.workspace.fs.copy(vscode.Uri.file(recipePath), vscode.Uri.file(pokyDestinationPath))
}

export async function removeRecipe (recipePath: string, pokyPath: string): Promise<void> {
  const pokyDestinationPath = path.resolve(pokyPath, 'meta/recipes-core/base-files', path.basename(recipePath))
  await vscode.workspace.fs.delete(vscode.Uri.file(pokyDestinationPath))
}
