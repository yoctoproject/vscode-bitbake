/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2026 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import fs from 'fs'
import os from 'os'
import path from 'path'

import { runRawProcessTerminal } from '../../../ui/BitbakeTerminal'
import {
  probeBitbakeSetupWrynoseConfigurations,
  WRYNOSE_CONFIGURATIONS_DIAGNOSTIC_MARKER
} from '../../../utils/BitbakeSetupWrynoseCompatibility'

jest.mock('../../../ui/BitbakeTerminal', () => ({
  runRawProcessTerminal: jest.fn()
}))

describe('BitbakeSetupWrynoseCompatibility', () => {
  const mockedRunRawProcessTerminal =
    runRawProcessTerminal as jest.MockedFunction<
    typeof runRawProcessTerminal
    >
  const tempParents: string[] = []

  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterEach(() => {
    jest.restoreAllMocks()

    while (tempParents.length > 0) {
      const tempParent = tempParents.pop()

      if (tempParent !== undefined) {
        fs.rmSync(tempParent, { recursive: true, force: true })
      }
    }
  })

  function createTempParent (): string {
    const tempParent = fs.mkdtempSync(
      path.join(os.tmpdir(), 'bitbake-setup-wrynose-parent-')
    )
    tempParents.push(tempParent)
    return tempParent
  }

  function diagnosticStdout (payload: string, trailingStdout = ''): string {
    return `${WRYNOSE_CONFIGURATIONS_DIAGNOSTIC_MARKER}\n${payload}${trailingStdout}`
  }

  function pinnedWrynosePayload (): string {
    return `{
      poky: {
        name: 'poky',
        description: 'Poky - The Yocto Project testing distribution',
        'bb-layers': ['openembedded-core/meta', 'meta-yocto/meta-yocto-bsp', 'meta-yocto/meta-poky'],
        'setup-dir-name': '$distro-wrynose',
        'oe-fragments-one-of': {
          machine: {
            description: 'Target machines',
            options: [
              {name: 'machine/qemux86-64', description: 'x86-64 system on QEMU'},
              {name: 'machine/qemuarm64', description: 'ARMv8 system on QEMU'},
              {name: 'machine/qemuriscv64', description: 'RISC-V system on QEMU'},
              {name: 'machine/genericarm64', description: 'Arm64 SystemReady IR/ES platforms'},
              {name: 'machine/genericx86-64', description: 'x86_64 (64-bit) PCs and servers'}
            ]
          },
          distro: {
            description: 'Target distributions',
            options: [
              {name: 'distro/poky', description: 'Yocto Project Reference Distro'},
              {name: 'distro/poky-altcfg', description: 'Poky alternative with systemd as init manager'},
              {name: 'distro/poky-tiny', description: 'Poky alternative optimized for size'}
            ]
          }
        }
      },
      'poky-with-sstate': {
        name: 'poky-with-sstate',
        description: 'Poky - The Yocto Project testing distribution with internet sstate acceleration. Use with caution as it requires a completely robust local network with sufficient bandwidth.',
        'bb-layers': ['openembedded-core/meta', 'meta-yocto/meta-yocto-bsp', 'meta-yocto/meta-poky'],
        'setup-dir-name': '$distro-wrynose',
        'oe-fragments': ['core/yocto/sstate-mirror-cdn'],
        'oe-fragments-one-of': {
          machine: {
            description: 'Target machines',
            options: [
              {name: 'machine/qemux86-64', description: 'x86-64 system on QEMU'},
              {name: 'machine/qemuarm64', description: 'ARMv8 system on QEMU'},
              {name: 'machine/qemuriscv64', description: 'RISC-V system on QEMU'},
              {name: 'machine/genericarm64', description: 'Arm64 SystemReady IR/ES platforms'},
              {name: 'machine/genericx86-64', description: 'x86_64 (64-bit) PCs and servers'}
            ]
          },
          distro: {
            description: 'Target distributions',
            options: [
              {name: 'distro/poky', description: 'Yocto Project Reference Distro'},
              {name: 'distro/poky-altcfg', description: 'Poky alternative with systemd as init manager'},
              {name: 'distro/poky-tiny', description: 'Poky alternative optimized for size'}
            ]
          }
        }
      }
    }`
  }

  function mockRun (exitCode: number, output: string): void {
    mockedRunRawProcessTerminal.mockResolvedValueOnce({
      exitCode,
      output
    })
  }

  function probe (
    tempParent = createTempParent(),
    registry?: string
  ) {
    return probeBitbakeSetupWrynoseConfigurations(
      '/opt/bin/bitbake-setup',
      tempParent,
      'poky',
      registry
    )
  }

  function getRunTempRoot (): string {
    const cwd = mockedRunRawProcessTerminal.mock.calls[0][2]

    if (cwd === undefined) {
      throw new Error('Expected probe cwd to be set')
    }

    return cwd
  }

  async function runSuccessfulProbe (tempParent = createTempParent ()) {
    mockRun(1, diagnosticStdout(pinnedWrynosePayload()))

    return await probe(tempParent)
  }

  it('passes the exact Wrynose probe argv and cwd to the background terminal', async () => {
    const tempParent = createTempParent()

    await runSuccessfulProbe(tempParent)

    const tempRoot = getRunTempRoot()
    expect(mockedRunRawProcessTerminal).toHaveBeenCalledWith(
      '/opt/bin/bitbake-setup',
      [
        '--setting',
        'default',
        'top-dir-prefix',
        tempRoot,
        '--setting',
        'default',
        'top-dir-name',
        'workspace',
        'init',
        '--non-interactive',
        'poky'
      ],
      tempRoot,
      'BitBake: Inspect bitbake-setup configuration',
      true
    )
  })

  it('passes a custom registry as an invocation-only setting', async () => {
    const tempParent = createTempParent()
    const registry = 'git://example/registry;protocol=https;branch=main;rev=main'

    mockRun(1, diagnosticStdout(pinnedWrynosePayload()))

    await probe(tempParent, registry)

    const tempRoot = getRunTempRoot()

    expect(mockedRunRawProcessTerminal).toHaveBeenCalledWith(
      '/opt/bin/bitbake-setup',
      [
        '--setting',
        'default',
        'top-dir-prefix',
        tempRoot,
        '--setting',
        'default',
        'top-dir-name',
        'workspace',
        '--setting',
        'default',
        'registry',
        registry,
        'init',
        '--non-interactive',
        'poky'
      ],
      tempRoot,
      'BitBake: Inspect bitbake-setup configuration',
      true
    )
  })

  it('creates the temp root under the supplied temporary parent', async () => {
    const tempParent = createTempParent()
    const unrelatedWorkspace = createTempParent()

    await runSuccessfulProbe(tempParent)

    const tempRoot = getRunTempRoot()
    expect(path.relative(tempParent, tempRoot)).not.toMatch(/^\.\.(?:\/|\\|$)/)
    expect(path.relative(unrelatedWorkspace, tempRoot)).toMatch(/^\.\.(?:\/|\\|$)/)
  })

  it('cleans up the temp root after success', async () => {
    await runSuccessfulProbe()

    expect(fs.existsSync(getRunTempRoot())).toBe(false)
  })

  it('cleans up the temp root after a probe failure', async () => {
    mockRun(2, 'unrelated failure')

    await expect(probe()).rejects.toThrow('unexpected status 2')

    expect(fs.existsSync(getRunTempRoot())).toBe(false)
  })

  it('parses the pinned Wrynose poky and poky-with-sstate diagnostic payload', async () => {
    const configurations = await runSuccessfulProbe()

    expect(configurations).toEqual([
      expect.objectContaining({
        name: 'poky',
        description: 'Poky - The Yocto Project testing distribution',
        fragmentGroups: expect.arrayContaining([
          expect.objectContaining({
            name: 'machine',
            options: expect.arrayContaining([
              expect.objectContaining({ name: 'machine/qemux86-64' }),
              expect.objectContaining({ name: 'machine/qemuarm64' }),
              expect.objectContaining({ name: 'machine/qemuriscv64' }),
              expect.objectContaining({ name: 'machine/genericarm64' }),
              expect.objectContaining({ name: 'machine/genericx86-64' })
            ])
          }),
          expect.objectContaining({
            name: 'distro',
            options: expect.arrayContaining([
              expect.objectContaining({ name: 'distro/poky' }),
              expect.objectContaining({ name: 'distro/poky-altcfg' }),
              expect.objectContaining({ name: 'distro/poky-tiny' })
            ])
          })
        ])
      }),
      expect.objectContaining({
        name: 'poky-with-sstate',
        fragmentGroups: expect.arrayContaining([
          expect.objectContaining({ name: 'machine' }),
          expect.objectContaining({ name: 'distro' })
        ])
      })
    ])
  })

  it('parses JSON5 single quotes and unquoted keys', async () => {
    mockRun(1, diagnosticStdout(`{
      poky: {
        name: 'poky',
        description: 'Builder local configuration'
      }
    }`))

    await expect(probe()).resolves.toEqual([
      expect.objectContaining({
        name: 'poky',
        description: 'Builder local configuration'
      })
    ])
  })

  it('allows trailing output after the balanced diagnostic object', async () => {
    mockRun(1, diagnosticStdout(
      '{poky: {name: "poky"}}',
      '\nadditional output after payload {not parsed'
    ))

    await expect(probe()).resolves.toEqual([
      expect.objectContaining({ name: 'poky' })
    ])
  })

  it('does not terminate extraction on braces inside quoted strings', async () => {
    mockRun(1, diagnosticStdout(`{
      poky: {
        name: 'poky',
        description: 'This { brace } stays inside the string'
      }
    }
    trailing text`))

    await expect(probe()).resolves.toEqual([
      expect.objectContaining({
        name: 'poky',
        description: 'This { brace } stays inside the string'
      })
    ])
  })

  it('handles escaped quotes and backslashes inside quoted strings', async () => {
    mockRun(1, diagnosticStdout(String.raw`{
      poky: {
        name: 'poky',
        description: "Escaped \"quote\" and C:\\tmp\\{workspace}"
      }
    }
    trailing text`))

    await expect(probe()).resolves.toEqual([
      expect.objectContaining({
        name: 'poky',
        description: 'Escaped "quote" and C:\\tmp\\{workspace}'
      })
    ])
  })

  it('allows unused unknown numeric, boolean, and null properties', async () => {
    mockRun(1, diagnosticStdout(`{
      poky: {
        name: 'poky',
        numeric: 1,
        enabled: true,
        unset: null,
        nested: {
          value: false
        }
      }
    }`))

    await expect(probe()).resolves.toEqual([
      expect.objectContaining({ name: 'poky' })
    ])
  })

  it('throws when the raw terminal process cannot start', async () => {
    mockedRunRawProcessTerminal.mockRejectedValueOnce(new Error('spawn ENOENT'))

    await expect(
      probeBitbakeSetupWrynoseConfigurations(
        '/missing/bitbake-setup',
        createTempParent(),
        'poky'
      )
    ).rejects.toThrow(
      'Failed to start Wrynose diagnostic compatibility probe: spawn ENOENT'
    )

    expect(fs.existsSync(getRunTempRoot())).toBe(false)
  })

  it('throws when the probe unexpectedly succeeds', async () => {
    mockRun(0, diagnosticStdout(pinnedWrynosePayload()))

    await expect(probe()).rejects.toThrow(
      'Wrynose diagnostic compatibility probe unexpectedly succeeded'
    )
  })

  it('throws when the probe returns an unrelated nonzero status', async () => {
    mockRun(2, diagnosticStdout(pinnedWrynosePayload()))

    await expect(probe()).rejects.toThrow(
      'Wrynose diagnostic compatibility probe exited with unexpected status 2'
    )
  })

  it('throws when the expected marker is absent', async () => {
    mockRun(1, 'ERROR: a different bitbake-setup diagnostic:\n{poky: {name: "poky"}}')

    await expect(probe()).rejects.toThrow(
      'Wrynose diagnostic compatibility probe output did not contain the expected configurations marker'
    )
  })

  it('throws when the diagnostic payload cannot be extracted', async () => {
    mockRun(1, diagnosticStdout('{poky: {name: "poky"}'))

    await expect(probe()).rejects.toThrow(
      'Wrynose diagnostic compatibility probe output did not contain a balanced configurations object'
    )
  })

  it('throws when non-whitespace appears before the diagnostic object', async () => {
    mockRun(
      1,
      `${WRYNOSE_CONFIGURATIONS_DIAGNOSTIC_MARKER} unexpected text {poky: {name: "poky"}}`
    )

    await expect(probe()).rejects.toThrow(
      'Wrynose diagnostic compatibility probe output did not contain a balanced configurations object'
    )
  })

  it('throws when the diagnostic object is malformed JSON5', async () => {
    mockRun(1, diagnosticStdout('{poky: {name: }}'))

    await expect(probe()).rejects.toThrow(
      'Failed to parse Wrynose configurations diagnostic as JSON5'
    )
  })

  it('throws when a consumed configuration field is malformed', async () => {
    mockRun(1, diagnosticStdout(`{
      poky: {
        name: 'poky',
        description: 1
      }
    }`))

    await expect(probe()).rejects.toThrow(
      'configuration manifest bitbake-setup.configurations[0].description must be a string'
    )
  })

  it('throws when a consumed fragment field is malformed', async () => {
    mockRun(1, diagnosticStdout(`{
      poky: {
        name: 'poky',
        'oe-fragments-one-of': {
          sstate: {
            description: 'Shared state cache configuration',
            options: [{name: 1}]
          }
        }
      }
    }`))

    await expect(probe()).rejects.toThrow(
      'configuration manifest bitbake-setup.configurations[0].oe-fragments-one-of.sstate.options[0].name must be a string'
    )
  })

  it('throws when the diagnostic object is empty', async () => {
    mockRun(1, diagnosticStdout('{}'))

    await expect(probe()).rejects.toThrow(
      'Wrynose diagnostic payload must not be empty'
    )
  })

  it('throws when temporary directory creation fails', async () => {
    jest.spyOn(fs.promises, 'mkdtemp').mockRejectedValueOnce(
      new Error('permission denied')
    )

    await expect(probe()).rejects.toThrow(
      'Failed to create temporary Wrynose probe directory: permission denied'
    )

    expect(mockedRunRawProcessTerminal).not.toHaveBeenCalled()
  })

  it('throws when temporary directory cleanup fails', async () => {
    mockRun(1, diagnosticStdout('{poky: {name: "poky"}}'))
    jest.spyOn(fs.promises, 'rm').mockRejectedValueOnce(
      new Error('cleanup denied')
    )

    await expect(probe()).rejects.toThrow(
      'Failed to remove temporary Wrynose probe directory'
    )
  })
})
