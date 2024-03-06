/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as assert from 'assert'
import * as vscode from 'vscode'
import path from 'path'
import { assertWillComeTrue } from '../utils/async'
import { BITBAKE_TIMEOUT } from '../utils/bitbake'

suite('Bitbake CodeAction Test Suite', () => {
  const filePath = path.resolve(__dirname, '../../project-folder/sources/meta-fixtures/code-actions.bb')
  const docUri = vscode.Uri.parse(`file://${filePath}`)

  suiteSetup(async function (this: Mocha.Context) {
    this.timeout(100000)
    const vscodeBitbake = vscode.extensions.getExtension('yocto-project.yocto-bitbake')
    if (vscodeBitbake === undefined) {
      assert.fail('Bitbake extension is not available')
    }
    await vscodeBitbake.activate()
    await vscode.workspace.openTextDocument(docUri)
  })

  const testPythonAddImport = async (
    targetRange: vscode.Range,
    expectedTitle: string,
    expectedNewText: string,
    expectedRange: vscode.Range
  ): Promise<void> => {
    let actionResult: vscode.CodeAction[] = []

    await assertWillComeTrue(async () => {
      actionResult = await vscode.commands.executeCommand<vscode.CodeAction[]>(
        'vscode.executeCodeActionProvider',
        docUri,
        targetRange
      )
      return actionResult.length > 0
    })

    const expectedAction = actionResult.find(action => action.title === expectedTitle)
    if (expectedAction === undefined) {
      assert.fail('expectedAction is undefined')
    }
    assert.notEqual(expectedAction, undefined)
    const workspaceEdit = expectedAction.edit
    if (workspaceEdit === undefined) {
      assert.fail('edit is undefined')
    }
    assert.strictEqual(workspaceEdit.entries().length, 1)
    const [uri, textEdit] = workspaceEdit.entries()[0]
    assert.strictEqual(uri.fsPath, docUri.fsPath)
    assert.strictEqual(textEdit.length, 1)
    assert.strictEqual(textEdit[0].newText, expectedNewText)
    const range = textEdit[0].range
    assert.strictEqual(range.start.isEqual(expectedRange.start), true)
  }

  test('CodeAction can properly show "import random"', async () => {
    const targetRange = new vscode.Range(1, 4, 1, 10)
    const expectedTitle = 'Add "import random"'
    const expectedNewText = '    import random\n'
    const expectedRange = new vscode.Range(1, 0, 1, 0)
    await testPythonAddImport(targetRange, expectedTitle, expectedNewText, expectedRange)
  }).timeout(BITBAKE_TIMEOUT)

  test('CodeAction can properly show "from random import random"', async () => {
    const targetRange = new vscode.Range(1, 4, 1, 10)
    const expectedTitle = 'Add "from random import random"'
    const expectedNewText = '    from random import random\n'
    const expectedRange = new vscode.Range(1, 0, 1, 0)
    await testPythonAddImport(targetRange, expectedTitle, expectedNewText, expectedRange)
  }).timeout(BITBAKE_TIMEOUT)
})
