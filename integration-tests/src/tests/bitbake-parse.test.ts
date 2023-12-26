/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as assert from 'assert'
import * as vscode from 'vscode'
import { afterEach } from 'mocha'

import path from 'path'
import { BITBAKE_TIMEOUT, addLayer, resetLayer } from '../utils/bitbake'
import { assertWillComeTrue, assertWorkspaceWillBeOpen, delay } from '../utils/async'

suite('Bitbake Parsing Test Suite', () => {
  let disposables: vscode.Disposable[] = []
  let workspaceURI: vscode.Uri
  let buildFolder: vscode.Uri

  suiteSetup(async function (this: Mocha.Context) {
    this.timeout(BITBAKE_TIMEOUT)
    await assertWorkspaceWillBeOpen()
    workspaceURI = (vscode.workspace.workspaceFolders as vscode.WorkspaceFolder[])[0].uri
    buildFolder = vscode.Uri.joinPath(workspaceURI, 'build')

    // Generate the build directory for the addLayer functions to work
    let taskExecuted = false
    const disposable = vscode.tasks.onDidEndTask(async (e) => {
      if (e.execution.task.definition.options.parseOnly === true) {
        taskExecuted = true
      }
    })
    await vscode.commands.executeCommand('bitbake.parse-recipes')
    await assertWillComeTrue(async () => taskExecuted)
    disposable.dispose()
  })

  afterEach(function () {
    for (const disposable of disposables) {
      disposable.dispose()
    }
    disposables = []
  })

  suiteTeardown(async function (this: Mocha.Context) {
    this.timeout(10000)
    await vscode.workspace.fs.delete(buildFolder, { recursive: true })
  })

  test('Bitbake can succesfully parse poky', async () => {
    let taskExecuted = false

    disposables.push(vscode.tasks.onDidEndTask(async (e) => {
      assert.strictEqual(e.execution.task.definition.options.parseOnly, true)
      taskExecuted = true
    }))

    // Wait for the diagnostics to be updated.
    await delay(500)

    await vscode.commands.executeCommand('bitbake.parse-recipes')
    await assertWillComeTrue(async () => taskExecuted)

    const diagnostics = vscode.languages.getDiagnostics()
    assert.strictEqual(diagnostics.length, 0)
  }).timeout(BITBAKE_TIMEOUT)

  test('Bitbake can detect parsing errors', async () => {
    let taskExecuted = false
    const workspacePath: string = workspaceURI.fsPath

    disposables.push(vscode.tasks.onDidEndTask(async (e) => {
      assert.strictEqual(e.execution.task.definition.options.parseOnly, true)
      taskExecuted = true
    }))

    await addLayer(path.resolve(__dirname, '../../project-folder/sources/meta-error'), workspacePath)

    await vscode.commands.executeCommand('bitbake.parse-recipes')
    await assertWillComeTrue(async () => taskExecuted)

    await resetLayer(path.resolve(__dirname, '../../project-folder/sources/meta-error'), workspacePath)

    // Wait for the diagnostics to be updated. Another method would be to use
    // the onDidChangeDiagnostics event, but it is not useful with the other test
    // that checks for no diagnostics.
    await delay(500)

    const diagnostics = vscode.languages.getDiagnostics()
    assert.strictEqual(diagnostics.length, 1)
  }).timeout(BITBAKE_TIMEOUT)
})
