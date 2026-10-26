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
import * as ProcessUtils from '../../../utils/ProcessUtils'
import { type ProcessFrontend, type ProcessSpawner, type ProcessRunOptions } from '../../../utils/ProcessFrontend'
import { createProcessMock } from '../../utils/processMock'

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
      jest.restoreAllMocks()
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
      jest.spyOn(BitbakeDriver.prototype, 'runBitbakeCommand').mockImplementation(async () => (undefined as unknown as Promise<IPty>))
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
      jest.spyOn(BitbakeDriver.prototype, 'runBitbakeCommand').mockImplementation(async () => (undefined as unknown as Promise<IPty>))
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

    it('can mark cached BitBake settings as sane', () => {
      const bitbakeDriver = new BitbakeDriver()
      const onSanityChange = jest.fn()
      bitbakeDriver.onBitbakeSettingsSanityChange.on('change', onSanityChange)

      bitbakeDriver.markBitbakeSettingsSane()

      expect(bitbakeDriver.isBitbakeSettingsSane()).toStrictEqual(true)
      expect(bitbakeDriver.getBitbakeSettingsError()).toBeUndefined()
      expect(onSanityChange).toHaveBeenCalledWith({ sane: true, error: undefined })
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

describe('BitbakeDriver process frontend', () => {
  afterEach(() => {
    jest.restoreAllMocks()
    jest.useRealTimers()
  })

  function createFrontend (): ProcessFrontend & { runProcess: jest.Mock<Promise<IPty>, [ProcessSpawner, string, ProcessRunOptions?]> } {
    return { runProcess: jest.fn<Promise<IPty>, [ProcessSpawner, string, ProcessRunOptions?]>(async spawn => await spawn({ columns: 110, rows: 35 })) }
  }

  it('composes the BitBake environment and consumes an alternative frontend', async () => {
    const frontend = createFrontend()
    const driver = new BitbakeDriver(frontend)
    driver.bitbakeSettings = {
      pathToBitbakeFolder: '', pathToEnvScript: '/env/setup', pathToBuildFolder: '/build',
      workingDirectory: '/workspace', commandWrapper: 'wrapper', shellEnv: { DRIVER_TEST: 'value' }
    }
    const process = createProcessMock()
    const spawn = jest.spyOn(ProcessUtils.pty, 'spawn').mockReturnValue(process.child)
    await driver.runBitbakeCommand('devtool status', 'Devtool', true)

    const script = "wrapper '. /env/setup /build && devtool status'"
    expect(frontend.runProcess).toHaveBeenCalledWith(expect.any(Function), script, {
      name: 'Devtool', background: true, cancel: expect.any(Function)
    })
    expect(spawn).toHaveBeenCalledWith(global.process.env.SHELL ?? '/bin/sh', ['-c', script], {
      cwd: '/workspace', env: { ...global.process.env, DRIVER_TEST: 'value' }, cols: 110, rows: 35
    })
    process.exit(0)
  })

  it('composes task definitions before frontend execution', async () => {
    const driver = new BitbakeDriver(createFrontend())
    const run = jest.spyOn(driver, 'runBitbakeCommand').mockResolvedValue({} as IPty)
    await driver.runBitbakeTask({ type: 'bitbake', recipes: ['busybox'], task: 'clean' }, 'Clean')
    expect(run).toHaveBeenCalledWith('bitbake busybox -c clean', 'Clean', false)
  })

  it('serializes terminal-backed and headless commands until each process exits', async () => {
    jest.useFakeTimers()
    const frontend = createFrontend()
    const driver = new BitbakeDriver(frontend)
    const first = createProcessMock()
    const second = createProcessMock()
    const third = createProcessMock()
    const spawn = jest.spyOn(ProcessUtils.pty, 'spawn')
      .mockReturnValueOnce(first.child).mockReturnValueOnce(second.child).mockReturnValueOnce(third.child)
    const commands = [driver.runBitbakeCommand('first', 'First'), driver.spawnBitbakeProcess('quiet'), driver.runBitbakeCommand('third', 'Third')]
    await jest.advanceTimersByTimeAsync(100)
    expect(spawn).toHaveBeenCalledTimes(1)
    expect(driver.bitbakeProcessCommand).toBe('first')
    await jest.advanceTimersByTimeAsync(200)
    expect(spawn).toHaveBeenCalledTimes(1)
    first.exit(0)
    await jest.advanceTimersByTimeAsync(100)
    expect(spawn).toHaveBeenCalledTimes(2)
    expect(driver.bitbakeProcessCommand).toBe('quiet')
    second.exit(0)
    await jest.advanceTimersByTimeAsync(100)
    expect(spawn).toHaveBeenCalledTimes(3)
    expect(driver.bitbakeProcessCommand).toBe('third')
    third.exit(0)
    await Promise.all(commands)
    expect(driver.bitbakeProcess).toBeUndefined()
    expect(driver.bitbakeProcessCommand).toBeUndefined()
    expect(frontend.runProcess).toHaveBeenCalledTimes(2)
  })

  it('retains driver cancellation and ignores stale frontend cancellation', async () => {
    const frontend = createFrontend()
    const driver = new BitbakeDriver(frontend)
    const first = createProcessMock()
    const second = createProcessMock()
    jest.spyOn(ProcessUtils.pty, 'spawn').mockReturnValueOnce(first.child).mockReturnValueOnce(second.child)
    const kill = jest.spyOn(driver, 'killBitbake').mockResolvedValue()
    await driver.runBitbakeCommand('first', 'First')
    const cancelFirst = frontend.runProcess.mock.calls[0][2]?.cancel
    await cancelFirst?.(first.child)
    expect(kill).toHaveBeenCalledTimes(1)
    first.exit(0)
    await driver.runBitbakeCommand('second', 'Second')
    await cancelFirst?.(first.child)
    expect(kill).toHaveBeenCalledTimes(1)
    second.exit(0)
  })

  it('allows the next command after a spawn failure', async () => {
    const driver = new BitbakeDriver(createFrontend())
    const process = createProcessMock()
    jest.spyOn(ProcessUtils.pty, 'spawn').mockImplementationOnce(() => { throw new Error('spawn failed') }).mockReturnValueOnce(process.child)
    await expect(driver.runBitbakeCommand('first', 'First')).rejects.toThrow('spawn failed')
    expect(driver.bitbakeProcess).toBeUndefined()
    await expect(driver.runBitbakeCommand('second', 'Second')).resolves.toBe(process.child)
    process.exit(0)
  })
})
