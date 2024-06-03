/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as assert from 'assert'
import * as vscode from 'vscode'
import path from 'path'
import { assertWillComeTrue } from '../utils/async'
import { BITBAKE_TIMEOUT } from '../utils/bitbake'

suite('Bitbake Rename Test Suite', () => {
  const filePath = path.resolve(__dirname, '../../project-folder/sources/meta-fixtures/rename.bb')
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

  const testRename = async (
    position: vscode.Position,
    newName: string,
    expected: ReturnType<vscode.WorkspaceEdit['entries']>
  ): Promise<void> => {
    await assertWillComeTrue(async () => {
      const result = await vscode.commands.executeCommand<vscode.WorkspaceEdit>(
        'vscode.executeDocumentRenameProvider',
        docUri,
        position,
        newName
      )
      if (result.entries().length !== expected.length) {
        return false
      }

      return result.entries().every(([uri, edits], index) => {
        const [expectedUri, expectedTextEdits] = expected[index]
        if (uri.toString() !== expectedUri.toString()) {
          return false
        }
        if (edits.length !== expectedTextEdits.length) {
          return false
        }
        return edits.every((edit) => {
          return expectedTextEdits.some((expectedEdit) =>
            edit.newText === expectedEdit.newText && edit.range.isEqual(expectedEdit.range)
          )
        })
      })
    })
  }

  const testPrepareRename = async (
    position: vscode.Position,
    expected: { range: vscode.Range, placeholder: string }
  ): Promise<void> => {
    let result: { range: vscode.Range, placeholder: string } | undefined

    await assertWillComeTrue(async () => {
      result = await vscode.commands.executeCommand<{ range: vscode.Range, placeholder: string } | undefined>(
        'vscode.prepareRename',
        docUri,
        position
      )
      return result !== undefined
    })

    assert.strictEqual(result?.range.isEqual(expected.range), true)
    assert.strictEqual(result?.placeholder === expected.placeholder, true)
  }

  const testInvalidRename = async (
    position: vscode.Position
  ): Promise<void> => {
    try {
      await vscode.commands.executeCommand<{ range: vscode.Range, placeholder: string } | undefined>(
        'vscode.prepareRename',
        docUri,
        position
      )
    } catch (error) {
      if (error instanceof Error) {
        assert.strictEqual(error.message === "The element can't be renamed.", true)
        return
      }
    }
    assert.fail()
  }

  test('Rename properly on global variable', async () => {
    const position = new vscode.Position(0, 2)
    const expectedPrepareRename = {
      range: new vscode.Range(0, 0, 0, 3),
      placeholder: 'foo'
    }
    await testPrepareRename(position, expectedPrepareRename)
    const newName = 'bar'
    const expectedRename: ReturnType<vscode.WorkspaceEdit['entries']> = [
      [
        docUri,
        [
          new vscode.TextEdit(
            new vscode.Range(0, 0, 0, 3),
            newName
          ),
          new vscode.TextEdit(
            new vscode.Range(5, 14, 5, 17),
            newName
          ),
          new vscode.TextEdit(
            new vscode.Range(9, 12, 9, 15),
            newName
          )
        ]
      ]
    ]
    await testRename(position, newName, expectedRename)
  }).timeout(BITBAKE_TIMEOUT)

  test('Rename properly on local Python variable', async () => {
    const position = new vscode.Position(4, 12)
    const expectedPrepareRename = {
      range: new vscode.Range(4, 10, 4, 13),
      placeholder: 'foo'
    }
    await testPrepareRename(position, expectedPrepareRename)
    const newName = 'bar'
    const expectedRename: ReturnType<vscode.WorkspaceEdit['entries']> = [
      [
        docUri,
        [
          new vscode.TextEdit(
            new vscode.Range(3, 4, 3, 7),
            newName
          ),
          new vscode.TextEdit(
            new vscode.Range(4, 10, 4, 13),
            newName
          )
        ]
      ]
    ]
    await testRename(position, newName, expectedRename)
  }).timeout(BITBAKE_TIMEOUT)

  test('Rename properly on local Bash variable', async () => {
    const position = new vscode.Position(10, 12)
    const expectedPrepareRename = {
      range: new vscode.Range(10, 10, 10, 13),
      placeholder: 'foo'
    }
    await testPrepareRename(position, expectedPrepareRename)
    const newName = 'bar'
    const expectedRename: ReturnType<vscode.WorkspaceEdit['entries']> = [
      [
        docUri,
        [
          new vscode.TextEdit(
            new vscode.Range(10, 10, 10, 13),
            newName
          ),
          new vscode.TextEdit(
            new vscode.Range(11, 11, 11, 14),
            newName
          )
        ]
      ]
    ]
    await testRename(position, newName, expectedRename)
  }).timeout(BITBAKE_TIMEOUT)

  test('Rename shows proper message where renaming is not possible', async () => {
    const position = new vscode.Position(0, 7)
    await testInvalidRename(position)
  }).timeout(BITBAKE_TIMEOUT)
})
