/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as vscode from 'vscode'
import { BitBakeProjectScanner, parseRecipesOutput } from '../../../driver/BitBakeProjectScanner'
import { BitbakeDriver } from '../../../driver/BitbakeDriver'
import * as BitbakeTerminal from '../../../ui/BitbakeTerminal'
import * as ProcessUtils from '../../../utils/ProcessUtils'
import { type IPty } from 'node-pty'

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
  it('preserves spaces when resolving a host path to a container path', async () => {
    const scanner = new BitBakeProjectScanner(new BitbakeDriver())

    const scannerInternals = scanner as unknown as {
      containerToHostMap: Map<string, string>
      hostToContainerMap: Map<string, string>
      existsInContainer: (containerPath: string) => Promise<boolean>
    }

    scannerInternals.containerToHostMap = new Map([['/container', '/host']])
    scannerInternals.hostToContainerMap = new Map([['/host', '/container']])

    const existsSpy = jest.spyOn(scannerInternals, 'existsInContainer')
      .mockResolvedValue(true)

    const result = await scanner.resolveHostPath('/host/path with space/test.bb')

    expect(existsSpy).toHaveBeenCalledWith('/container/path with space/test.bb')
    expect(result).toBe('/container/path with space/test.bb')
  })

  it('preserves a path with spaces for the container existence check', async () => {
    const scanner = new BitBakeProjectScanner(new BitbakeDriver())

    const scannerInternals = scanner as unknown as {
      containerToHostMap: Map<string, string>
      hostToContainerMap: Map<string, string>
    }

    scannerInternals.containerToHostMap = new Map([['/container', '/host']])
    scannerInternals.hostToContainerMap = new Map([['/host', '/container']])

    const terminalSpy = jest.spyOn(BitbakeTerminal, 'runBitbakeTerminalCustomCommand')
      .mockReturnValue(undefined as unknown as Promise<IPty>)

    jest.spyOn(ProcessUtils, 'finishProcessExecution')
      .mockReturnValue(Promise.resolve({ status: 0 }) as ReturnType<typeof ProcessUtils.finishProcessExecution>)

    await scanner.resolveHostPath('/host/path with space/test.bb')

    expect(terminalSpy).toHaveBeenCalledWith(
      expect.anything(),
      `test -e '/container/path with space/test.bb'`,
      'BitBake: Test file',
      true
    )
  })

  it('preserves a path with spaces when collecting container parent inodes', async () => {
    const scanner = new BitBakeProjectScanner(new BitbakeDriver())

    const scannerInternals = scanner as unknown as {
      getContainerParentInodes: (filepath: string) => Promise<number[]>
      executeBitBakeCommand: (command: string, timeout?: number) => Promise<string>
    }

    const executeSpy = jest.spyOn(scannerInternals, 'executeBitBakeCommand')
      .mockResolvedValue('123\n456\n')

    const result = await scannerInternals.getContainerParentInodes('/container/path with space/test.bb')

    expect(executeSpy).toHaveBeenCalledWith(
      `f='/container/path with space/test.bb'; while [[ $f != / ]]; do stat -c %i "$f"; f=$(realpath "$(dirname "$f")"); done;`,
      20000
    )
    expect(result).toEqual([123, 456])
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
