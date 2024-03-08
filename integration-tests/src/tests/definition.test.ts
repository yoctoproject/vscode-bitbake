/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as assert from 'assert'
import * as vscode from 'vscode'
import path from 'path'
import { assertWillComeTrue } from '../utils/async'
import { checkIsRangeEqual, getDefinitionUri } from '../utils/vscode-tools'

suite('Bitbake Definition Test Suite', () => {
  const filePath = path.resolve(__dirname, '../../project-folder/sources/meta-fixtures/definition.bb')
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

  const testDefinition = async (
    position: vscode.Position,
    expectedPathEnding: string,
    expectedRange?: vscode.Range
  ): Promise<void> => {
    let definitionResult: vscode.Location[] | vscode.LocationLink[] = []

    await assertWillComeTrue(async () => {
      definitionResult = await vscode.commands.executeCommand<vscode.Location[] | vscode.LocationLink[]>(
        'vscode.executeDefinitionProvider',
        docUri,
        position
      )
      return definitionResult.length > 0
    }, 5000)
    definitionResult.forEach((definition) => {
      const receivedUri = getDefinitionUri(definition)
      assert.equal(receivedUri.fsPath.endsWith(expectedPathEnding), true)
      if (expectedRange !== undefined) {
        if (definition instanceof vscode.Location) {
          assert.equal(checkIsRangeEqual(definition?.range, expectedRange), true)
        } else {
          assert.equal(checkIsRangeEqual(definition.targetRange, expectedRange), true)
        }
      }
    })
  }

  test('Definition appears properly in Python on d', async () => {
    const position = new vscode.Position(3, 3)
    const expectedPathEnding = 'lib/bb/data_smart.py'
    await testDefinition(position, expectedPathEnding)
  }).timeout(300000)

  test('Definition appears properly in Python on the getVar part of d.getVar', async () => {
    const position = new vscode.Position(3, 7)
    const expectedPathEnding = 'lib/bb/data_smart.py'
    await testDefinition(position, expectedPathEnding)
  }).timeout(300000)

  test('Definition appears properly in Python on e', async () => {
    const position = new vscode.Position(6, 12)
    const expectedPathEnding = 'lib/bb/event.py'
    await testDefinition(position, expectedPathEnding)
  }).timeout(300000)

  test('Definition appears properly in Python on the getVar part of e.data.getVar', async () => {
    const position = new vscode.Position(6, 21)
    const expectedPathEnding = 'lib/bb/data_smart.py'
    await testDefinition(position, expectedPathEnding)
  }).timeout(300000)

  test('Definition appears properly in Python on oe', async () => {
    const position = new vscode.Position(11, 3)
    const expectedPathEnding = 'meta/lib/oe/__init__.py'
    await testDefinition(position, expectedPathEnding)
  }).timeout(300000)

  test('Definition appears properly on Bash variable', async () => {
    const position = new vscode.Position(15, 3)
    const expectedPathEnding = filePath
    const expectedRange = new vscode.Range(14, 2, 14, 8)
    await testDefinition(position, expectedPathEnding, expectedRange)
  }).timeout(300000)
})
