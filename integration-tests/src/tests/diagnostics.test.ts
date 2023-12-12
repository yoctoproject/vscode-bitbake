/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as assert from 'assert'
import * as vscode from 'vscode'
import path from 'path'
import { afterEach } from 'mocha'

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
    await new Promise<vscode.Diagnostic[]>((resolve) => {
      let nbChanges = 0
      const disposable = vscode.languages.onDidChangeDiagnostics((e) => {
        if (e.uris.some((uri) => uri.toString() === docUri.toString())) {
          nbChanges++
        }
        const diagnostics = vscode.languages.getDiagnostics(docUri)
        if (nbChanges === 3) {
          resolve(diagnostics)
        }
      })
      disposables.push(disposable)
    }).then((diagnostics) => {
      assert.strictEqual(diagnostics.length, 1)
      assert.strictEqual(diagnostics[0].source, 'Pylance')
      assert.deepEqual(diagnostics[0].range, new vscode.Range(1, 4, 1, 9))
    }).catch((err) => {
      assert.fail(err)
    })
  }).timeout(300000)
})
