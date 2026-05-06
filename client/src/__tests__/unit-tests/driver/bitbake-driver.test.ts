/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as fs from 'fs'
import { SpawnSyncReturns } from 'child_process'
import { IPty } from 'node-pty'
import { BitbakeDriver } from '../../../driver/BitbakeDriver'
import { type BitbakeTaskDefinition } from '../../../ui/BitbakeTaskProvider'
import { BITBAKE_TIMEOUT } from '../../../utils/ProcessUtils'
import * as BitbakeTerminal from '../../../ui/BitbakeTerminal'
import * as ProcessUtils from '../../../utils/ProcessUtils'

describe('BitbakeDriver Tests', () => {
  it('should protect from shell injections', (done) => {
    const driver = new BitbakeDriver()
    const command = driver.composeBitbakeCommand({ recipes: [': ; printenv'], type: 'bitbake' })
    void driver.spawnBitbakeProcess(command).then((process) => {
      process.onData((data) => {
        if (data.toString().includes('USER=')) {
          done('Command injection detected')
        }
      })
      process.onExit((code) => {
        expect(code).not.toBe(0)
        done()
      })
    })
  }, BITBAKE_TIMEOUT)

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
      process.onData((data) => {
        if (data.includes('FINDME')) {
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

  it('should handle an alternative build configuration', () => {
    const driver = new BitbakeDriver()
    driver.loadSettings({
      pathToEnvScript: '/tmp/envsetup.sh',
      pathToBitbakeFolder: '',
      buildConfigurations: [
        {
          name: 'Default',
          pathToBuildFolder: '/tmp/default-build'
        },
        {
          name: 'Alternative',
          pathToBuildFolder: '/tmp/alternative-build'
        }
      ]
    })

    const script2 = driver.composeBitbakeScript('bitbake busybox')
    expect(script2).toEqual(expect.stringContaining('. /tmp/envsetup.sh /tmp/default-build'))

    driver.activeBuildConfiguration = 'Alternative'
    const script = driver.composeBitbakeScript('bitbake busybox')
    expect(script).toEqual(expect.stringContaining('. /tmp/envsetup.sh /tmp/alternative-build'))
  })

  describe('settings sanity', () => {
    afterEach(() => {
      jest.clearAllMocks()
    })

    it('tracks sane BitBake settings', async () => {
      const bitbakeDriver = new BitbakeDriver()
      const bitbakeSettings: Record<string, unknown> = {
        pathToBitbakeFolder: __dirname,
        workingDirectory: __dirname,
        commandWrapper: '',
        pathToEnvScript: 'fakeEnvScript',
        pathToBuildFolder: 'nonexistent'
      }

      bitbakeDriver.loadSettings(bitbakeSettings, __dirname)
      jest.spyOn(BitbakeTerminal, 'runBitbakeTerminalCustomCommand').mockImplementation(async () => (undefined as unknown as Promise<IPty>))
      jest.spyOn(ProcessUtils, 'finishProcessExecution').mockReturnValueOnce(Promise.resolve({
        status: 0,
        stdout: '/tmp/devtool\r\n/tmp/bitbake'
      } as unknown as Promise<SpawnSyncReturns<Buffer>>))

      const onSanityChange = jest.fn()
      bitbakeDriver.onBitbakeSettingsSanityChange.on('change', onSanityChange)

      const sane = await bitbakeDriver.checkBitbakeSettingsSanity()

      expect(sane).toStrictEqual(true)
      expect(bitbakeDriver.isBitbakeSettingsSane()).toStrictEqual(true)
      expect(bitbakeDriver.getBitbakeSettingsError()).toBeUndefined()
      expect(onSanityChange).toHaveBeenCalledWith({ sane: true, error: undefined })
    })

    it('tracks BitBake settings errors', async () => {
      const bitbakeDriver = new BitbakeDriver()
      const bitbakeSettings: Record<string, unknown> = {
        pathToBitbakeFolder: __dirname,
        workingDirectory: __dirname,
        commandWrapper: '',
        pathToEnvScript: 'fakeEnvScript',
        pathToBuildFolder: 'nonexistent'
      }

      bitbakeDriver.loadSettings(bitbakeSettings, __dirname)
      jest.spyOn(BitbakeTerminal, 'runBitbakeTerminalCustomCommand').mockImplementation(async () => (undefined as unknown as Promise<IPty>))
      jest.spyOn(ProcessUtils, 'finishProcessExecution').mockReturnValueOnce(Promise.resolve({
        status: 1,
        stdout: 'error'
      } as unknown as Promise<SpawnSyncReturns<Buffer>>))

      const onSanityChange = jest.fn()
      bitbakeDriver.onBitbakeSettingsSanityChange.on('change', onSanityChange)

      const sane = await bitbakeDriver.checkBitbakeSettingsSanity()

      expect(sane).toStrictEqual(false)
      expect(bitbakeDriver.isBitbakeSettingsSane()).toStrictEqual(false)
      expect(bitbakeDriver.getBitbakeSettingsError()).toStrictEqual('devtool not found in $PATH\nSee Bitbake Terminal for command output.')
      expect(onSanityChange).toHaveBeenCalledWith({
        sane: false,
        error: 'devtool not found in $PATH\nSee Bitbake Terminal for command output.'
      })
    })
  })

  describe('composeBitbakeCommand', () => {
    let bitbakeDriver: BitbakeDriver
    beforeEach(() => {
      bitbakeDriver = new BitbakeDriver()
    })

    it('should compose bitbake command for scanning recipe environment', () => {
      const bitbakeTaskDefinition = {
        recipes: ['recipe1'],
        options: {
          env: true
        }
      } as BitbakeTaskDefinition

      const command = bitbakeDriver.composeBitbakeCommand(bitbakeTaskDefinition)
      expect(command).toEqual('bitbake recipe1 -e')
    })
  })
})
