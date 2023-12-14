/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as assert from 'assert'
import * as vscode from 'vscode'
import path from 'path'
import { assertWillComeTrue } from '../utils/async'

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
    await vscode.workspace.openTextDocument(docUri)
  })

  const testHover = async (position: vscode.Position, expected: string): Promise<void> => {
    let hoverResult: vscode.Hover[] = []

    await assertWillComeTrue(async () => {
      hoverResult = await vscode.commands.executeCommand<vscode.Hover[]>(
        'vscode.executeHoverProvider',
        docUri,
        position
      )
      return hoverResult.length > 0
    })

    assert.strictEqual(hoverResult.length, 1)
    const content = hoverResult[0]?.contents[0]
    if (!(content instanceof vscode.MarkdownString)) {
      assert.fail('content is not a MarkdownString')
    }
    assert.strictEqual(content.value.includes(expected), true)
  }

  test('Hover appears properly on bitbake variable', async () => {
    const position = new vscode.Position(0, 2)
    const expected = 'The package description used by package managers'
    await testHover(position, expected)
  }).timeout(300000)

  test('Hover appears properly on embedded python', async () => {
    const position = new vscode.Position(3, 6)
    const expected = 'def print'
    await testHover(position, expected)
  }).timeout(300000)

  test('Hover appears properly on embedded bash', async () => {
    const position = new vscode.Position(7, 6)
    const expected = 'echo'
    await testHover(position, expected)
  }).timeout(300000)

  test('Hover shows Yocto task description on python function declaration', async () => {
    const position = new vscode.Position(10, 9)
    const expected = 'The default task for all recipes. This task depends on all other normal'
    await testHover(position, expected)
  }).timeout(300000)

  test('Hover shows Yocto task description on bash function declaration', async () => {
    const position = new vscode.Position(13, 1)
    const expected = 'The default task for all recipes. This task depends on all other normal'
    await testHover(position, expected)
  }).timeout(300000)
})
