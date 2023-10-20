/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as assert from 'assert'
import { after } from 'mocha'
import * as vscode from 'vscode'

async function delay (ms: number): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, ms))
}

suite('VSCode integration Test Suite', () => {
  suiteSetup(async function (this: Mocha.Context) {
    this.timeout(10000)
    while (vscode.workspace.workspaceFolders === undefined || vscode.workspace.workspaceFolders.length === 0) {
      await delay(100)
    }
  })

  after(() => {
    void vscode.window.showInformationMessage('All tests done!')
  })

  test('Sample test', () => {
    assert.strictEqual(-1, [1, 2, 3].indexOf(5))
    assert.strictEqual(-1, [1, 2, 3].indexOf(0))
  })

  test('Correct VSCode settings are used', () => {
    const logLevel = vscode.workspace.getConfiguration('bitbake').get('loggingLevel')
    assert.strictEqual(logLevel, 'debug')
  })
})
