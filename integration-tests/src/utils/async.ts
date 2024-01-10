/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import assert from 'assert'
import * as vscode from 'vscode'

export async function delay (ms: number): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, ms))
}

/// Asserts that the given predicate will come true within the given timeout.
/// Since we often want to test events have happened but they depend on asynchronous
/// external VSCode and extension processes, we can't listen for them directly.
export async function assertWillComeTrue (predicate: () => Promise<boolean>, timeout: number = 300000): Promise<void> {
  const startTime = Date.now()
  while (!(await predicate()) && (Date.now() - startTime < timeout)) {
    await delay(250)
  }
  assert.ok(predicate())
}

export async function assertWorkspaceWillBeOpen (timeout: number = 10000): Promise<void> {
  await assertWillComeTrue(async () => (vscode.workspace.workspaceFolders !== undefined && vscode.workspace.workspaceFolders?.length !== 0), timeout)
}
