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

    // Code action titles are user-facing and can be localized by VS Code/Pylance.
    // Assert the stable edit instead of matching a locale-dependent title.
    const expectedAction = actionResult.find(action => {
      const entries = action.edit?.entries()
      if (entries === undefined || entries.length !== 1) {
        return false
      }

      const [uri, textEdit] = entries[0]
      return uri.fsPath === docUri.fsPath &&
        textEdit.length === 1 &&
        textEdit[0].newText === expectedNewText &&
        textEdit[0].range.isEqual(expectedRange)
    })

    assert.notStrictEqual(
      expectedAction,
      undefined,
      `No code action produced the expected edit: ${JSON.stringify(expectedNewText)}`
    )
  }

  test('CodeAction can properly show "import random"', async () => {
    const targetRange = new vscode.Range(1, 4, 1, 10)
    const expectedNewText = '    import random\n'
    const expectedRange = new vscode.Range(1, 0, 1, 0)
    await testPythonAddImport(targetRange, expectedNewText, expectedRange)
  }).timeout(BITBAKE_TIMEOUT)

  test('CodeAction can properly show "from random import random"', async () => {
    const targetRange = new vscode.Range(1, 4, 1, 10)
    const expectedNewText = '    from random import random\n'
    const expectedRange = new vscode.Range(1, 0, 1, 0)
    await testPythonAddImport(targetRange, expectedNewText, expectedRange)
  }).timeout(BITBAKE_TIMEOUT)
})
