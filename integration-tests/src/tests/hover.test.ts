/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as assert from 'assert'
import * as vscode from 'vscode'
import path from 'path'
import { assertWillComeTrue, delay } from '../utils/async'
import { forceDocumentAnalysis, ensureLanguageServersReady } from '../utils/vscode-tools'
import { awaitBitbakeIdle, BITBAKE_TIMEOUT } from '../utils/bitbake'

type EmbeddedDocumentHint = {
  languageId: string
  expectedText: string
}

suite('Bitbake Hover Test Suite', () => {
  const filePath = path.resolve(__dirname, '../../project-folder/sources/meta-fixtures/hover.bb')
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

  const prepareHoverDocument = async (): Promise<vscode.TextDocument> => {
    const document = await vscode.workspace.openTextDocument(docUri)
    await vscode.window.showTextDocument(document, { preview: false })
    await awaitBitbakeIdle()
    return await vscode.workspace.openTextDocument(docUri)
  }

  const warmEmbeddedDocument = async (hint: EmbeddedDocumentHint): Promise<void> => {
    let embeddedDocument: vscode.TextDocument | undefined

    await assertWillComeTrue(async () => {
      embeddedDocument = vscode.workspace.textDocuments.find((document) => {
        return document.uri.fsPath.includes('embedded-documents') &&
          document.languageId === hint.languageId &&
          document.getText().includes(hint.expectedText)
      })
      return embeddedDocument !== undefined
    }, 500, 10000)

    if (embeddedDocument === undefined) {
      assert.fail(`Unable to find embedded ${hint.languageId} document containing "${hint.expectedText}"`)
    }

    console.log(`[Hover warmup] Showing embedded ${hint.languageId} document ${embeddedDocument.uri.fsPath}`)
    await vscode.window.showTextDocument(embeddedDocument, { preview: false })
    await delay(1000)
  }

  const testHover = async (position: vscode.Position, expected: string, description: string = '', embeddedDocumentHint?: EmbeddedDocumentHint): Promise<void> => {
    let hoverResult: vscode.Hover[] = []
    let attempts = 0

    try {
      if (embeddedDocumentHint !== undefined) {
        await warmEmbeddedDocument(embeddedDocumentHint)
      }
      const document = await prepareHoverDocument()

      await assertWillComeTrue(async () => {
        attempts++
        if (attempts % 20 === 0) {
          console.log(`[Hover ${description}] Attempt ${attempts}: Waiting for hover results at ${position.line}:${position.character}`)
        }
        hoverResult = await vscode.commands.executeCommand<vscode.Hover[]>(
          'vscode.executeHoverProvider',
          document.uri,
          position
        )
        if (attempts === 1 || attempts % 50 === 0) {
          console.log(`[Hover ${description}] Got ${hoverResult?.length ?? 0} hover results`)
        }
        return (hoverResult?.length ?? 0) > 0
      }, 500, 100000) // 500ms interval, 100s timeout for polling

      if (!hoverResult || hoverResult.length === 0) {
        assert.fail(`No hover results received for ${description} after ${attempts} attempts`)
      }

      assert.strictEqual(hoverResult.length, 1)
      const content = hoverResult[0]?.contents[0]
      if (!(content instanceof vscode.MarkdownString)) {
        assert.fail('content is not a MarkdownString')
      }
      assert.strictEqual(content.value.includes(expected), true)
    } catch (err) {
      console.error(`[Hover ${description}] Test failed: ${err}`)
      throw err
    }
  }

  test('Hover appears properly on bitbake variable', async () => {
    const position = new vscode.Position(0, 2)
    const expected = 'The package description used by package managers'
    await testHover(position, expected, 'bitbake-variable')
  }).timeout(BITBAKE_TIMEOUT)

  test('Hover appears properly on embedded python', async () => {
    const position = new vscode.Position(3, 6)
    const expected = 'def print'
    await testHover(position, expected, 'embedded-python', { languageId: 'python', expectedText: 'print' })
  }).timeout(BITBAKE_TIMEOUT)

  test('Hover appears properly on embedded bash', async () => {
    const position = new vscode.Position(9, 6)
    const expected = 'echo'
    await testHover(position, expected, 'embedded-bash', { languageId: 'shellscript', expectedText: 'echo' })
  }).timeout(BITBAKE_TIMEOUT)

  test('Hover shows Yocto task description on python function declaration', async () => {
    const position = new vscode.Position(12, 9)
    const expected = 'The default task for all recipes. This task depends on all other normal'
    await testHover(position, expected, 'python-task-declaration', { languageId: 'python', expectedText: 'do_build' })
  }).timeout(BITBAKE_TIMEOUT)

  test('Hover shows Yocto task description on bash function declaration', async () => {
    const position = new vscode.Position(15, 1)
    const expected = 'The default task for all recipes. This task depends on all other normal'
    await testHover(position, expected, 'bash-task-declaration', { languageId: 'shellscript', expectedText: 'do_build' })
  }).timeout(BITBAKE_TIMEOUT)

  test('Hover shows description for function defined into poky/meta/classes-global/logging.bbclass', async () => {
    const position = new vscode.Position(16, 6)
    const expected = 'Function: **bbwarn** - *defined in ../poky/meta/classes-global/logging.bbclass*'
    await testHover(position, expected, 'logging-bbclass', { languageId: 'shellscript', expectedText: 'bbwarn' })
  }).timeout(BITBAKE_TIMEOUT)

  test('Hover shows description for function defined into poky/meta/classes-global/base.bbclass', async () => {
    const position = new vscode.Position(17, 6)
    const expected = 'Function: **oe_runmake** - *defined in ../poky/meta/classes-global/base.bbclass*'
    await testHover(position, expected, 'base-bbclass', { languageId: 'shellscript', expectedText: 'oe_runmake' })
  }).timeout(BITBAKE_TIMEOUT)

  test('Hover gives right line number in bash function declared in the same file', async () => {
    const position = new vscode.Position(18, 7)
    const expected = 'Function: **do_bar** - *defined on line 7*'
    await testHover(position, expected, 'local-bash-function', { languageId: 'shellscript', expectedText: 'do_bar' })
  }).timeout(BITBAKE_TIMEOUT)
})
