/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as vscode from 'vscode'
import { assertWillComeTrue } from './async'
import path from 'path'

export const BITBAKE_TIMEOUT = 300000

/// Wait for the bitbake parsing task to finish
export async function awaitBitbakeParsingResult (): Promise<void> {
  let taskExecuted = false
  const disposable = vscode.tasks.onDidEndTask(async (e) => {
    if (e.execution.task.definition.options.parseOnly === true) {
      taskExecuted = true
    }
  })
  await assertWillComeTrue(async () => taskExecuted)
  disposable.dispose()
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
