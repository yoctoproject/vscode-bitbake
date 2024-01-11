/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

/*
import * as assert from 'assert'
import * as vscode from 'vscode'
import path from 'path'
import { afterEach } from 'mocha'
import { BITBAKE_TIMEOUT } from '../utils/bitbake'
import { assertWillComeTrue } from '../utils/async'

suite('Bitbake Diagnostics Test Suite', () => {
  const filePath = path.resolve(__dirname, '../../project-folder/sources/meta-fixtures/diagnostics.bb')
  const docUri = vscode.Uri.parse(`file://${filePath}`)

  let disposables: vscode.Disposable[] = []

  suiteSetup(async function (this: Mocha.Context) {
    this.timeout(100000)
    const vscodeBitbake = vscode.extensions.getExtension('yocto-project.yocto-bitbake')
    if (vscodeBitbake === undefined) {
      assert.fail('Bitbake extension is not available')
    }
    await vscodeBitbake.activate()
  })

  afterEach(function () {
    for (const disposable of disposables) {
      disposable.dispose()
    }
    disposables = []
  })

  test('Diagnostics', async () => {
    void vscode.workspace.openTextDocument(docUri)
    await assertWillComeTrue(async () => {
      const diagnostics = vscode.languages.getDiagnostics(docUri)
      return diagnostics.length === 1 &&
        diagnostics[0].source === 'Pylance' &&
        diagnostics[0].range.isEqual(new vscode.Range(1, 4, 1, 9))
    })
  }).timeout(BITBAKE_TIMEOUT)
})
*/
