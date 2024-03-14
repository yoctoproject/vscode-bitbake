/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as assert from 'assert'
import * as vscode from 'vscode'
import path from 'path'
import { assertWillComeTrue } from '../utils/async'

suite('Bitbake References Test Suite', () => {
  const filePath = path.resolve(__dirname, '../../project-folder/sources/meta-fixtures/references.bb')
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

  const testReferences = async (
    position: vscode.Position,
    referenceRanges: vscode.Range[]
  ): Promise<void> => {
    let referencesResult: vscode.Location[] = []

    await assertWillComeTrue(async () => {
      referencesResult = await vscode.commands.executeCommand<vscode.Location[]>(
        'vscode.executeReferenceProvider',
        docUri,
        position
      )
      return referencesResult.length > 0
    }, 5000)
    assert.equal(referencesResult.length === referenceRanges.length, true)
    referencesResult.forEach((reference, index) => {
      assert.equal(reference.uri.fsPath.includes('workspaceStorage'), false)
      assert.equal(reference.uri.fsPath === docUri.fsPath, true)
      assert.equal(referenceRanges.some((range) => range.isEqual(reference.range)), true)
    })
  }

  test('References appear properly in Python on variable', async () => {
    const position = new vscode.Position(1, 5)
    const referenceRanges = [
      new vscode.Range(1, 4, 1, 7),
      new vscode.Range(2, 10, 2, 13)
    ]
    await testReferences(position, referenceRanges)
  }).timeout(300000)

  test('References appear properly in Bash on variable', async () => {
    const position = new vscode.Position(9, 13)
    const referenceRanges = [
      new vscode.Range(5, 0, 5, 3),
      new vscode.Range(8, 4, 8, 7),
      new vscode.Range(9, 12, 9, 15)
    ]
    await testReferences(position, referenceRanges)
  }).timeout(300000)
})
