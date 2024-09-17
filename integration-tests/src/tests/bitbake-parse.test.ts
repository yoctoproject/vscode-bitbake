/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as vscode from 'vscode'

import path from 'path'
import { BITBAKE_TIMEOUT, awaitBitbakeParsingResult, importRecipe, removeRecipe } from '../utils/bitbake'
import { assertWillComeTrue, assertWorkspaceWillBeOpen } from '../utils/async'

suite('Bitbake Parsing Test Suite', () => {
  let workspaceURI: vscode.Uri
  let errorRecipePath: string
  let workspacePath: string
  let pokyPath: string

  suiteSetup(async function (this: Mocha.Context) {
    this.timeout(BITBAKE_TIMEOUT)
    await assertWorkspaceWillBeOpen()
    workspaceURI = (vscode.workspace.workspaceFolders as vscode.WorkspaceFolder[])[0].uri
    errorRecipePath = path.resolve(__dirname, '../../project-folder/sources/meta-error/recipes-error/error/unparsed-line.bb')
    workspacePath = workspaceURI.fsPath
    pokyPath = path.resolve(workspacePath, 'sources/poky')
  })

  suiteTeardown(async () => {
    try {
      await removeRecipe(errorRecipePath, pokyPath)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      // pass
    }
  })

  test('Bitbake can detect parsing errors', async () => {
    await importRecipe(errorRecipePath, pokyPath)

    await vscode.commands.executeCommand('bitbake.parse-recipes')
    await awaitBitbakeParsingResult()

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

      if (!diagnostics[0][0].path.includes('recipes-core/base-files/unparsed-line.bb')) {
        return false
      }
      if (!diagnostics[0][1][0].message.includes('unparsed line: \'undefinedvariable\'')) {
        return false
      }

      return true
    })

    await removeRecipe(errorRecipePath, pokyPath)
  }).timeout(BITBAKE_TIMEOUT)
})
