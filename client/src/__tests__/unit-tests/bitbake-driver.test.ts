/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as fs from 'fs'
import * as vscode from 'vscode'
import { BitbakeDriver } from '../../driver/BitbakeDriver'

jest.mock('vscode')

const mockBitbakeConfiguration = (values: Record<string, string>): void => {
  vscode.workspace.getConfiguration = jest.fn().mockImplementation(() => ({
    get: (key: string): string | undefined => {
      if (key === undefined || values[key] === undefined) {
        return ''
      }
      return values[key]
    }
  }))
}

describe('BitbakeDriver Tests', () => {
  it('should protect from shell injections', (done) => {
    const driver = new BitbakeDriver()
    const process = driver.spawnBitbakeProcess(': ; printenv')
    process.stdout?.on('data', (data) => {
      if (data.toString().includes('USER=') === true) {
        done('Command injection detected')
      }
    })
    process.on('exit', (code) => {
      expect(code).not.toBe(0)
      done()
    })
  })

  it('should source the environment script', (done) => {
    const fakeEnvScriptPath = '/tmp/bitbake-vscode-test/envsetup.sh'
    const fakeBuildPath = '/tmp/bitbake-vscode-test'

    mockBitbakeConfiguration({
      pathToEnvScript: fakeEnvScriptPath,
      pathToBuildFolder: fakeBuildPath
    })
    const driver = new BitbakeDriver()
    driver.loadSettings()

    fs.mkdirSync(fakeBuildPath, { recursive: true })
    const content = 'cd ' + fakeBuildPath + '; echo FINDME'
    fs.writeFileSync(fakeEnvScriptPath, content)

    const process = driver.spawnBitbakeProcess(':')
    process.stdout?.on('data', (data) => {
      if (data.includes('FINDME') === true) {
        done()
      }
    })
  })
})
