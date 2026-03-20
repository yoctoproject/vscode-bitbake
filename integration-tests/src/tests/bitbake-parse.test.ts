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

    const parsingResult = awaitBitbakeParsingResult()
    await vscode.commands.executeCommand('bitbake.parse-recipes')
    await parsingResult

    await assertWillComeTrue(async () => {
      const diagnostics = vscode.languages.getDiagnostics()
      return diagnostics.some(([uri, fileDiagnostics]) => {
        return uri.path.includes('recipes-core/base-files/unparsed-line.bb') &&
          fileDiagnostics.some((diagnostic) => diagnostic.message.includes("unparsed line: 'undefinedvariable'"))
      })
    })

    await removeRecipe(errorRecipePath, pokyPath)
  }).timeout(BITBAKE_TIMEOUT)
})
