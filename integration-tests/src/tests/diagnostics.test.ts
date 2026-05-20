/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as assert from 'assert'
import * as vscode from 'vscode'
import path from 'path'
import { afterEach } from 'mocha'
import { BITBAKE_TIMEOUT } from '../utils/bitbake'
import { forceDocumentAnalysis, waitForDiagnostics } from '../utils/vscode-tools'

// These tests depend on Pylance/Pyright diagnostics from embedded Python documents.
// In GitHub Actions' fresh VS Code profile, Pylance can be installed but still fail
// to emit those diagnostics deterministically.
// Keep the tests locally, but do not make CI depend on external Pylance behaviour.
const pylanceDependentSuite = process.env.GITHUB_ACTIONS === 'true' ? suite.skip : suite

pylanceDependentSuite('Bitbake Diagnostics Test Suite', () => {
  const filePath = path.resolve(__dirname, '../../project-folder/sources/meta-fixtures/diagnostics.bb')
  const docUri = vscode.Uri.parse(`file://${filePath}`)
  const DIAGNOSTICS_WAIT_TIMEOUT = BITBAKE_TIMEOUT - 30000

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
    await forceDocumentAnalysis(docUri)

    await waitForDiagnostics(
      () => {
        const diagnostics = vscode.languages.getDiagnostics()
        return diagnostics.some(([uri, fileDiagnostics]) =>
          uri.path.includes('diagnostics.bb') &&
          fileDiagnostics.some((diagnostic) =>
            diagnostic.source?.includes('bitbake-python') &&
            diagnostic.range.isEqual(new vscode.Range(1, 4, 1, 9))
          )
        )
      },
      DIAGNOSTICS_WAIT_TIMEOUT,
      'mapped BitBake diagnostics for "error()" on diagnostics.bb'
    )
  }).timeout(BITBAKE_TIMEOUT)
})
