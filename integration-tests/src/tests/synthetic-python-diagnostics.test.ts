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

const waitForEmbeddedDocument = async (
  languageId: string,
  expectedText: string,
  timeout: number = 10000,
  description: string = `embedded ${languageId} document containing "${expectedText}"`
): Promise<vscode.TextDocument> => {
  return await new Promise<vscode.TextDocument>((resolve, reject) => {
    let settled = false
    const disposables: vscode.Disposable[] = []

    const findEmbeddedDocument = (): vscode.TextDocument | undefined =>
      vscode.workspace.textDocuments.find((document) =>
        document.uri.fsPath.includes('embedded-documents') &&
        document.languageId === languageId &&
        document.getText().includes(expectedText)
      )

    const timeoutHandle = setTimeout(() => {
      finish(undefined, new Error(`Timed out waiting for ${description}`))
    }, timeout)

    const finish = (document?: vscode.TextDocument, error?: unknown): void => {
      if (settled) {
        return
      }
      settled = true
      clearTimeout(timeoutHandle)
      for (const disposable of disposables) {
        disposable.dispose()
      }

      if (error !== undefined) {
        reject(error)
      } else if (document !== undefined) {
        resolve(document)
      }
    }

    const check = (): void => {
      const embeddedDocument = findEmbeddedDocument()
      if (embeddedDocument !== undefined) {
        finish(embeddedDocument)
      }
    }

    disposables.push(vscode.workspace.onDidOpenTextDocument(check))
    disposables.push(vscode.workspace.onDidChangeTextDocument(check))
    check()
  })
}

const warmEmbeddedDocument = async (
  languageId: string,
  expectedText: string,
  timeout: number = 10000,
  description: string = `embedded ${languageId} document containing "${expectedText}"`
): Promise<vscode.TextDocument> => {
  const embeddedDocument = await waitForEmbeddedDocument(languageId, expectedText, timeout, description)

  await vscode.window.showTextDocument(embeddedDocument, { preview: false })

  return embeddedDocument
}

suite('Bitbake Synthetic Python Diagnostics Test Suite', () => {
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

  test('maps synthetic Pylance diagnostics from embedded Python document', async () => {
    await forceDocumentAnalysis(docUri)

    const embeddedPythonDoc = await warmEmbeddedDocument(
      'python',
      'error()',
      10000,
      'Python embedded document containing "error()"'
    )

    const errorOffset = embeddedPythonDoc.getText().indexOf('error')
    assert.notStrictEqual(errorOffset, -1, 'embedded Python document should contain "error"')

    const errorStart = embeddedPythonDoc.positionAt(errorOffset)
    const errorRange = new vscode.Range(
      errorStart,
      new vscode.Position(errorStart.line, errorStart.character + 'error'.length)
    )

    const syntheticPylanceDiagnostics = vscode.languages.createDiagnosticCollection('synthetic-pylance')
    disposables.push(syntheticPylanceDiagnostics)

    syntheticPylanceDiagnostics.set(embeddedPythonDoc.uri, [
      new vscode.Diagnostic(
        errorRange,
        '"error" is not defined',
        vscode.DiagnosticSeverity.Error
      )
    ])

    const diagnostics = vscode.languages.getDiagnostics(embeddedPythonDoc.uri)
    for (const diagnostic of diagnostics) {
      diagnostic.source = 'Pylance'
    }
    syntheticPylanceDiagnostics.set(embeddedPythonDoc.uri, diagnostics)

    await waitForDiagnostics(
      () => vscode.languages.getDiagnostics(docUri).some(diagnostic =>
        diagnostic.source?.includes('bitbake-python') &&
        diagnostic.message.includes('error') &&
        diagnostic.range.isEqual(new vscode.Range(1, 4, 1, 9))
      ),
      DIAGNOSTICS_WAIT_TIMEOUT,
      'synthetic Pylance diagnostics remapped to diagnostics.bb'
    )
  }).timeout(BITBAKE_TIMEOUT)
})
