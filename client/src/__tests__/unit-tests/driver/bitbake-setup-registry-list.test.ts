/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2026 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import fs from 'fs'
import path from 'path'
import { type IPty } from 'node-pty'

import { type BitBakeSetupDriver } from '../../../driver/BitBakeSetupDriver'
import {
  listBitbakeSetupRegistryConfigurations
} from '../../../utils/BitbakeSetupRegistryList'
import * as ProcessUtils from '../../../utils/ProcessUtils'

describe('BitbakeSetupRegistryList', () => {
  const processMock = {} as IPty

  function createDriver (
    payload: unknown
  ): Pick<BitBakeSetupDriver, 'runBitbakeSetupCommand'> {
    return {
      runBitbakeSetupCommand: jest.fn(async (args) => {
        const outputPath = args.at(-1)

        if (outputPath === undefined) {
          throw new Error('Expected --write-json output path')
        }

        await fs.promises.writeFile(outputPath, JSON.stringify(payload))
        return processMock
      })
    }
  }

  beforeEach(() => {
    jest.restoreAllMocks()
    jest.spyOn(ProcessUtils, 'finishProcessExecution').mockImplementation(
      async (process) => {
        await process

        return {
          pid: 1,
          output: [Buffer.alloc(0), Buffer.alloc(0)],
          stdout: Buffer.alloc(0),
          stderr: Buffer.alloc(0),
          status: 0,
          signal: null
        }
      }
    )
  })

  it('lists registry configurations through the bitbake-setup driver', async () => {
    const driver = createDriver({
      'oe-nodistro-master': {
        description: 'OpenEmbedded nodistro master',
        ignored: true
      },
      'poky-wrynose': {
        description: 'Poky Wrynose',
        expires: '2030-05-31'
      }
    })

    await expect(
      listBitbakeSetupRegistryConfigurations(driver)
    ).resolves.toStrictEqual([
      {
        id: 'oe-nodistro-master',
        description: 'OpenEmbedded nodistro master'
      },
      {
        id: 'poky-wrynose',
        description: 'Poky Wrynose',
        expires: '2030-05-31'
      }
    ])

    const call = jest.mocked(driver.runBitbakeSetupCommand).mock.calls[0]
    const args = call[0]
    const outputPath = args.at(-1)

    expect(outputPath).toBeDefined()
    expect(args.slice(0, 4)).toStrictEqual([
      '--setting',
      'default',
      'top-dir-prefix',
      path.dirname(outputPath!)
    ])
    expect(args.slice(4, 6)).toStrictEqual([
      'list',
      '--write-json'
    ])
    expect(call.slice(1)).toStrictEqual([
      'BitBake: Inspect bitbake-setup registry',
      true
    ])
    expect(fs.existsSync(path.dirname(outputPath!))).toBe(false)
  })

  it('passes a custom registry as an invocation-only setting', async () => {
    const driver = createDriver({})

    await listBitbakeSetupRegistryConfigurations(
      driver,
      'git://example/registry;protocol=https;branch=main;rev=main'
    )

    const args = jest.mocked(driver.runBitbakeSetupCommand).mock.calls[0][0]

    expect(args.slice(4, 8)).toStrictEqual([
      '--setting',
      'default',
      'registry',
      'git://example/registry;protocol=https;branch=main;rev=main'
    ])
    expect(args.slice(8, 10)).toStrictEqual([
      'list',
      '--write-json'
    ])
  })

  it('rejects malformed consumed fields', async () => {
    const driver = createDriver({
      'poky-wrynose': {
        description: 42
      }
    })

    await expect(
      listBitbakeSetupRegistryConfigurations(driver)
    ).rejects.toThrow(
      "bitbake-setup registry configuration 'poky-wrynose'.description must be a string"
    )
  })

  it('rejects a non-zero bitbake-setup exit status', async () => {
    const driver = createDriver({})

    jest.spyOn(ProcessUtils, 'finishProcessExecution').mockResolvedValueOnce({
      pid: 1,
      output: [Buffer.alloc(0), Buffer.alloc(0)],
      stdout: Buffer.alloc(0),
      stderr: Buffer.alloc(0),
      status: 2,
      signal: null
    })

    await expect(
      listBitbakeSetupRegistryConfigurations(driver)
    ).rejects.toThrow(
      'bitbake-setup registry list failed with exit code 2'
    )
  })

  it('cleans the temporary directory when execution fails', async () => {
    let tempRoot: string | undefined

    jest.spyOn(ProcessUtils, 'finishProcessExecution').mockImplementationOnce(
      async (process) => {
        await process
        throw new Error('Expected process execution to fail')
      }
    )

    const driver: Pick<BitBakeSetupDriver, 'runBitbakeSetupCommand'> = {
      runBitbakeSetupCommand: jest.fn(async (args) => {
        const outputPath = args.at(-1)

        if (outputPath === undefined) {
          throw new Error('Expected --write-json output path')
        }

        tempRoot = path.dirname(outputPath)
        throw new Error('spawn failed')
      })
    }

    await expect(
      listBitbakeSetupRegistryConfigurations(driver)
    ).rejects.toThrow('spawn failed')

    expect(tempRoot).toBeDefined()
    expect(fs.existsSync(tempRoot!)).toBe(false)
  })
})
