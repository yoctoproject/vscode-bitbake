/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as assert from 'assert'
import * as vscode from 'vscode'
import path from 'path'
import { afterEach } from 'mocha'
import { BITBAKE_TIMEOUT, awaitBitbakeIdle } from '../utils/bitbake'
import { forceDocumentAnalysis, ensureLanguageServersReady } from '../utils/vscode-tools'
import { assertWillComeTrue, delay } from '../utils/async'

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
    await ensureLanguageServersReady()
    await awaitBitbakeIdle()
    await forceDocumentAnalysis(docUri)
    await awaitBitbakeIdle()

    // Show embedded Python document so Pylance analyzes it and generates diagnostics
    // This needs significant time for Pylance to initialize and generate diagnostics
    console.log('[Diagnostics suiteSetup] Starting warmup...')
    let embeddedDocument: vscode.TextDocument | undefined

    console.log(`[Diagnostics warmup] Looking for python document containing "error()"`)

    await assertWillComeTrue(async () => {
      embeddedDocument = vscode.workspace.textDocuments.find((document) => {
        return document.uri.fsPath.includes('embedded-documents') &&
          document.languageId === 'python' &&
          document.getText().includes('error()')
      })
      if (embeddedDocument) {
        console.log(`[Diagnostics warmup] Found embedded document: ${embeddedDocument.uri.fsPath}`)
      }
      return embeddedDocument !== undefined
    }, 500, 10000)

    if (embeddedDocument === undefined) {
      throw new Error('Unable to find embedded python document containing "error()"')
    }

    console.log(`[Diagnostics warmup] Showing embedded document for Pylance analysis...`)
    await vscode.window.showTextDocument(embeddedDocument, { preview: false })
    await awaitBitbakeIdle()

    // Wait for Pylance to analyze - significantly longer in headless mode
    console.log(`[Diagnostics warmup] Waiting 5000ms for Pylance to analyze document in headless mode...`)
    await delay(5000)
    await awaitBitbakeIdle()

    // Re-show the main document to ensure Pylance analyzes the full file
    console.log(`[Diagnostics warmup] Showing main diagnostics.bb document...`)
    const mainDoc = await vscode.workspace.openTextDocument(docUri)
    await vscode.window.showTextDocument(mainDoc, { preview: false })
    await awaitBitbakeIdle()

    // Give Pylance MORE time to generate diagnostics for embedded documents
    console.log('[Diagnostics suiteSetup] Waiting for Pylance to generate diagnostics...')
    await delay(5000)
    await awaitBitbakeIdle()
    console.log('[Diagnostics suiteSetup] Suite setup complete')
  })

  afterEach(function () {
    for (const disposable of disposables) {
      disposable.dispose()
    }
    disposables = []
  })

  test('Diagnostics', async () => {
    console.log('[Diagnostics] Starting test for file:', docUri.fsPath)
    await forceDocumentAnalysis(docUri)
    await awaitBitbakeIdle()

    // Debug: Show all text documents and embedded python documents
    const allDocs = vscode.workspace.textDocuments
    const embeddedPythonDocs = allDocs.filter(d => d.languageId === 'python' && d.uri.fsPath.includes('embedded-documents'))
    console.log(`[Diagnostics DEBUG] Total documents: ${allDocs.length}`)
    console.log(`[Diagnostics DEBUG] Embedded Python documents: ${embeddedPythonDocs.length}`)
    embeddedPythonDocs.forEach(doc => {
      console.log(`  - ${doc.uri.fsPath.split('/').pop()}: ${doc.getText().length} chars`)
    })

    // Debug: Check Pylance extension
    const pylanceExt = vscode.extensions.getExtension('ms-python.vscode-pylance')
    console.log(`[Diagnostics DEBUG] Pylance extension active: ${pylanceExt?.isActive}`)

    let attempts = 0

    try {
      await assertWillComeTrue(async () => {
        attempts++
        const diagnostics = vscode.languages.getDiagnostics()

        // Always log first few attempts and every 20th
        if (attempts <= 3 || attempts % 20 === 0) {
          console.log(`[Diagnostics] Attempt ${attempts}: Checking ${diagnostics.length} URIs for diagnostics`)

          // Log diagnostics for ALL URIs, not just .bb files
          diagnostics.forEach(([uri, fileDiagnostics]) => {
            const fileName = uri.fsPath.split('/').pop()
            if (fileDiagnostics.length > 0) {
              console.log(`  📋 [${fileName}] ${fileDiagnostics.length} diagnostics`)
              fileDiagnostics.forEach((d, i) => {
                console.log(`    [${i}] source=${d.source}, range=${d.range.start.line}:${d.range.start.character}, message=${d.message.substring(0, 50)}`)
              })
            }
          })

          // Specifically check embedded python documents
          const embeddedPythonDiags = diagnostics.find(([uri]) => {
            return uri.fsPath.includes('embedded-documents') && uri.fsPath.includes('.py')
          })
          if (embeddedPythonDiags) {
            console.log(`  🔍 Found embedded python diagnostics: ${embeddedPythonDiags[1].length} items`)
          } else {
            console.log(`  🔍 NO embedded python diagnostics found (this is the problem!)`)
          }
        }

        const found = diagnostics.some(([uri, fileDiagnostics]) => {
          const uriMatches = uri.path.includes('diagnostics.bb')
          if (uriMatches && fileDiagnostics.length > 0) {
            console.log(`[Diagnostics] Found diagnostic details for .bb file:`)
            fileDiagnostics.forEach((d, i) => {
              console.log(`  [${i}] source=${d.source}, range=${d.range.start.line}:${d.range.start.character}-${d.range.end.line}:${d.range.end.character}`)
            })
          }
          return uriMatches &&
            fileDiagnostics.some((diagnostic) =>
            diagnostic.source?.includes('bitbake-python') &&
            diagnostic.range.isEqual(new vscode.Range(1, 4, 1, 9))
            )
        })
        if (found && attempts > 1) {
          console.log(`[Diagnostics] Found expected diagnostic after ${attempts} attempts`)
        }
        return found
      }, 500, 100000) // 500ms interval, 100s timeout
    } catch (err) {
      console.error(`[Diagnostics] Test failed after ${attempts} attempts`)

      // Final debug dump
      const finalDiags = vscode.languages.getDiagnostics()
      console.log(`[Diagnostics DEBUG] Final state: ${finalDiags.length} URIs with diagnostics`)
      finalDiags.forEach(([uri, diags]) => {
        if (diags.length > 0) {
          const fileName = uri.fsPath.split('/').pop()
          console.log(`  ${fileName}: ${diags.length} diagnostics`)
        }
      })

      throw err
    }
  }).timeout(BITBAKE_TIMEOUT)
})
