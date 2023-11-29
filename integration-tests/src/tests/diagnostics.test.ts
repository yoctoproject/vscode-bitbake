/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as assert from 'assert'
import * as vscode from 'vscode'
import path from 'path'

suite('Bitbake Diagnostics Test Suite', () => {
  const filePath = path.resolve(__dirname, '../../project-folder/sources/meta-fixtures/diagnostics.bb')
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

  test('Diagnostics', async () => {
    await new Promise<vscode.Diagnostic[]>((resolve, reject) => {
      let nbChanges = 0
      vscode.languages.onDidChangeDiagnostics((e) => {
        const diagnostics = vscode.languages.getDiagnostics(docUri)
        if (diagnostics.length > 0) {
          resolve(diagnostics)
        }
        if (nbChanges > 2) {
          reject(new Error('Waited too long for diagnostics'))
        }
        nbChanges++
      })
    }).then((diagnostics) => {
      assert.strictEqual(diagnostics.length, 1)
      assert.strictEqual(diagnostics[0].source, 'Pylance')
    }).catch((err) => {
      assert.fail(err)
    })
  }).timeout(300000)
})
