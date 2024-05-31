/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as assert from 'assert'
import * as vscode from 'vscode'

import path from 'path'
import { BITBAKE_TIMEOUT, addLayer, excludeRecipes, resetExcludedRecipes, awaitBitbakeParsingResult, resetLayer } from '../utils/bitbake'
import { assertWillComeTrue, assertWorkspaceWillBeOpen } from '../utils/async'

suite('Bitbake Parsing Test Suite', () => {
  let workspaceURI: vscode.Uri
  let buildFolder: vscode.Uri

  suiteSetup(async function (this: Mocha.Context) {
    this.timeout(BITBAKE_TIMEOUT)
    await assertWorkspaceWillBeOpen()
    workspaceURI = (vscode.workspace.workspaceFolders as vscode.WorkspaceFolder[])[0].uri
    buildFolder = vscode.Uri.joinPath(workspaceURI, 'build')

    // Generate the build directory for the addLayer functions to work
    await vscode.commands.executeCommand('bitbake.parse-recipes')
    await awaitBitbakeParsingResult()
  })

  suiteTeardown(async function (this: Mocha.Context) {
    this.timeout(10000)
    await vscode.workspace.fs.delete(buildFolder, { recursive: true })
  })

  test('Bitbake can succesfully parse poky', async () => {
    await vscode.commands.executeCommand('bitbake.parse-recipes')
    await awaitBitbakeParsingResult()

    const diagnostics = vscode.languages.getDiagnostics()
    assert.strictEqual(diagnostics.length, 0)
  }).timeout(BITBAKE_TIMEOUT)

  test('Bitbake can detect parsing errors', async () => {
    const recipesToExclude: string[] = [
      'recipes-error/error/compilation-python-function.bb',
      'recipes-error/error/execution-python-function.bb',
      'recipes-error/error/unable-to-parse.bb',
      'recipes-error/error/unparsed-line.bb',
      'recipes-error/error/task-error.bb',
      'recipes-error/error/variable-error.bb',
      'recipes-error/error/non-existent-uri.bb'
    ]

    const workspacePath: string = workspaceURI.fsPath
    await addLayer(path.resolve(__dirname, '../../project-folder/sources/meta-error'), workspacePath)

    // Everything is excluded except the one that is filtered out
    await excludeRecipes(recipesToExclude.filter((recipe) => recipe !== 'recipes-error/error/unparsed-line.bb'), workspacePath)

    await vscode.commands.executeCommand('bitbake.parse-recipes')
    await awaitBitbakeParsingResult()

    await resetLayer(path.resolve(__dirname, '../../project-folder/sources/meta-error'), workspacePath)

    await resetExcludedRecipes(workspacePath)

    await assertWillComeTrue(async () => {
      const diagnostics = vscode.languages.getDiagnostics()
      // Only 1 file has problem(s)
      if (diagnostics.length !== 1) {
        return false
      }
      // Only 1 problem on the file
      if (diagnostics[0][1].length !== 1) {
        return false
      }

      if (!diagnostics[0][0].path.includes('recipes-error/error/unparsed-line.bb')) {
        return false
      }
      if (!diagnostics[0][1][0].message.includes('unparsed line: \'undefinedvariable\'')) {
        return false
      }

      return true
    })
  }).timeout(BITBAKE_TIMEOUT)
})
