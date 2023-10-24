/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as assert from 'assert'
import * as vscode from 'vscode'
import { afterEach } from 'mocha'

async function delay (ms: number): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, ms))
}

suite('Bitbake Commands Test Suite', () => {
  let disposables: vscode.Disposable[] = []

  suiteSetup(async function (this: Mocha.Context) {
    this.timeout(10000)
    while (vscode.workspace.workspaceFolders === undefined || vscode.workspace.workspaceFolders?.length === 0) {
      await delay(100)
    }
  })

  afterEach(function () {
    for (const disposable of disposables) {
      disposable.dispose()
    }
    disposables = []
  })

  suiteTeardown(async function (this: Mocha.Context) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const workspaceURI: vscode.Uri = vscode.workspace.workspaceFolders![0].uri
    const buildFolder = vscode.Uri.joinPath(workspaceURI, 'build')
    await vscode.workspace.fs.delete(buildFolder, { recursive: true })
  })

  test('Bitbake can run a task', async () => {
    let taskExecuted = false

    disposables.push(vscode.tasks.onDidEndTask(async (e) => {
      assert.strictEqual(e.execution.task.definition.recipes[0], 'base-files')
      assert.strictEqual(e.execution.task.definition.task, 'unpack')
      taskExecuted = true
    }))

    await vscode.commands.executeCommand('bitbake.run-task', 'base-files', 'unpack')
    // eslint-disable-next-line no-unmodified-loop-condition
    while (!taskExecuted) {
      await delay(100)
    }

    const files = await vscode.workspace.findFiles('build/tmp/work/*/base-files/*/issue')
    assert.strictEqual(files.length, 1)
  }).timeout(300000)

  test('Bitbake can clean a recipe', async () => {
    let taskExecuted = false

    disposables.push(vscode.tasks.onDidEndTask(async (e) => {
      assert.strictEqual(e.execution.task.definition.recipes[0], 'base-files')
      assert.strictEqual(e.execution.task.definition.task, 'clean')
      taskExecuted = true
    }))

    await vscode.commands.executeCommand('bitbake.clean-recipe', 'base-files')
    // eslint-disable-next-line no-unmodified-loop-condition
    while (!taskExecuted) {
      await delay(100)
    }

    const files = await vscode.workspace.findFiles('build/tmp/work/*/base-files')
    assert.strictEqual(files.length, 0)
  }).timeout(300000)

  test('Bitbake can run from task.json', async () => {
    let taskExecuted = false

    disposables.push(vscode.tasks.onDidEndTask(async (e) => {
      assert.strictEqual(e.execution.task.definition.recipes[0], 'base-files')
      assert.strictEqual(e.execution.task.definition.task, 'fetch')
      taskExecuted = true
    }))

    const availableTasks = await vscode.tasks.fetchTasks()
    for (const task of availableTasks) {
      if (task.name === 'Fetch base-files') {
        await vscode.tasks.executeTask(task)
      }
    }
    // eslint-disable-next-line no-unmodified-loop-condition
    while (!taskExecuted) {
      await delay(100)
    }

    const files = await vscode.workspace.findFiles('build/tmp/work/*/base-files/*/temp/log.do_fetch')
    assert.strictEqual(files.length, 1)
  }).timeout(300000)

  // TODO test different bitbake settings
  // TODO mock quik picker for the workspace active recipes commands (use sinon stubs like the cmake extensions)
})
