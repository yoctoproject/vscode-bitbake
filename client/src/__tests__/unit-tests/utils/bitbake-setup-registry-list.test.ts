/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2026 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import fs from 'fs'
import os from 'os'
import path from 'path'

import { runBitbakeSetup } from '../../../utils/BitbakeSetupRunner'
import {
  listBitbakeSetupRegistryConfigurations,
  parseBitbakeSetupRegistryList
} from '../../../utils/BitbakeSetupRegistryList'

jest.mock('../../../utils/BitbakeSetupRunner', () => ({
  runBitbakeSetup: jest.fn()
}))

describe('BitbakeSetupRegistryList', () => {
  const mockedRunBitbakeSetup =
    runBitbakeSetup as jest.MockedFunction<typeof runBitbakeSetup>

  const tempParents: string[] = []

  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterEach(() => {
    jest.restoreAllMocks()

    while (tempParents.length > 0) {
      const tempParent = tempParents.pop()

      if (tempParent !== undefined) {
        fs.rmSync(tempParent, {
          recursive: true,
          force: true
        })
      }
    }
  })

  function createTempParent (): string {
    const tempParent = fs.mkdtempSync(
      path.join(os.tmpdir(), 'bitbake-setup-list-parent-')
    )

    tempParents.push(tempParent)
    return tempParent
  }

  function mockSuccessfulList (
    payload: unknown
  ): void {
    mockedRunBitbakeSetup.mockImplementationOnce(
      async (_executablePath, argv) => {
        const outputPath = argv[argv.length - 1]

        if (outputPath === undefined) {
          throw new Error('Expected --write-json output path')
        }

        await fs.promises.writeFile(
          outputPath,
          JSON.stringify(payload),
          'utf8'
        )

        return {
          exitCode: 0,
          stdout: 'list stdout',
          stderr: ''
        }
      }
    )
  }

  it('parses the Yocto registry list shape', () => {
    expect(parseBitbakeSetupRegistryList({
      'oe-nodistro-master': {
        description: 'OpenEmbedded nodistro master'
      },
      'poky-wrynose': {
        description: 'Poky Wrynose',
        expires: '2030-05-31'
      }
    })).toStrictEqual([
      {
        id: 'oe-nodistro-master',
        description: 'OpenEmbedded nodistro master',
        expires: undefined
      },
      {
        id: 'poky-wrynose',
        description: 'Poky Wrynose',
        expires: '2030-05-31'
      }
    ])
  })

  it('allows an empty registry list', () => {
    expect(parseBitbakeSetupRegistryList({})).toStrictEqual([])
  })

  it('rejects malformed registry entries', () => {
    expect(() => {
      parseBitbakeSetupRegistryList({
        'poky-wrynose': {
          description: 42
        }
      })
    }).toThrow(
      "bitbake-setup registry configuration 'poky-wrynose'.description must be a string"
    )
  })

  it('runs list --write-json with the builtin registry by default', async () => {
    mockSuccessfulList({
      'poky-wrynose': {
        description: 'Poky Wrynose'
      }
    })

    const result = await listBitbakeSetupRegistryConfigurations(
      '/opt/bin/bitbake-setup',
      createTempParent()
    )

    expect(result).toEqual(expect.objectContaining({
      kind: 'success',
      configurations: [
        {
          id: 'poky-wrynose',
          description: 'Poky Wrynose',
          expires: undefined
        }
      ]
    }))

    const call = mockedRunBitbakeSetup.mock.calls[0]

    expect(call[0]).toBe('/opt/bin/bitbake-setup')
    expect(call[1][0]).toBe('list')
    expect(call[1][1]).toBe('--write-json')
    expect(call[2]).toBeDefined()
  })

  it('passes a custom registry as an invocation-only setting', async () => {
    mockSuccessfulList({})

    await listBitbakeSetupRegistryConfigurations(
      '/opt/bin/bitbake-setup',
      createTempParent(),
      'git://example/registry;protocol=https;branch=main;rev=main'
    )

    const call = mockedRunBitbakeSetup.mock.calls[0]

    expect(call[1].slice(0, 7)).toStrictEqual([
      '--setting',
      'default',
      'registry',
      'git://example/registry;protocol=https;branch=main;rev=main',
      'list',
      '--write-json',
      call[1][6]
    ])
  })

  it('cleans up its temporary directory after success', async () => {
    mockSuccessfulList({})

    const result = await listBitbakeSetupRegistryConfigurations(
      '/opt/bin/bitbake-setup',
      createTempParent()
    )

    expect(result.kind).toBe('success')

    const cwd = mockedRunBitbakeSetup.mock.calls[0][2]

    expect(cwd).toBeDefined()

    if (cwd !== undefined) {
      expect(fs.existsSync(cwd)).toBe(false)
    }
  })

  it('reports list-failed when bitbake-setup exits nonzero', async () => {
    mockedRunBitbakeSetup.mockResolvedValueOnce({
      exitCode: 2,
      stdout: '',
      stderr: 'registry failed'
    })

    const result = await listBitbakeSetupRegistryConfigurations(
      '/opt/bin/bitbake-setup',
      createTempParent()
    )

    expect(result).toEqual(expect.objectContaining({
      kind: 'failure',
      reason: 'list-failed',
      exitCode: 2,
      stderr: 'registry failed'
    }))
  })

  it('reports malformed-json for invalid list output', async () => {
    mockedRunBitbakeSetup.mockImplementationOnce(
      async (_executablePath, argv) => {
        const outputPath = argv[argv.length - 1]

        if (outputPath === undefined) {
          throw new Error('Expected --write-json output path')
        }

        await fs.promises.writeFile(
          outputPath,
          '{broken',
          'utf8'
        )

        return {
          exitCode: 0,
          stdout: '',
          stderr: ''
        }
      }
    )

    const result = await listBitbakeSetupRegistryConfigurations(
      '/opt/bin/bitbake-setup',
      createTempParent()
    )

    expect(result).toEqual(expect.objectContaining({
      kind: 'failure',
      reason: 'malformed-json'
    }))
  })

  it('reports spawn-failed when the process cannot start', async () => {
    mockedRunBitbakeSetup.mockRejectedValueOnce(
      new Error('spawn ENOENT')
    )

    const result = await listBitbakeSetupRegistryConfigurations(
      '/missing/bitbake-setup',
      createTempParent()
    )

    expect(result).toEqual(expect.objectContaining({
      kind: 'failure',
      reason: 'spawn-failed',
      details: 'spawn ENOENT'
    }))
  })
})
