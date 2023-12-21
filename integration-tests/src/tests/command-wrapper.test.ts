/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as assert from 'assert'
import * as vscode from 'vscode'

import { assertWillComeTrue, assertWorkspaceWillBeOpen } from '../utils/async'
import path from 'path'

suite('Bitbake Command Wrapper', () => {
  let workspaceURI: vscode.Uri
  let buildFolder: vscode.Uri
  let savedSettings: {
    pathToBuildFolder: string | undefined
    pathToEnvScript: string | undefined
  }

  suiteSetup(async function (this: Mocha.Context) {
    /* eslint-disable no-template-curly-in-string */
    this.timeout(100000)
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
    await bitbakeConfiguration.update('commandWrapper', 'docker run --rm -v ${workspaceFolder}/../..:/workdir/ crops/poky --workdir=/workdir /bin/bash -c')
    await bitbakeConfiguration.update('pathToBuildFolder', '/workdir/integration-tests/project-folder/build-crops')
    await bitbakeConfiguration.update('pathToEnvScript', '/workdir/integration-tests/project-folder/sources/poky/oe-init-build-env')
  })

  suiteTeardown(async function (this: Mocha.Context) {
    this.timeout(300000)
    await vscode.workspace.fs.delete(buildFolder, { recursive: true })

    const bitbakeConfiguration = vscode.workspace.getConfiguration('bitbake')
    await bitbakeConfiguration.update('commandWrapper', undefined)
    await bitbakeConfiguration.update('pathToBuildFolder', savedSettings.pathToBuildFolder)
    await bitbakeConfiguration.update('pathToEnvScript', savedSettings.pathToEnvScript)
  })

  test('Bitbake can properly scan includes inside a crops container', async () => {
    const filePath = path.resolve(__dirname, '../../project-folder/sources/meta-fixtures/command-wrapper.bb')
    const docUri = vscode.Uri.parse(`file://${filePath}`)
    let definitions: vscode.Location[] = []

    await vscode.workspace.openTextDocument(docUri)

    await assertWillComeTrue(async () => {
      definitions = await vscode.commands.executeCommand(
        'vscode.executeDefinitionProvider',
        docUri,
        new vscode.Position(0, 10)
      )
      return definitions.length === 1
    })
  }).timeout(300000)
})
