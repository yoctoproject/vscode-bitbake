/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { EventEmitter } from 'events'
import { PassThrough } from 'stream'
import { spawn } from 'child_process'

import { runBitbakeSetup } from '../../../utils/BitbakeSetupRunner'

jest.mock('child_process', () => ({
  spawn: jest.fn()
}))

describe('BitbakeSetupRunner Tests', () => {
  type MockSpawnChild = EventEmitter & { stdout: PassThrough, stderr: PassThrough }

  const mockedSpawn = spawn as jest.MockedFunction<typeof spawn>
  const spawnedChildren: MockSpawnChild[] = []

  beforeEach(() => {
    jest.clearAllMocks()
    spawnedChildren.length = 0
    mockedSpawn.mockImplementation(() => {
      const child = createMockSpawnChild()
      spawnedChildren.push(child)
      return child as never
    })
  })

  function createMockSpawnChild (): MockSpawnChild {
    const child = new EventEmitter() as MockSpawnChild
    child.stdout = new PassThrough()
    child.stderr = new PassThrough()
    return child
  }

  async function waitForSpawnCall (): Promise<void> {
    for (let attempt = 0; attempt < 100; attempt++) {
      if (mockedSpawn.mock.calls.length > 0) {
        return
      }

      await new Promise((resolve) => setImmediate(resolve))
    }

    throw new Error('Timed out waiting for bitbake-setup spawn call')
  }

  it('passes the executable path and argv exactly with shell disabled', async () => {
    const runPromise = runBitbakeSetup('/opt/poky/bin/bitbake-setup', ['--config', 'qemuarm'])

    await waitForSpawnCall()
    spawnedChildren[0].emit('close', 0)
    await runPromise

    expect(mockedSpawn).toHaveBeenCalledWith('/opt/poky/bin/bitbake-setup', ['--config', 'qemuarm'], {
      cwd: undefined,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe']
    })
  })

  it('passes cwd when provided', async () => {
    const runPromise = runBitbakeSetup('/usr/bin/bitbake-setup', ['init'], '/work/project')

    await waitForSpawnCall()
    spawnedChildren[0].emit('close', 0)
    await runPromise

    expect(mockedSpawn.mock.calls[0][2]).toEqual(expect.objectContaining({
      cwd: '/work/project',
      shell: false
    }))
  })

  it('does not invent cwd when omitted', async () => {
    const runPromise = runBitbakeSetup('/usr/bin/bitbake-setup', ['init'])

    await waitForSpawnCall()
    spawnedChildren[0].emit('close', 0)
    await runPromise

    expect(mockedSpawn.mock.calls[0][2]).toEqual(expect.objectContaining({
      cwd: undefined,
      shell: false
    }))
  })

  it('accumulates stdout and stderr from multiple chunks separately', async () => {
    const runPromise = runBitbakeSetup('/usr/bin/bitbake-setup', ['init'])

    await waitForSpawnCall()
    spawnedChildren[0].stdout.write('out-1')
    spawnedChildren[0].stdout.write(Buffer.from('-out-2'))
    spawnedChildren[0].stderr.write('err-1')
    spawnedChildren[0].stderr.write(Buffer.from('-err-2'))
    spawnedChildren[0].emit('close', 0)

    await expect(runPromise).resolves.toStrictEqual({
      exitCode: 0,
      stdout: 'out-1-out-2',
      stderr: 'err-1-err-2'
    })
  })

  it('resolves normally for non-zero exit codes', async () => {
    const runPromise = runBitbakeSetup('/usr/bin/bitbake-setup', ['init'])

    await waitForSpawnCall()
    spawnedChildren[0].stderr.write('failed')
    spawnedChildren[0].emit('close', 2)

    await expect(runPromise).resolves.toStrictEqual({
      exitCode: 2,
      stdout: '',
      stderr: 'failed'
    })
  })

  it('rejects when spawning the process fails', async () => {
    const runPromise = runBitbakeSetup('/missing/bitbake-setup', ['init'])
    const spawnError = Object.assign(new Error('spawn ENOENT'), { code: 'ENOENT' })

    await waitForSpawnCall()
    spawnedChildren[0].emit('error', spawnError)

    await expect(runPromise).rejects.toBe(spawnError)
  })
})
