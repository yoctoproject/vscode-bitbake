/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2026 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import fs from 'fs'
import os from 'os'
import path from 'path'

import { runRawProcessTerminal } from '../../../ui/BitbakeTerminal'
import {
  listBitbakeSetupRegistryConfigurations
} from '../../../utils/BitbakeSetupRegistryList'

jest.mock('../../../ui/BitbakeTerminal', () => ({
  runRawProcessTerminal: jest.fn()
}))

describe('BitbakeSetupRegistryList', () => {
  const executablePath = '/opt/bin/bitbake-setup'
  const customRegistry =
    'git://example/registry;protocol=https;branch=main;rev=main'

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
    mockedRunRawProcessTerminal.mockImplementationOnce(
      async (_executablePath, argv) => {
        await writeOutput(argv, JSON.stringify(payload))

        return {
          exitCode: 0,
          output: 'list stdout'
        }
      }
    )
  }

  async function writeOutput (
    argv: string[],
    text: string
  ): Promise<void> {
    const outputPath = argv[argv.length - 1]

    if (outputPath === undefined) {
      throw new Error('Expected --write-json output path')
    }

    await fs.promises.writeFile(outputPath, text, 'utf8')
  }

  it('runs list --write-json with the builtin registry in the background', async () => {
    mockSuccessfulList({})

    await listBitbakeSetupRegistryConfigurations(
      executablePath,
      createTempParent()
    )

    const call = mockedRunRawProcessTerminal.mock.calls[0]
    const outputPath = call[1][2]

    expect(call).toStrictEqual([
      executablePath,
      ['list', '--write-json', outputPath],
      path.dirname(outputPath),
      'BitBake: Inspect bitbake-setup registry',
      true
    ])
  })

  it('passes a custom registry as an invocation-only setting', async () => {
    mockSuccessfulList({})

    await listBitbakeSetupRegistryConfigurations(
      executablePath,
      createTempParent(),
      customRegistry
    )

    const call = mockedRunRawProcessTerminal.mock.calls[0]
    const outputPath = call[1][6]

    expect(call[1]).toStrictEqual([
      '--setting',
      'default',
      'registry',
      customRegistry,
      'list',
      '--write-json',
      outputPath
    ])
  })

  it('parses the generated registry JSON file', async () => {
    mockSuccessfulList({
      'oe-nodistro-master': {
        description: 'OpenEmbedded nodistro master'
      },
      'poky-wrynose': {
        description: 'Poky Wrynose',
        expires: '2030-05-31'
      }
    })

    await expect(listBitbakeSetupRegistryConfigurations(
      executablePath,
      createTempParent()
    )).resolves.toStrictEqual([
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

  it('allows optional expires', async () => {
    mockSuccessfulList({
      'poky-wrynose': {
        description: 'Poky Wrynose'
      }
    })

    await expect(listBitbakeSetupRegistryConfigurations(
      executablePath,
      createTempParent()
    )).resolves.toStrictEqual([
      {
        id: 'poky-wrynose',
        description: 'Poky Wrynose',
        expires: undefined
      }
    ])
  })

  it('allows an empty registry list', async () => {
    mockSuccessfulList({})

    await expect(listBitbakeSetupRegistryConfigurations(
      executablePath,
      createTempParent()
    )).resolves.toStrictEqual([])
  })

  it('ignores unknown registry entry fields', async () => {
    mockSuccessfulList({
      'poky-wrynose': {
        description: 'Poky Wrynose',
        releases: ['5.2'],
        supported: true
      }
    })

    await expect(listBitbakeSetupRegistryConfigurations(
      executablePath,
      createTempParent()
    )).resolves.toStrictEqual([
      {
        id: 'poky-wrynose',
        description: 'Poky Wrynose',
        expires: undefined
      }
    ])
  })

  it('throws for malformed consumed registry entry fields', async () => {
    mockSuccessfulList({
      'poky-wrynose': {
        description: 42
      }
    })

    await expect(listBitbakeSetupRegistryConfigurations(
      executablePath,
      createTempParent()
    )).rejects.toThrow(
      "Malformed bitbake-setup registry list JSON from"
    )
  })

  it('throws when bitbake-setup exits nonzero', async () => {
    mockedRunRawProcessTerminal.mockResolvedValueOnce({
      exitCode: 2,
      output: 'registry failed'
    })

    await expect(listBitbakeSetupRegistryConfigurations(
      executablePath,
      createTempParent()
    )).rejects.toThrow(
      'bitbake-setup registry list failed with exit code 2'
    )
  })

  it('throws when the process cannot start', async () => {
    mockedRunRawProcessTerminal.mockRejectedValueOnce(
      new Error('spawn ENOENT')
    )

    await expect(listBitbakeSetupRegistryConfigurations(
      '/missing/bitbake-setup',
      createTempParent()
    )).rejects.toThrow(
      'Failed to start bitbake-setup registry list: spawn ENOENT'
    )
  })

  it('throws when the generated output file cannot be read', async () => {
    mockedRunRawProcessTerminal.mockResolvedValueOnce({
      exitCode: 0,
      output: ''
    })

    await expect(listBitbakeSetupRegistryConfigurations(
      executablePath,
      createTempParent()
    )).rejects.toThrow(
      'Failed to read bitbake-setup registry list output from'
    )
  })

  it('throws when the generated output file contains malformed JSON', async () => {
    mockedRunRawProcessTerminal.mockImplementationOnce(
      async (_executablePath, argv) => {
        await writeOutput(argv, '{broken')

        return {
          exitCode: 0,
          output: ''
        }
      }
    )

    await expect(listBitbakeSetupRegistryConfigurations(
      executablePath,
      createTempParent()
    )).rejects.toThrow(
      'Failed to parse bitbake-setup registry list JSON from'
    )
  })

  it('creates its temporary directory beneath the supplied parent', async () => {
    mockSuccessfulList({})

    const tempParent = createTempParent()

    await listBitbakeSetupRegistryConfigurations(
      executablePath,
      tempParent
    )

    const cwd = mockedRunRawProcessTerminal.mock.calls[0][2]

    expect(path.dirname(cwd)).toBe(tempParent)
  })

  it('cleans up its temporary directory after success', async () => {
    mockSuccessfulList({})

    await listBitbakeSetupRegistryConfigurations(
      executablePath,
      createTempParent()
    )

    const cwd = mockedRunRawProcessTerminal.mock.calls[0][2]

    expect(fs.existsSync(cwd)).toBe(false)
  })

  it('cleans up its temporary directory after ordinary failure', async () => {
    mockedRunRawProcessTerminal.mockRejectedValueOnce(
      new Error('spawn ENOENT')
    )

    await expect(listBitbakeSetupRegistryConfigurations(
      executablePath,
      createTempParent()
    )).rejects.toThrow(
      'Failed to start bitbake-setup registry list: spawn ENOENT'
    )

    const cwd = mockedRunRawProcessTerminal.mock.calls[0][2]

    expect(fs.existsSync(cwd)).toBe(false)
  })

  it('throws when temporary directory creation fails', async () => {
    jest.spyOn(fs.promises, 'mkdtemp').mockRejectedValueOnce(
      new Error('permission denied')
    )

    await expect(listBitbakeSetupRegistryConfigurations(
      executablePath,
      createTempParent()
    )).rejects.toThrow(
      'Failed to create temporary directory for bitbake-setup registry list: permission denied'
    )
    expect(mockedRunRawProcessTerminal).not.toHaveBeenCalled()
  })

  it('throws when temporary directory cleanup fails', async () => {
    mockSuccessfulList({})
    jest.spyOn(fs.promises, 'rm').mockRejectedValueOnce(
      new Error('cleanup denied')
    )

    await expect(listBitbakeSetupRegistryConfigurations(
      executablePath,
      createTempParent()
    )).rejects.toThrow(
      'Failed to clean up temporary directory for bitbake-setup registry list: cleanup denied'
    )
  })
})
