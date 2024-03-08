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
    // A range we hope won't break on every poky update and from which we still can assume the command worked properly
    estimatedNumberOfReferences: { min: number, max: number },
    nbReferencesOnOriginalDocument: vscode.Range[]
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
    assert.equal(
      referencesResult.length >= estimatedNumberOfReferences.min && referencesResult.length <= estimatedNumberOfReferences.max,
      true
    )
    let nbReferencesFoundOnOriginalDocument = 0
    referencesResult.forEach((reference, index) => {
      assert.equal(reference.uri.fsPath.includes('workspaceStorage'), false)
      if (reference.uri.fsPath === docUri.fsPath) {
        assert.equal(
          nbReferencesOnOriginalDocument.some((range) => range.isEqual(reference.range)),
          true
        )
        nbReferencesFoundOnOriginalDocument++
      }
    })
    assert.equal(nbReferencesFoundOnOriginalDocument, nbReferencesOnOriginalDocument.length)
  }

  test('References appear properly in Python on oe', async () => {
    const position = new vscode.Position(1, 5)
    // Got 406 on manual testing and around 600 on integration tests' environment
    const estimatedNumberOfReferences = { min: 300, max: 1000 }
    const nbReferencesOnOriginalDocument = [
      new vscode.Range(1, 4, 1, 6)
    ]
    await testReferences(position, estimatedNumberOfReferences, nbReferencesOnOriginalDocument)
  }).timeout(300000)

  test('References appear properly in Bash on variable', async () => {
    const position = new vscode.Position(6, 13)
    const estimatedNumberOfReferences = { min: 2, max: 2 }
    const nbReferencesOnOriginalDocument = [
      new vscode.Range(5, 4, 5, 7),
      new vscode.Range(6, 12, 6, 15)
    ]
    await testReferences(position, estimatedNumberOfReferences, nbReferencesOnOriginalDocument)
  }).timeout(300000)
})
