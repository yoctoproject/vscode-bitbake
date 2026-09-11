/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2026 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import fs from 'fs'
import os from 'os'
import path from 'path'

import { runBitbakeSetupTerminal } from '../../../ui/BitbakeSetupTerminal'
import {
  probeBitbakeSetupWrynoseConfigurations,
  WRYNOSE_CONFIGURATIONS_DIAGNOSTIC_MARKER
} from '../../../utils/BitbakeSetupWrynoseCompatibility'

jest.mock('../../../ui/BitbakeSetupTerminal', () => ({
  runBitbakeSetupTerminal: jest.fn()
}))

describe('BitbakeSetupWrynose Tests', () => {
  const mockedRunBitbakeSetupTerminal =
    runBitbakeSetupTerminal as jest.MockedFunction<
    typeof runBitbakeSetupTerminal
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
    const tempParent = fs.mkdtempSync(path.join(os.tmpdir(), 'bitbake-setup-wrynose-parent-'))
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

  function mockRun (
    exitCode: number,
    output: string
  ): void {
    mockedRunBitbakeSetupTerminal.mockResolvedValueOnce({
      exitCode,
      output
    })
  }

  function getRunTempRoot (): string {
    const cwd = mockedRunBitbakeSetupTerminal.mock.calls[0][2]
    if (cwd === undefined) {
      throw new Error('Expected probe cwd to be set')
    }
    return cwd
  }

  async function runSuccessfulProbe (tempParent = createTempParent ()) {
    mockRun(1, diagnosticStdout(pinnedWrynosePayload()))

    return await probeBitbakeSetupWrynoseConfigurations('/opt/bin/bitbake-setup', tempParent, 'poky')
  }

  it('passes the exact Wrynose probe argv and cwd to the background terminal', async () => {
    const tempParent = createTempParent()

    const result = await runSuccessfulProbe(tempParent)

    expect(result.kind).toBe('success')
    const tempRoot = getRunTempRoot()
    expect(mockedRunBitbakeSetupTerminal).toHaveBeenCalledWith('/opt/bin/bitbake-setup', [
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
    true)
  })

  it('passes a custom registry as an invocation-only setting', async () => {
    const tempParent = createTempParent()
    const registry = 'git://example/registry;protocol=https;branch=main;rev=main'

    mockRun(1, diagnosticStdout(pinnedWrynosePayload()))

    const result = await probeBitbakeSetupWrynoseConfigurations(
      '/opt/bin/bitbake-setup',
      tempParent,
      'poky',
      registry
    )

    expect(result.kind).toBe('success')

    const tempRoot = getRunTempRoot()

    expect(mockedRunBitbakeSetupTerminal).toHaveBeenCalledWith(
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

    const result = await runSuccessfulProbe(tempParent)

    expect(result.kind).toBe('success')
    const tempRoot = getRunTempRoot()
    expect(path.relative(tempParent, tempRoot)).not.toMatch(/^\.\.(?:\/|\\|$)/)
    expect(path.relative(unrelatedWorkspace, tempRoot)).toMatch(/^\.\.(?:\/|\\|$)/)
  })

  it('cleans up the temp root after success', async () => {
    const result = await runSuccessfulProbe()

    expect(result.kind).toBe('success')
    expect(fs.existsSync(getRunTempRoot())).toBe(false)
  })

  it('cleans up the temp root after spawn failure', async () => {
    const tempParent = createTempParent()
    mockedRunBitbakeSetupTerminal.mockRejectedValueOnce(new Error('spawn ENOENT'))

    const result = await probeBitbakeSetupWrynoseConfigurations('/missing/bitbake-setup', tempParent, 'poky')

    expect(result).toEqual(expect.objectContaining({
      kind: 'failure',
      reason: 'spawn-failed',
      details: 'spawn ENOENT'
    }))
    expect(fs.existsSync(getRunTempRoot())).toBe(false)
  })

  it.each([
    ['parse failure', 1, diagnosticStdout('{poky: {name: }}'), 'malformed-diagnostic-payload'],
    ['schema failure', 1, diagnosticStdout('{poky: {name: 1}}'), 'invalid-diagnostic-schema'],
    ['nonzero failure', 2, 'unrelated failure', 'unexpected-nonzero-exit']
  ])('cleans up the temp root after %s', async (_label, exitCode, stdout, expectedReason) => {
    const tempParent = createTempParent()
    mockRun(exitCode, stdout)

    const result = await probeBitbakeSetupWrynoseConfigurations('/opt/bin/bitbake-setup', tempParent, 'poky')

    expect(result).toEqual(expect.objectContaining({
      kind: 'failure',
      reason: expectedReason
    }))
    expect(fs.existsSync(getRunTempRoot())).toBe(false)
  })

  it('parses the pinned Wrynose poky and poky-with-sstate diagnostic payload', async () => {
    const result = await runSuccessfulProbe()

    expect(result).toEqual(expect.objectContaining({
      kind: 'success',
      configurations: [
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
      ]
    }))
  })

  it('parses apostrophes inside descriptions', async () => {
    mockRun(1, diagnosticStdout(`{
      poky: {
        name: 'poky',
        description: "Builder's local configuration"
      }
    }`))

    const result = await probeBitbakeSetupWrynoseConfigurations('/opt/bin/bitbake-setup', createTempParent(), 'poky')

    expect(result).toEqual(expect.objectContaining({
      kind: 'success',
      configurations: [expect.objectContaining({
        name: 'poky',
        description: "Builder's local configuration"
      })]
    }))
  })

  it('allows trailing stdout after the balanced dictionary', async () => {
    mockRun(1, diagnosticStdout(
      '{poky: {name: "poky"}}',
      '\nadditional stdout after payload {not parsed'
    ))

    const result = await probeBitbakeSetupWrynoseConfigurations('/opt/bin/bitbake-setup', createTempParent(), 'poky')

    expect(result).toEqual(expect.objectContaining({
      kind: 'success',
      configurations: [expect.objectContaining({
        name: 'poky'
      })]
    }))
  })

  it('does not terminate extraction on braces inside quoted strings', async () => {
    mockRun(1, diagnosticStdout(`{
      poky: {
        name: 'poky',
        description: 'This { brace } stays inside the string'
      }
    }
    trailing text`))

    const result = await probeBitbakeSetupWrynoseConfigurations('/opt/bin/bitbake-setup', createTempParent(), 'poky')

    expect(result).toEqual(expect.objectContaining({
      kind: 'success',
      configurations: [expect.objectContaining({
        name: 'poky',
        description: 'This { brace } stays inside the string'
      })]
    }))
  })

  it('handles escaped quotes and backslashes inside quoted strings', async () => {
    mockRun(1, diagnosticStdout(String.raw`{
      poky: {
        name: 'poky',
        description: "Escaped \"quote\" and C:\\tmp\\{workspace}"
      }
    }
    trailing text`))

    const result = await probeBitbakeSetupWrynoseConfigurations('/opt/bin/bitbake-setup', createTempParent(), 'poky')

    expect(result).toEqual(expect.objectContaining({
      kind: 'success',
      configurations: [expect.objectContaining({
        name: 'poky',
        description: 'Escaped "quote" and C:\\tmp\\{workspace}'
      })]
    }))
  })

  it.each([
    ['True', '{poky: {enabled: True}}'],
    ['False', '{poky: {enabled: False}}'],
    ['None', '{poky: {value: None}}']
  ])('fails closed for Python %s payloads', async (_label, payload) => {
    mockRun(1, diagnosticStdout(payload))

    const result = await probeBitbakeSetupWrynoseConfigurations('/opt/bin/bitbake-setup', createTempParent(), 'poky')

    expect(result).toEqual(expect.objectContaining({
      kind: 'failure',
      reason: 'malformed-diagnostic-payload'
    }))
  })

  it('reports missing-diagnostic-marker for wrong or missing marker output', async () => {
    mockRun(1, 'ERROR: a different bitbake-setup diagnostic:\n{poky: {name: "Poky"}}')

    const result = await probeBitbakeSetupWrynoseConfigurations('/opt/bin/bitbake-setup', createTempParent(), 'poky')

    expect(result).toEqual(expect.objectContaining({
      kind: 'failure',
      reason: 'missing-diagnostic-marker'
    }))
  })

  it('reports unexpected-zero-exit for exit 0', async () => {
    mockRun(0, diagnosticStdout(pinnedWrynosePayload()))

    const result = await probeBitbakeSetupWrynoseConfigurations('/opt/bin/bitbake-setup', createTempParent(), 'poky')

    expect(result).toEqual(expect.objectContaining({
      kind: 'failure',
      reason: 'unexpected-zero-exit',
      exitCode: 0
    }))
  })

  it('reports unexpected-nonzero-exit for unrelated exit 2', async () => {
    mockRun(2, diagnosticStdout(pinnedWrynosePayload()))

    const result = await probeBitbakeSetupWrynoseConfigurations('/opt/bin/bitbake-setup', createTempParent(), 'poky')

    expect(result).toEqual(expect.objectContaining({
      kind: 'failure',
      reason: 'unexpected-nonzero-exit',
      exitCode: 2
    }))
  })

  it('reports malformed-diagnostic-payload for unbalanced object extraction', async () => {
    mockRun(1, diagnosticStdout('{poky: {name: "Poky"}'))

    const result = await probeBitbakeSetupWrynoseConfigurations('/opt/bin/bitbake-setup', createTempParent(), 'poky')

    expect(result).toEqual(expect.objectContaining({
      kind: 'failure',
      reason: 'malformed-diagnostic-payload'
    }))
  })

  it('reports malformed-diagnostic-payload when non-whitespace appears after the marker before the object', async () => {
    mockRun(1, `${WRYNOSE_CONFIGURATIONS_DIAGNOSTIC_MARKER} unexpected text {poky: {name: "Poky"}}`)

    const result = await probeBitbakeSetupWrynoseConfigurations('/opt/bin/bitbake-setup', createTempParent(), 'poky')

    expect(result).toEqual(expect.objectContaining({
      kind: 'failure',
      reason: 'malformed-diagnostic-payload'
    }))
  })

  it('reports malformed-diagnostic-payload for malformed JSON5', async () => {
    mockRun(1, diagnosticStdout('{poky: {name: }}'))

    const result = await probeBitbakeSetupWrynoseConfigurations('/opt/bin/bitbake-setup', createTempParent(), 'poky')

    expect(result).toEqual(expect.objectContaining({
      kind: 'failure',
      reason: 'malformed-diagnostic-payload'
    }))
  })

  it('reports invalid-diagnostic-schema for invalid schema', async () => {
    mockRun(1, diagnosticStdout('{poky: null}'))

    const result = await probeBitbakeSetupWrynoseConfigurations('/opt/bin/bitbake-setup', createTempParent(), 'poky')

    expect(result).toEqual(expect.objectContaining({
      kind: 'failure',
      reason: 'invalid-diagnostic-schema'
    }))
  })

  it('reports invalid-diagnostic-schema for malformed oe-fragments-one-of', async () => {
    mockRun(1, diagnosticStdout(`{
      poky: {
        'oe-fragments-one-of': {
          sstate: {
            description: 'Shared state cache configuration',
            options: [{name: 'mirror'}]
          }
        }
      }
    }`))

    const result = await probeBitbakeSetupWrynoseConfigurations('/opt/bin/bitbake-setup', createTempParent(), 'poky')

    expect(result).toEqual(expect.objectContaining({
      kind: 'failure',
      reason: 'invalid-diagnostic-schema'
    }))
  })

  it('tolerates unknown string, list, and object properties', async () => {
    mockRun(1, diagnosticStdout(`{
      poky: {
        name: 'poky',
        vendor: 'Yocto',
        aliases: ['qemuarm', 'qemux86'],
        nested: {path: 'conf/local.conf', fragments: ['a', {b: 'c'}]},
        'oe-fragments-one-of': {
          sstate: {
            description: 'Shared state cache configuration',
            options: [
              {name: 'mirror', description: 'Use mirror', hint: {path: 'cache'}}
            ],
            metadata: ['stable']
          }
        }
      }
    }`))

    const result = await probeBitbakeSetupWrynoseConfigurations('/opt/bin/bitbake-setup', createTempParent(), 'poky')

    expect(result).toEqual(expect.objectContaining({
      kind: 'success',
      configurations: [
        expect.objectContaining({
          name: 'poky',
          fragmentGroups: [
            expect.objectContaining({
              name: 'sstate',
              description: 'Shared state cache configuration',
              options: [
                expect.objectContaining({
                  name: 'mirror',
                  description: 'Use mirror'
                })
              ]
            })
          ]
        })
      ]
    }))
  })

  it.each([
    ['numeric', "{poky: {name: 'poky', extra: 1}}"],
    ['boolean', "{poky: {name: 'poky', extra: true}}"],
    ['null', "{poky: {name: 'poky', extra: null}}"],
    ['NaN', "{poky: {name: 'poky', extra: NaN}}"],
    ['Infinity', "{poky: {name: 'poky', extra: Infinity}}"]
  ])('rejects unknown %s values', async (_label, payload) => {
    mockRun(1, diagnosticStdout(payload))

    const result = await probeBitbakeSetupWrynoseConfigurations('/opt/bin/bitbake-setup', createTempParent(), 'poky')

    expect(result).toEqual(expect.objectContaining({
      kind: 'failure',
      reason: 'invalid-diagnostic-schema'
    }))
  })

  it('reports temporary-directory-failed when temp root creation fails', async () => {
    jest.spyOn(fs.promises, 'mkdtemp').mockRejectedValueOnce(new Error('permission denied'))

    const result = await probeBitbakeSetupWrynoseConfigurations('/opt/bin/bitbake-setup', createTempParent(), 'poky')

    expect(result).toEqual(expect.objectContaining({
      kind: 'failure',
      reason: 'temporary-directory-failed',
      details: 'permission denied'
    }))
    expect(mockedRunBitbakeSetupTerminal).not.toHaveBeenCalled()
  })

  it('surfaces cleanup failure while preserving the successful probe result', async () => {
    mockRun(1, diagnosticStdout('{poky: {name: "poky"}}'))
    jest.spyOn(fs.promises, 'rm').mockRejectedValueOnce(new Error('cleanup denied'))

    const result = await probeBitbakeSetupWrynoseConfigurations('/opt/bin/bitbake-setup', createTempParent(), 'poky')
    const tempRoot = getRunTempRoot()

    expect(result).toEqual(expect.objectContaining({
      kind: 'failure',
      reason: 'cleanup-failed',
      details: 'cleanup denied',
      previousResult: expect.objectContaining({
        kind: 'success',
        configurations: [
          expect.objectContaining({
            name: 'poky'
          })
        ]
      })
    }))

    jest.restoreAllMocks()
    fs.rmSync(tempRoot, { recursive: true, force: true })
  })
})
