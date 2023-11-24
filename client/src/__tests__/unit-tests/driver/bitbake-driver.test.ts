/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as fs from 'fs'
import { BitbakeDriver } from '../../../driver/BitbakeDriver'

describe('BitbakeDriver Tests', () => {
  it('should protect from shell injections', (done) => {
    const driver = new BitbakeDriver()
    void driver.spawnBitbakeProcess(': ; printenv').then((process) => {
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
  })

  it('should source the environment script', (done) => {
    const fakeEnvScriptPath = '/tmp/bitbake-vscode-test/envsetup.sh'
    const fakeBuildPath = '/tmp/bitbake-vscode-test'

    const driver = new BitbakeDriver()
    driver.loadSettings({
      pathToEnvScript: fakeEnvScriptPath,
      pathToBuildFolder: fakeBuildPath,
      pathToBitbakeFolder: '',
      workingDirectory: '',
      commandWrapper: ''
    })

    fs.mkdirSync(fakeBuildPath, { recursive: true })
    const content = 'cd ' + fakeBuildPath + '; echo FINDME'
    fs.writeFileSync(fakeEnvScriptPath, content)

    void driver.spawnBitbakeProcess(':').then((process) => {
      process.stdout?.on('data', (data) => {
        if (data.includes('FINDME') === true) {
          done()
        }
      })
    })
  })

  it('should produce a valid kas script', () => {
    const driver = new BitbakeDriver()
    driver.loadSettings({
      commandWrapper: 'kas shell -c',
      pathToBitbakeFolder: '',
      pathToEnvScript: '',
      pathToBuildFolder: '',
      workingDirectory: ''
    })

    const script = driver.composeBitbakeScript('bitbake busybox')
    expect(script).toEqual(expect.stringContaining("kas shell -c 'bitbake busybox'"))
  })

  it('should produce a valid crops docker run script', () => {
    /* eslint-disable no-template-curly-in-string */
    const driver = new BitbakeDriver()
    driver.loadSettings({
      commandWrapper: 'docker run --rm -it -v ${workspaceFolder}:/workdir crops/poky --workdir=/workdir /bin/bash -c',
      pathToEnvScript: '${workspaceFolder}/poky/oe-init-build-env',
      pathToBitbakeFolder: '',
      pathToBuildFolder: '',
      workingDirectory: ''
    }, '/home/user/yocto')

    const script = driver.composeBitbakeScript('bitbake busybox')
    expect(script).toEqual(expect.stringContaining("docker run --rm -it -v /home/user/yocto:/workdir crops/poky --workdir=/workdir /bin/bash -c '. /home/user/yocto/poky/oe-init-build-env && bitbake busybox'"))
  })
})
