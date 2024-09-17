/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { BitBakeProjectScanner } from '../../../driver/BitBakeProjectScanner'
import { BitbakeDriver } from '../../../driver/BitbakeDriver'
import * as BitbakeTerminal from '../../../ui/BitbakeTerminal'
import * as ProcessUtils from '../../../utils/ProcessUtils'
import { bitbakeESDKMode, setBitbakeESDKMode } from '../../../driver/BitbakeESDK'
import { clientNotificationManager } from '../../../ui/ClientNotificationManager'
import { SpawnSyncReturns } from 'child_process'
import { IPty } from 'node-pty'

// Yocto's eSDKs contain devtool but not bitbake. These tests ensure we can still provide devtool functionalities without bitbake.
describe('Devtool eSDK Mode Test Suite', () => {
  afterEach(() => {
    jest.clearAllMocks()
    setBitbakeESDKMode(false)
  })

  it('should scan devtool without bitbake', async () => {
    const bitbakeDriver = new BitbakeDriver()
    const bitBakeProjectScanner = new BitBakeProjectScanner(bitbakeDriver)
    setBitbakeESDKMode(true)

    const scanAvailableLayersSpy = jest.spyOn(bitBakeProjectScanner, 'scanAvailableLayers').mockImplementation(async () => {})
    const scanForRecipesSpy = jest.spyOn(bitBakeProjectScanner, 'scanForRecipes').mockImplementation(async () => {})
    const parseAllRecipesSpy = jest.spyOn(bitBakeProjectScanner, 'parseAllRecipes').mockImplementation(async () => {})
    const scanDevtoolWorkspaces = jest.spyOn(bitBakeProjectScanner, 'scanDevtoolWorkspaces').mockImplementation(async () => {})

    await bitBakeProjectScanner.rescanProject()

    expect(scanDevtoolWorkspaces).toHaveBeenCalled()
    expect(scanAvailableLayersSpy).not.toHaveBeenCalled()
    expect(scanForRecipesSpy).not.toHaveBeenCalled()
    expect(parseAllRecipesSpy).not.toHaveBeenCalled()
  })

  it('can detect eSDK mode', async () => {
    const bitbakeDriver = new BitbakeDriver()
    const bitbakeSettings: Record<string, unknown> = {
      pathToBitbakeFolder: __dirname,
      workingDirectory: __dirname,
      commandWrapper: '',
      pathToEnvScript: 'fakeEnvScript',
      pathToBuildFolder: 'nonexistent'
    }
    bitbakeDriver.loadSettings(bitbakeSettings, __dirname)
    const bitbakeTerminalSpy = jest.spyOn(BitbakeTerminal, 'runBitbakeTerminalCustomCommand').mockImplementation(async () => (undefined as unknown as Promise<IPty>))
    const bitbakeExecutionSpy = jest.spyOn(ProcessUtils, 'finishProcessExecution')
    clientNotificationManager.showBitbakeSettingsError = jest.fn()

    bitbakeExecutionSpy.mockReturnValueOnce(Promise.resolve({
      status: 1,
      stdout: '/tmp/devtool\r\nbitbake not found'
    } as unknown as Promise<SpawnSyncReturns<Buffer>>))
    let sane = await bitbakeDriver.checkBitbakeSettingsSanity()
    expect(sane).toStrictEqual(true)
    expect(bitbakeTerminalSpy).toHaveBeenCalledWith(expect.anything(), expect.stringContaining('which'), expect.anything(), expect.anything())
    expect(bitbakeESDKMode).toStrictEqual(true)

    bitbakeExecutionSpy.mockReturnValueOnce(Promise.resolve({
      status: 0,
      stdout: '/tmp/devtool\r\n/tmp/bitbake'
    } as unknown as Promise<SpawnSyncReturns<Buffer>>))
    sane = await bitbakeDriver.checkBitbakeSettingsSanity()
    expect(sane).toStrictEqual(true)
    expect(bitbakeESDKMode).toStrictEqual(false)

    bitbakeExecutionSpy.mockReturnValueOnce(Promise.resolve({
      status: 1,
      stdout: 'error'
    }  as unknown as Promise<SpawnSyncReturns<Buffer>>))
    sane = await bitbakeDriver.checkBitbakeSettingsSanity()
    expect(sane).toStrictEqual(false)
  })
})
