/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import path from 'path'
import { BitBakeSetupDriver } from '../../../driver/BitBakeSetupDriver'
import { type ProcessFrontend } from '../../../utils/ProcessFrontend'
import * as ProcessUtils from '../../../utils/ProcessUtils'
import { createProcessMock } from '../../utils/processMock'

jest.mock('vscode')

describe('BitBakeSetupDriver', () => {
  let originalEnv: NodeJS.ProcessEnv
  let frontend: ProcessFrontend
  let driver: BitBakeSetupDriver

  beforeEach(() => {
    originalEnv = process.env
    process.env = { ...originalEnv, PATH: '/host/bin', SHELL: '/bin/sh' }
    frontend = { runProcess: jest.fn(async spawn => await spawn(undefined)) }
    driver = new BitBakeSetupDriver(frontend)
  })

  afterEach(() => {
    process.env = originalEnv
    jest.restoreAllMocks()
  })

  it('expands and sanitizes the additional search path setting', async () => {
    driver.loadSettings(
      { bitbakeSetupPath: '${workspaceFolder}/setup$dir' },
      '/workspace'
    )

    const processMock = createProcessMock()
    const spawn = jest.spyOn(ProcessUtils.pty, 'spawn').mockReturnValue(processMock.child)

    await driver.runBitbakeSetupCommand([], 'Setup')

    expect(spawn).toHaveBeenCalledWith('/bin/sh', [
      '-c',
      'exec bitbake-setup "$@"',
      'bitbake-setup'
    ], {
      env: {
        ...process.env,
        PATH: ['/workspace/setupdir', '/host/bin'].join(path.delimiter)
      }
    })
  })

  it('uses the host PATH unchanged when no additional path is configured', async () => {
    driver.loadSettings({})

    const processMock = createProcessMock()
    const spawn = jest.spyOn(ProcessUtils.pty, 'spawn').mockReturnValue(processMock.child)

    await driver.runBitbakeSetupCommand(['--help'], 'Setup', true)

    expect(frontend.runProcess).toHaveBeenCalledWith(expect.any(Function), 'exec bitbake-setup "$@"', {
      name: 'Setup',
      background: true
    })
    expect(spawn).toHaveBeenCalledWith('/bin/sh', [
      '-c',
      'exec bitbake-setup "$@"',
      'bitbake-setup',
      '--help'
    ], {
      env: process.env
    })
  })

  it('passes arguments as shell positional parameters', async () => {
    const processMock = createProcessMock()
    const spawn = jest.spyOn(ProcessUtils.pty, 'spawn').mockReturnValue(processMock.child)
    const args = ['init', '/path with spaces', '$(touch unexpected); $HOME', "quote'\\\""]

    await driver.runBitbakeSetupCommand(args, 'Setup')

    expect(spawn).toHaveBeenCalledWith('/bin/sh', [
      '-c',
      'exec bitbake-setup "$@"',
      'bitbake-setup',
      ...args
    ], {
      env: process.env
    })
  })

  it('propagates frontend errors to the caller', async () => {
    jest.mocked(frontend.runProcess).mockRejectedValue(new Error('spawn failed'))
    await expect(driver.runBitbakeSetupCommand(['--help'], 'Setup')).rejects.toThrow('spawn failed')
  })
})
