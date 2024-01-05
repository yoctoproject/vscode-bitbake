/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as assert from 'assert'
import * as vscode from 'vscode'
import { afterEach } from 'mocha'
import { assertWillComeTrue, assertWorkspaceWillBeOpen } from '../utils/async'
import { BITBAKE_TIMEOUT } from '../utils/bitbake'

suite('Bitbake Commands Test Suite', () => {
  let disposables: vscode.Disposable[] = []

  suiteSetup(async function (this: Mocha.Context) {
    this.timeout(10000)
    await assertWorkspaceWillBeOpen()
  })

  afterEach(function () {
    for (const disposable of disposables) {
      disposable.dispose()
    }
    disposables = []
  })

  suiteTeardown(async function (this: Mocha.Context) {
    this.timeout(10000)

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const workspaceURI: vscode.Uri = vscode.workspace.workspaceFolders![0].uri
    const buildFolder = vscode.Uri.joinPath(workspaceURI, 'build')
    await vscode.workspace.fs.delete(buildFolder, { recursive: true })
  })

  test('Bitbake can run a task', async () => {
    await vscode.commands.executeCommand('bitbake.run-task', 'base-files', 'unpack')
    await assertWillComeTrue(async () => {
      const files = await vscode.workspace.findFiles('build/tmp/work/*/base-files/*/issue')
      return files.length === 1
    })
  }).timeout(BITBAKE_TIMEOUT)

  test('Bitbake can clean a recipe', async () => {
    await vscode.commands.executeCommand('bitbake.clean-recipe', 'base-files')
    await assertWillComeTrue(async () => {
      const files = await vscode.workspace.findFiles('build/tmp/work/*/base-files')
      return files.length === 0
    })
  }).timeout(BITBAKE_TIMEOUT)

  test('Bitbake can run from task.json', async () => {
    let taskExecuted = false

    disposables.push(vscode.tasks.onDidEndTask(async (e) => {
      if (e.execution.task.definition.recipes !== undefined && e.execution.task.definition.recipes[0] === 'base-files') {
        assert.strictEqual(e.execution.task.definition.task, 'fetch')
        taskExecuted = true
      }
    }))

    const availableTasks = await vscode.tasks.fetchTasks()
    for (const task of availableTasks) {
      if (task.name === 'Fetch base-files') {
        await vscode.tasks.executeTask(task)
      }
    }
    await assertWillComeTrue(async () => taskExecuted)

    const files = await vscode.workspace.findFiles('build/tmp/work/*/base-files/*/temp/log.do_fetch')
    assert.strictEqual(files.length, 1)
  }).timeout(BITBAKE_TIMEOUT)

  test('Bitbake can create a devtool modify workspace', async () => {
    await vscode.commands.executeCommand('bitbake.devtool-modify', 'busybox')
    await assertWillComeTrue(async () => {
      const files = await vscode.workspace.findFiles('build/workspace/sources/busybox/README')
      return files.length === 1
    })
  }).timeout(BITBAKE_TIMEOUT)
})
