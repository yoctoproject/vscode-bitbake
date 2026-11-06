/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as vscode from 'vscode'
import { BitBakeProjectScanner, parseRecipesOutput } from '../../../driver/BitBakeProjectScanner'
import { BitbakeDriver } from '../../../driver/BitbakeDriver'
import * as ProcessUtils from '../../../utils/ProcessUtils'
import { type IPty } from 'node-pty'
import { type SpawnSyncReturns } from 'child_process'

jest.mock('vscode')

describe('BitBakeProjectScanner unit tests', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  const layers = [
    {
      name: 'meta-variscite-bsp-imx',
      path: '/work/sources/meta-variscite-bsp-imx',
      priority: 6
    },
    {
      name: 'meta',
      path: '/work/sources/poky/meta',
      priority: 5
    }
  ]

  it('keeps all recipe entries and places a non-skipped entry first', () => {
    const output = `=== Available recipes: ===
freertos-variscite:
  meta-variscite-bsp-imx  2.9.x (skipped: incompatible with machine imx8mm-var-dart (not in COMPATIBLE_MACHINE))
  meta-variscite-bsp-imx  2.15.x`

    const recipes = parseRecipesOutput(output, layers)
    const freertosRecipes = recipes.filter((recipe) => recipe.name === 'freertos-variscite')

    expect(freertosRecipes).toHaveLength(2)
    expect(freertosRecipes.map((recipe) => recipe.version)).toEqual(['2.15.x', '2.9.x'])
    expect(freertosRecipes[0]).toEqual(
      expect.objectContaining({
        name: 'freertos-variscite',
        version: '2.15.x',
        skipped: undefined,
        layerInfo: expect.objectContaining({
          name: 'meta-variscite-bsp-imx'
        })
      })
    )
    expect(freertosRecipes[1]).toEqual(
      expect.objectContaining({
        name: 'freertos-variscite',
        version: '2.9.x',
        skipped: undefined,
        layerInfo: expect.objectContaining({
          name: 'meta-variscite-bsp-imx'
        })
      })
    )
  })

  it('keeps a skipped recipe entry when no compatible version is listed', () => {
    const output = `=== Available recipes: ===
systemd:
  meta  257.3 (skipped: one of 'systemd' needs to be in DISTRO_FEATURES)`

    const recipes = parseRecipesOutput(output, layers)
    const recipe = recipes.find((recipe) => recipe.name === 'systemd')

    expect(recipe).toEqual(
      expect.objectContaining({
        name: 'systemd',
        version: '257.3',
        skipped: expect.stringContaining('skipped:')
      })
    )
  })
  it('shows a non-modal error when path mapping fails', async () => {
    const scanner = new BitBakeProjectScanner(new BitbakeDriver())

    const scanResult = scanner.activeScanResult
    scanResult._containerPathMaps = {
      containerToHost: { '/container': '/host' },
      hostToContainer: { '/host': '/container' }
    }

    const scannerInternals = scanner as unknown as {
      existsInContainer: (containerPath: string) => Promise<boolean>
    }

    jest.spyOn(scannerInternals, 'existsInContainer').mockResolvedValue(false)

    const errorSpy = jest.spyOn(vscode.window, 'showErrorMessage')
      .mockResolvedValue(undefined)

    await scanner.resolveHostPath('/host/test.bb')

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Bitbake extension couldn\'t locate a file')
    )
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('bitbake.commandWrapper')
    )
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('/host/test.bb')
    )
    expect(errorSpy.mock.calls[0]).toHaveLength(1)
  })

})

describe('path discovery execution', () => {
  afterEach(() => { jest.restoreAllMocks() })

  it.each([true, false])('preserves the quiet=%s execution path', async quiet => {
    const driver = new BitbakeDriver()
    const scanner = new BitBakeProjectScanner(driver)
    const headless = jest.spyOn(driver, 'spawnBitbakeProcess').mockResolvedValue({} as IPty)
    const presented = jest.spyOn(driver, 'runBitbakeCommand').mockResolvedValue({} as IPty)
    jest.spyOn(ProcessUtils, 'finishProcessExecution').mockResolvedValue({
      status: 0, output: [Buffer.from('123\n456')]
    } as SpawnSyncReturns<Buffer>)
    const internals = scanner as unknown as {
      getContainerParentInodes: (filepath: string, quiet: boolean) => Promise<number[]>
    }
    await expect(internals.getContainerParentInodes('/container/layer', quiet)).resolves.toEqual([123, 456])
    const command = expect.stringContaining('f=/container/layer;')
    if (quiet) {
      expect(headless).toHaveBeenCalledWith(command)
      expect(presented).not.toHaveBeenCalled()
    } else {
      expect(presented).toHaveBeenCalledWith(command, 'BitBake: Scan Project', true)
      expect(headless).not.toHaveBeenCalled()
    }
    expect(vscode.window.createTerminal).not.toHaveBeenCalled()
  })
})
