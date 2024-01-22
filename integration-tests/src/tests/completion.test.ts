/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as assert from 'assert'
import * as vscode from 'vscode'
import path from 'path'
import { assertWillComeTrue } from '../utils/async'
import { BITBAKE_TIMEOUT } from '../utils/bitbake'

suite('Bitbake Completion Test Suite', () => {
  const filePath = path.resolve(__dirname, '../../project-folder/sources/meta-fixtures/completion.bb')
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

  const checkHasItemWithLabel = (completionList: vscode.CompletionList, label: string): boolean => {
    return completionList.items.some(item => {
      if (typeof item.label === 'string') {
        return item.label === label
      }
      return item.label.label === label
    })
  }

  const testCompletion = async (position: vscode.Position, expected: string): Promise<void> => {
    let completionList: vscode.CompletionList = { items: [] }
    await assertWillComeTrue(async () => {
      completionList = await vscode.commands.executeCommand<vscode.CompletionList>(
        'vscode.executeCompletionItemProvider',
        docUri,
        position
      )
      return checkHasItemWithLabel(completionList, expected)
    })
  }

  test('Completion appears properly on bitbake variable', async () => {
    const position = new vscode.Position(8, 7)
    const expected = 'DESCRIPTION'
    await testCompletion(position, expected)
  }).timeout(BITBAKE_TIMEOUT)

  test('Completion appears properly on embedded python', async () => {
    const position = new vscode.Position(1, 7)
    const expected = 'print'
    await testCompletion(position, expected)
  }).timeout(BITBAKE_TIMEOUT)

  test('Completion appears properly on embedded bash', async () => {
    const position = new vscode.Position(5, 7)
    const expected = 'echo'
    await testCompletion(position, expected)
  }).timeout(BITBAKE_TIMEOUT)
})
