/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as assert from 'assert'
import * as vscode from 'vscode'

import { assertWillComeTrue, assertWorkspaceWillBeOpen } from '../utils/async'
import { BITBAKE_TIMEOUT, awaitBitbakeParsingResult } from '../utils/bitbake'

suite('Bitbake Command Wrapper', () => {
  let workspaceURI: vscode.Uri
  let buildFolder: vscode.Uri
  let savedSettings: {
    pathToBuildFolder: string | undefined
    pathToEnvScript: string | undefined
  }

  suiteSetup(async function (this: Mocha.Context) {
    this.timeout(1.5 * BITBAKE_TIMEOUT) // Some additional time for pulling the Docker image
    await assertWorkspaceWillBeOpen()
    workspaceURI = (vscode.workspace.workspaceFolders as vscode.WorkspaceFolder[])[0].uri
    buildFolder = vscode.Uri.joinPath(workspaceURI, 'build-crops')

    const vscodeBitbake = vscode.extensions.getExtension('yocto-project.yocto-bitbake')
    if (vscodeBitbake === undefined) {
      assert.fail('Bitbake extension is not available')
    }
    await vscodeBitbake.activate()

    const bitbakeConfiguration = vscode.workspace.getConfiguration('bitbake')
    savedSettings = {
      pathToBuildFolder: bitbakeConfiguration.get('pathToBuildFolder'),
      pathToEnvScript: bitbakeConfiguration.get('pathToEnvScript')
    }

    // We use purposely complex mount points to test the scanner path resolution logic
    await bitbakeConfiguration.update('pathToEnvScript', '/workdir/integration-tests/project-folder/build-crops/init-build-env')
    await bitbakeConfiguration.update('pathToBuildFolder', '/workdir/integration-tests/project-folder/build-crops')
    await bitbakeConfiguration.update('commandWrapper', 'docker run --rm -v ${workspaceFolder}/../..:/workdir/ crops/poky --workdir=/workdir /bin/bash -c')
    // We can't update the settings atomically. Each update may trigger a scan/parsing. We wait for a successful scan after all the settings are updated.
    await awaitBitbakeParsingResult()
  })

  suiteTeardown(async function (this: Mocha.Context) {
    this.timeout(BITBAKE_TIMEOUT)
    const bitbakeConfiguration = vscode.workspace.getConfiguration('bitbake')
    await bitbakeConfiguration.update('commandWrapper', "")
    await bitbakeConfiguration.update('pathToBuildFolder', savedSettings.pathToBuildFolder)
    await bitbakeConfiguration.update('pathToEnvScript', savedSettings.pathToEnvScript)
    await awaitBitbakeParsingResult()
    await vscode.workspace.fs.delete(buildFolder, { recursive: true })
  })

  test('Bitbake can run a task inside a crops container', async () => {
    await vscode.commands.executeCommand('bitbake.run-task', 'base-files', 'unpack')
    await assertWillComeTrue(async () => {
      const files = await vscode.workspace.findFiles('build-crops/tmp/work/*/base-files/*/sources/issue', null)
      return files.length === 1
    })
  }).timeout(BITBAKE_TIMEOUT)

  test('Bitbake command wrapper exposes scanned recipe final values in hover', async () => {
    const recipeUris = await vscode.workspace.findFiles(
      'layers/openembedded-core/meta/recipes-core/base-files/base-files_*.bb'
    )
    assert.strictEqual(recipeUris.length, 1)

    const recipeUri = recipeUris[0]
    const document = await vscode.workspace.openTextDocument(recipeUri)
    const recipeText = document.getText()
    const summaryMatch = /^SUMMARY\s*=\s*"([^"]+)"/m.exec(recipeText)
    assert.notStrictEqual(summaryMatch, null)

    const expectedSummary = summaryMatch?.[1] as string
    const summaryOffset = recipeText.indexOf('SUMMARY')
    assert.notStrictEqual(summaryOffset, -1)

    const position = document.positionAt(summaryOffset + 2)
    let hoverContent = ''

    await vscode.commands.executeCommand('bitbake.scan-recipe-env', 'base-files')

    await assertWillComeTrue(async () => {
      const hoverResult = await vscode.commands.executeCommand<vscode.Hover[]>(
        'vscode.executeHoverProvider',
        recipeUri,
        position
      )
      const content = hoverResult[0]?.contents[0]
      hoverContent = content instanceof vscode.MarkdownString ? content.value : ''
      return hoverContent.includes('**Final Value**') &&
        hoverContent.includes(expectedSummary)
    })

    assert.strictEqual(hoverContent.includes('**Final Value**'), true)
    assert.strictEqual(hoverContent.includes(expectedSummary), true)
  }).timeout(BITBAKE_TIMEOUT)
})
