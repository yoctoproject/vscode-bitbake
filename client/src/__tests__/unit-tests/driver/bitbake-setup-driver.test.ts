/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import fs from 'fs'
import os from 'os'
import path from 'path'
import { BitBakeSetupDriver } from '../../../driver/BitBakeSetupDriver'
import { type ProcessFrontend } from '../../../utils/ProcessFrontend'
import { finishProcessExecution } from '../../../utils/ProcessUtils'

jest.mock('vscode')

describe('BitBakeSetupDriver', () => {
  let root: string
  let hostPath: string
  let additionalPath: string
  let originalEnv: NodeJS.ProcessEnv
  let driver: BitBakeSetupDriver
  let frontend: ProcessFrontend

  beforeEach(() => {
    originalEnv = process.env
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'bitbake-setup-driver-'))
    hostPath = path.join(root, 'host')
    additionalPath = path.join(root, "additional path's $directory")
    fs.mkdirSync(hostPath)
    fs.mkdirSync(additionalPath)
    process.env = { ...originalEnv, PATH: hostPath, SHELL: '/bin/sh' }
    frontend = { runProcess: jest.fn(async spawn => await spawn({ columns: 100, rows: 30 })) }
    driver = new BitBakeSetupDriver(frontend)
  })

  afterEach(() => {
    process.env = originalEnv
    fs.rmSync(root, { recursive: true, force: true })
    jest.restoreAllMocks()
  })

  function executable (directory: string, output: string = 'setup'): string {
    const executablePath = path.join(directory, 'bitbake-setup')
    fs.writeFileSync(executablePath, `#!/bin/sh\nprintf '%s\\n' '${output}' "$@"\n`, { mode: 0o755 })
    return executablePath
  }

  it('finds bitbake-setup on the host PATH without configuration', async () => {
    const expected = executable(hostPath)
    expect(await driver.resolveBitbakeSetupExecutablePath()).toBe(expected)
  })

  it('finds and runs bitbake-setup in the additional directory', async () => {
    const expected = executable(additionalPath)
    driver.loadSettings({ bitbakeSetupPath: additionalPath })

    expect(await driver.resolveBitbakeSetupExecutablePath()).toBe(expected)
    const result = await finishProcessExecution(driver.runBitbakeSetupCommand(['--help'], 'Setup', true))
    expect(result.status).toBe(0)
    expect(result.stdout.toString()).toContain('setup\r\n--help')
    expect(frontend.runProcess).toHaveBeenLastCalledWith(expect.any(Function), '"bitbake-setup" "--help"', {
      name: 'Setup', background: true
    })
  })

  it('uses the same combined PATH order for lookup and execution', async () => {
    const expected = executable(hostPath, 'host')
    executable(additionalPath, 'additional')
    driver.loadSettings({ bitbakeSetupPath: additionalPath })

    expect(await driver.resolveBitbakeSetupExecutablePath()).toBe(expected)
    const result = await finishProcessExecution(driver.runBitbakeSetupCommand([], 'Setup'))
    expect(result.stdout.toString().trim()).toBe('host')
  })

  it.each([undefined, ''])('uses the additional directory when the host PATH is %s', async host => {
    if (host === undefined) {
      delete process.env.PATH
    } else {
      process.env.PATH = host
    }
    const expected = executable(additionalPath)
    driver.loadSettings({ bitbakeSetupPath: additionalPath })
    expect(await driver.resolveBitbakeSetupExecutablePath()).toBe(expected)
  })

  it('returns undefined when neither search location contains bitbake-setup', async () => {
    driver.loadSettings({ bitbakeSetupPath: additionalPath })
    expect(await driver.resolveBitbakeSetupExecutablePath()).toBeUndefined()
  })

  it('treats the setting as a directory, never an explicit executable', async () => {
    driver.loadSettings({ bitbakeSetupPath: executable(additionalPath) })
    expect(await driver.resolveBitbakeSetupExecutablePath()).toBeUndefined()
  })

  it('skips non-executable files in the search path', async () => {
    fs.chmodSync(executable(hostPath), 0o644)
    const expected = executable(additionalPath)
    driver.loadSettings({ bitbakeSetupPath: additionalPath })
    expect(await driver.resolveBitbakeSetupExecutablePath()).toBe(expected)
  })

  it('uses updated settings without retaining a resolved executable', async () => {
    executable(additionalPath)
    driver.loadSettings({ bitbakeSetupPath: additionalPath })
    expect(await driver.resolveBitbakeSetupExecutablePath()).toBeDefined()
    driver.loadSettings({})
    expect(await driver.resolveBitbakeSetupExecutablePath()).toBeUndefined()
  })

  it('passes arguments literally without shell interpretation', async () => {
    executable(hostPath)
    const args = ['init', '/path with spaces', '$(touch unexpected); $HOME', "quote'\""]
    const result = await finishProcessExecution(driver.runBitbakeSetupCommand(args, 'Setup'))

    expect(result.status).toBe(0)
    expect(result.stdout.toString()).toContain('/path with spaces')
    expect(result.stdout.toString()).toContain('$(touch unexpected); $HOME')
    expect(result.stdout.toString()).toContain('quote\'"')
    expect(frontend.runProcess).toHaveBeenLastCalledWith(expect.any(Function), expect.stringContaining('bitbake-setup'), {
      name: 'Setup', background: false
    })
  })

  it('leaves output and exit status available to ProcessUtils', async () => {
    fs.writeFileSync(path.join(hostPath, 'bitbake-setup'), '#!/bin/sh\necho diagnostic\nexit 7\n', { mode: 0o755 })
    const result = await finishProcessExecution(driver.runBitbakeSetupCommand(['--help'], 'Setup'))
    expect(result.status).toBe(7)
    expect(result.stdout.toString()).toContain('diagnostic')
  })

  it('propagates frontend errors to the caller', async () => {
    jest.mocked(frontend.runProcess).mockRejectedValue(new Error('spawn failed'))
    await expect(driver.runBitbakeSetupCommand(['--help'], 'Setup')).rejects.toThrow('spawn failed')
  })
})
