/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as assert from 'assert'
import * as vscode from 'vscode'
import path from 'path'
import { assertWillComeTrue, delay } from '../utils/async'
import { forceDocumentAnalysis, ensureLanguageServersReady } from '../utils/vscode-tools'
import { BITBAKE_TIMEOUT, awaitBitbakeIdle } from '../utils/bitbake'

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
    await ensureLanguageServersReady()
    await awaitBitbakeIdle()
    await forceDocumentAnalysis(docUri)
    await awaitBitbakeIdle()
  })

  const prepareCodeActionDocument = async (): Promise<vscode.TextDocument> => {
    const document = await vscode.workspace.openTextDocument(docUri)
    await vscode.window.showTextDocument(document, { preview: false })
    await awaitBitbakeIdle()
    return await vscode.workspace.openTextDocument(docUri)
  }

  const warmEmbeddedDocument = async (languageId: string, expectedText: string): Promise<void> => {
    let embeddedDocument: vscode.TextDocument | undefined

    console.log(`[warmEmbeddedDocument] Looking for ${languageId} document containing "${expectedText}"`)

    await assertWillComeTrue(async () => {
      embeddedDocument = vscode.workspace.textDocuments.find((document) => {
        return document.uri.fsPath.includes('embedded-documents') &&
          document.languageId === languageId &&
          document.getText().includes(expectedText)
      })
      if (embeddedDocument) {
        console.log(`[warmEmbeddedDocument] Found embedded document: ${embeddedDocument.uri.fsPath}`)
      }
      return embeddedDocument !== undefined
    }, 500, 10000)

    if (embeddedDocument === undefined) {
      throw new Error(`Unable to find embedded ${languageId} document containing "${expectedText}"`)
    }

    console.log(`[warmEmbeddedDocument] Showing embedded document for Pylance analysis...`)
    await vscode.window.showTextDocument(embeddedDocument, { preview: false })
    await awaitBitbakeIdle()

    // Wait for Pylance to analyze - significantly longer in headless mode
    console.log(`[warmEmbeddedDocument] Waiting 5000ms for Pylance to analyze document in headless mode...`)
    await delay(5000)
    await awaitBitbakeIdle()

    console.log(`[warmEmbeddedDocument] Document shown and analyzed, returning`)
  }

  const testPythonAddImport = async (
    targetRange: vscode.Range,
    expectedNewText: string,
    expectedRange: vscode.Range,
    description: string = ''
  ): Promise<void> => {
    let actionResult: vscode.CodeAction[] = []
    let attempts = 0

    try {
      console.log(`[CodeAction ${description}] Starting test for range ${targetRange.start.line}:${targetRange.start.character}`)

      // Warm the embedded document and then show the main document to trigger analysis
      await warmEmbeddedDocument('python', 'random')
      await prepareCodeActionDocument()
      await awaitBitbakeIdle()

      // Debug: Check what embedded documents exist
      const allDocs = vscode.workspace.textDocuments
      const embeddedPythonDocs = allDocs.filter(d => d.languageId === 'python' && d.uri.fsPath.includes('embedded-documents'))
      console.log(`[CodeAction DEBUG] Total documents: ${allDocs.length}`)
      console.log(`[CodeAction DEBUG] Embedded Python documents: ${embeddedPythonDocs.length}`)
      embeddedPythonDocs.forEach(doc => {
        const content = doc.getText()
        console.log(`  - ${doc.uri.fsPath.split('/').pop()}: ${content.length} chars, content: "${content.substring(0, 50)}"`)
      })

      // Debug: Check Pylance extension
      const pylanceExt = vscode.extensions.getExtension('ms-python.vscode-pylance')
      console.log(`[CodeAction DEBUG] Pylance extension active: ${pylanceExt?.isActive}`)

      await assertWillComeTrue(async () => {
        attempts++
        if (attempts <= 3 || attempts % 20 === 0) {
          console.log(`[CodeAction ${description}] Attempt ${attempts}: Requesting code actions for range ${targetRange.start.line}:${targetRange.start.character}`)
        }

        actionResult = await vscode.commands.executeCommand<vscode.CodeAction[]>(
          'vscode.executeCodeActionProvider',
          docUri,
          targetRange
        )

        if (attempts === 1 || attempts % 20 === 0) {
          console.log(`[CodeAction ${description}] Got ${actionResult?.length ?? 0} code actions`)
          actionResult?.forEach((action, i) => {
            console.log(`  [${i}] ${action.title} (kind: ${action.kind})`)
          })

          // If no actions, also check what's available from quickfix
          if ((actionResult?.length ?? 0) === 0) {
            console.log(`[CodeAction DEBUG] No code actions found. Checking diagnostics that should trigger them...`)
            const diagnostics = vscode.languages.getDiagnostics()
            diagnostics.forEach(([uri, diags]) => {
              if (diags.length > 0) {
                console.log(`  📋 ${uri.fsPath.split('/').pop()}: ${diags.length} diagnostics`)
              }
            })
          }
        }
        return (actionResult?.length ?? 0) > 0 && actionResult.find(action => action.title === expectedTitle) !== undefined
      }, 500, 100000) // 500ms interval, 100s timeout

      const expectedAction = actionResult.find(action => action.title === expectedTitle)
      if (expectedAction === undefined) {
        console.error(`[CodeAction ${description}] Expected action "${expectedTitle}" not found in ${actionResult?.map(a => a.title).join(', ')}`)
        assert.fail(`expectedAction "${expectedTitle}" is undefined`)
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
    } catch (err) {
      console.error(`[CodeAction ${description}] Test failed after ${attempts} attempts: ${err}`)
      throw err
    }
  }

  test('CodeAction can properly show "import random"', async () => {
    const targetRange = new vscode.Range(1, 4, 1, 10)
    const expectedNewText = '    import random\n'
    const expectedRange = new vscode.Range(1, 0, 1, 0)
    await testPythonAddImport(targetRange, expectedTitle, expectedNewText, expectedRange, 'import-random')
  }).timeout(BITBAKE_TIMEOUT)

  test('CodeAction can properly show "from random import random"', async () => {
    const targetRange = new vscode.Range(1, 4, 1, 10)
    const expectedNewText = '    from random import random\n'
    const expectedRange = new vscode.Range(1, 0, 1, 0)
    await testPythonAddImport(targetRange, expectedTitle, expectedNewText, expectedRange, 'from-random-import')
  }).timeout(BITBAKE_TIMEOUT)
})
