/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { BitBakeProjectScanner } from '../../../driver/BitBakeProjectScanner'
import { BitbakeDriver } from '../../../driver/BitbakeDriver'
import { type BitbakeSettings } from '../../../lib/src/BitbakeSettings'
import * as BitbakeTerminal from '../../../ui/BitbakeTerminal'
import * as ProcessUtils from '../../../lib/src/utils/ProcessUtils'
import { setBitbakeESDKMode } from '../../../driver/BitbakeESDK'
import fs, { type PathLike } from 'fs'

// Yocto's eSDKs contain devtool but not bitbake. These tests ensure we can still provide devtool functionalities without bitbake.
describe('Devtool eSDK Mode Test Suite', () => {
  afterEach(() => {
    jest.clearAllMocks()
    setBitbakeESDKMode(false)
  })

  it('should pass sanity check without bitbake', async () => {
    const bitbakeSettings: BitbakeSettings = {
      pathToBitbakeFolder: 'nonexistent',
      workingDirectory: '/path/to/workspace',
      commandWrapper: '',
      pathToEnvScript: 'fakeEnvScript',
      pathToBuildFolder: 'nonexistent'
    }
    const bitbakeDriver = new BitbakeDriver()
    bitbakeDriver.loadSettings(bitbakeSettings, '/path/to/workspace')

    setBitbakeESDKMode(true)
    const bitbakeTerminalSpy = jest.spyOn(BitbakeTerminal, 'runBitbakeTerminalCustomCommand').mockImplementation(async () => undefined as any)
    const bitbakeExecutionSpy = jest.spyOn(ProcessUtils, 'finishProcessExecution').mockImplementation(async () => undefined as any)
    const fsExistsSpy = jest.spyOn(fs, 'existsSync').mockImplementation((path: PathLike) => {
      return path.toString().includes(bitbakeSettings.pathToEnvScript as string)
    })

    bitbakeExecutionSpy.mockReturnValueOnce(Promise.resolve({
      status: 0
    } as any))
    const bitbakeSanity = await bitbakeDriver.checkBitbakeSettingsSanity()
    expect(fsExistsSpy).toHaveBeenCalledWith(expect.stringContaining(bitbakeSettings.pathToEnvScript as string))
    expect(bitbakeTerminalSpy).toHaveBeenCalledWith(expect.anything(), expect.stringContaining('which devtool'), expect.anything(), expect.anything())
    expect(bitbakeSanity).toStrictEqual(true)
  })

  it('should scan devtool without bitbake', async () => {
    const bitbakeDriver = new BitbakeDriver()
    const bitBakeProjectScanner = new BitBakeProjectScanner(bitbakeDriver)
    setBitbakeESDKMode(true)

    const scanAvailableLayersSpy = jest.spyOn(bitBakeProjectScanner as any, 'scanAvailableLayers').mockImplementation(async () => {})
    const scanForRecipesSpy = jest.spyOn(bitBakeProjectScanner as any, 'scanForRecipes').mockImplementation(async () => {})
    const parseAllRecipesSpy = jest.spyOn(bitBakeProjectScanner as any, 'parseAllRecipes').mockImplementation(async () => {})
    const scanDevtoolWorkspaces = jest.spyOn(bitBakeProjectScanner as any, 'scanDevtoolWorkspaces').mockImplementation(async () => {})

    await bitBakeProjectScanner.rescanProject()

    expect(scanDevtoolWorkspaces).toHaveBeenCalled()
    expect(scanAvailableLayersSpy).not.toHaveBeenCalled()
    expect(scanForRecipesSpy).not.toHaveBeenCalled()
    expect(parseAllRecipesSpy).not.toHaveBeenCalled()
  })
})
