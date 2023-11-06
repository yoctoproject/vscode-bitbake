/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as assert from 'assert'
import * as vscode from 'vscode'
import { afterEach } from 'mocha'

import path from 'path'
import { addLayer, resetLayer } from '../utils/bitbake'

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

  test('Bitbake can succesfully parse poky', async () => {
    let taskExecuted = false

    disposables.push(vscode.tasks.onDidEndTask(async (e) => {
      assert.strictEqual(e.execution.task.definition.options.parseOnly, true)
      taskExecuted = true
    }))

    // Wait for the diagnostics to be updated.
    await delay(500)

    await vscode.commands.executeCommand('bitbake.parse-recipes')
    // eslint-disable-next-line no-unmodified-loop-condition
    while (!taskExecuted) {
      await delay(100)
    }

    const diagnostics = vscode.languages.getDiagnostics()
    assert.strictEqual(diagnostics.length, 0)
  }).timeout(300000)

  test('Bitbake can detect parsing errors', async () => {
    let taskExecuted = false
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const workspacePath: string = vscode.workspace.workspaceFolders![0].uri.fsPath

    disposables.push(vscode.tasks.onDidEndTask(async (e) => {
      assert.strictEqual(e.execution.task.definition.options.parseOnly, true)
      taskExecuted = true
    }))

    await addLayer(path.resolve(__dirname, '../../project-folder/sources/meta-error'), workspacePath)

    await vscode.commands.executeCommand('bitbake.parse-recipes')

    // eslint-disable-next-line no-unmodified-loop-condition
    while (!taskExecuted) {
      await delay(100)
    }

    await resetLayer(path.resolve(__dirname, '../../project-folder/sources/meta-error'), workspacePath)

    // Wait for the diagnostics to be updated. Another method would be to use
    // the onDidChangeDiagnostics event, but it is not useful with the other test
    // that checks for no diagnostics.
    await delay(500)

    const diagnostics = vscode.languages.getDiagnostics()
    assert.strictEqual(diagnostics.length, 1)
  }).timeout(300000)
})
