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
      return referencesResult.length === referenceRanges.length
    }, 5000)
    referencesResult.forEach((reference, index) => {
      assert.equal(reference.uri.fsPath.includes('workspaceStorage'), false)
      assert.equal(reference.uri.fsPath === docUri.fsPath, true)
      assert.equal(referenceRanges.some((range) => range.isEqual(reference.range)), true)
    })
  }

  test('References appear properly on local Python variable', async () => {
    const position = new vscode.Position(3, 6)
    const referenceRanges = [
      new vscode.Range(3, 4, 3, 7),
      new vscode.Range(5, 10, 5, 13)
    ]
    await testReferences(position, referenceRanges)
  }).timeout(300000)

  test('References appear properly on global variable', async () => {
    const position = new vscode.Position(9, 13)
    const referenceRanges = [
      new vscode.Range(0, 0, 0, 3),
      new vscode.Range(1, 7, 1, 10),
      // For unknown reason, Python datastore variables fail in integration tests
      new vscode.Range(4, 14, 4, 17),
      new vscode.Range(8, 18, 8, 21),
      new vscode.Range(9, 4, 9, 7),
      new vscode.Range(9, 10, 9, 13),
      new vscode.Range(9, 16, 9, 19)
    ]
    await testReferences(position, referenceRanges)
  }).timeout(300000)
})
