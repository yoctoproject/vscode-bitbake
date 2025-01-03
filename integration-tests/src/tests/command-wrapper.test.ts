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
    await bitbakeConfiguration.update('pathToEnvScript', '/workdir/integration-tests/project-folder/sources/poky/oe-init-build-env')
    await bitbakeConfiguration.update('pathToBuildFolder', '/workdir/integration-tests/project-folder/build-crops')
    await bitbakeConfiguration.update('commandWrapper', 'docker run --rm -v ${workspaceFolder}/../..:/workdir/ crops/poky --workdir=/workdir /bin/bash -c')
    // We can't update the settings atomically. Each update may trigger a scan/parsing. We wait for a successful scan after all the settings are updated.
    await awaitBitbakeParsingResult()
  })

  suiteTeardown(async function (this: Mocha.Context) {
    this.timeout(BITBAKE_TIMEOUT)
    const bitbakeConfiguration = vscode.workspace.getConfiguration('bitbake')
    await bitbakeConfiguration.update('commandWrapper', undefined)
    await bitbakeConfiguration.update('pathToBuildFolder', savedSettings.pathToBuildFolder)
    await bitbakeConfiguration.update('pathToEnvScript', savedSettings.pathToEnvScript)
    await awaitBitbakeParsingResult()
    await vscode.workspace.fs.delete(buildFolder, { recursive: true })
  })

  test('Bitbake can run a task inside a crops container', async () => {
    await vscode.commands.executeCommand('bitbake.run-task', 'base-files', 'unpack')
    await assertWillComeTrue(async () => {
      const files = await vscode.workspace.findFiles('build-crops/tmp/work/*/base-files/*/sources/issue')
      return files.length === 1
    })
  }).timeout(BITBAKE_TIMEOUT)
})
