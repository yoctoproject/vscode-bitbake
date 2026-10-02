/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as vscode from 'vscode'
import { BitBakeProjectScanner, parseRecipesOutput } from '../../../driver/BitBakeProjectScanner'
import { BitbakeDriver } from '../../../driver/BitbakeDriver'

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
  it('forwards quiet resolution to mount-point discovery', async () => {
    const bitbakeDriver = {
      getBuildConfig: jest.fn().mockReturnValue('/host/workdir')
    } as unknown as BitbakeDriver
    const scanner = new BitBakeProjectScanner(bitbakeDriver)

    const scannerInternals = scanner as unknown as {
      scanContainerMountPoint: (
        layerPath: string,
        hostWorkdir: string,
        quiet?: boolean
      ) => Promise<{ container: string, host: string } | undefined>
    }

    const discoverySpy = jest.spyOn(scannerInternals, 'scanContainerMountPoint')
      .mockResolvedValue(undefined)

    await scanner.resolveContainerPath('/container/unmapped/file.bb', true)

    expect(discoverySpy).toHaveBeenCalledWith(
      '/container/unmapped/file.bb',
      '/host/workdir',
      true
    )
  })

  it('runs quiet scanner commands directly through the BitBake driver', async () => {
    const process = {
      pid: 1,
      onData: jest.fn(() => ({ dispose: jest.fn() })),
      onExit: jest.fn((callback: (event: { exitCode: number, signal: number }) => void) => {
        queueMicrotask(() => {
          callback({ exitCode: 0, signal: 0 })
        })
        return { dispose: jest.fn() }
      }),
      kill: jest.fn()
    }

    const bitbakeDriver = {
      spawnBitbakeProcess: jest.fn().mockResolvedValue(process),
      killBitbake: jest.fn()
    } as unknown as BitbakeDriver

    const scanner = new BitBakeProjectScanner(bitbakeDriver)
    const scannerInternals = scanner as unknown as {
      executeBitBakeCommand: (
        command: string,
        timeout?: number,
        quiet?: boolean
      ) => Promise<string>
    }

    await scannerInternals.executeBitBakeCommand('quiet command', 20000, true)

    expect(bitbakeDriver.spawnBitbakeProcess).toHaveBeenCalledWith('quiet command')
  })

  it('shows a non-modal error when path mapping fails', async () => {
    const scanner = new BitBakeProjectScanner(new BitbakeDriver())

    const scannerInternals = scanner as unknown as {
      containerToHostMap: Map<string, string>
      hostToContainerMap: Map<string, string>
      existsInContainer: (containerPath: string) => Promise<boolean>
    }

    scannerInternals.containerToHostMap = new Map([['/container', '/host']])
    scannerInternals.hostToContainerMap = new Map([['/host', '/container']])

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
