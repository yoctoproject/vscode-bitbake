/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as fs from 'fs'
import { BitbakeDriver } from '../../BitbakeDriver'

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

    const driver = new BitbakeDriver()
    driver.loadSettings({
      pathToEnvScript: fakeEnvScriptPath,
      pathToBuildFolder: fakeBuildPath,
      pathToBitbakeFolder: '',
      workingDirectory: ''
    })

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
