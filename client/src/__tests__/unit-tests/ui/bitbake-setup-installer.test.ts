/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import fs from 'fs'
import os from 'os'
import path from 'path'
import { EventEmitter } from 'events'
import { PassThrough } from 'stream'
import * as vscode from 'vscode'
import { spawn } from 'child_process'

import { installBitbakeSetup } from '../../../ui/BitbakeSetupInstaller'
import { BITBAKE_SETUP_VERSION } from '../../../ui/BitbakeSetupReference'
import { logger } from '../../../lib/src/utils/OutputLogger'

jest.mock('vscode')
jest.mock('child_process', () => ({
  spawn: jest.fn()
}))

describe('BitbakeSetupInstaller', () => {
  type MockSpawnChild = EventEmitter & { stdout: PassThrough, stderr: PassThrough }
  type Deferred<T> = {
    promise: Promise<T>
    resolve: (value: T | PromiseLike<T>) => void
  }

  const tempRoots: string[] = []
  const spawnedChildren: MockSpawnChild[] = []
  const spawnWaiters = new Map<number, () => void>()
  const mockedSpawn = spawn as jest.MockedFunction<typeof spawn>
  const originalLoggerLevel = logger.level

  beforeEach(() => {
    jest.clearAllMocks()
    spawnedChildren.length = 0
    spawnWaiters.clear()
    logger.level = 'none'
    mockedSpawn.mockImplementation(() => {
      const child = createMockSpawnChild()
      spawnedChildren.push(child)

      const callCount = mockedSpawn.mock.calls.length
      const waiter = spawnWaiters.get(callCount)
      if (waiter !== undefined) {
        spawnWaiters.delete(callCount)
        waiter()
      }

      return child as never
    })
  })

  afterEach(() => {
    logger.level = originalLoggerLevel

    while (tempRoots.length > 0) {
      const tempRoot = tempRoots.pop()
      if (tempRoot !== undefined) {
        fs.rmSync(tempRoot, { recursive: true, force: true })
      }
    }

    jest.restoreAllMocks()
  })

  function createTempRoot (): string {
    const tempRoot = path.join(
      os.tmpdir(),
      `bitbake-setup-installer-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`
    )
    fs.mkdirSync(tempRoot, { recursive: true })
    tempRoots.push(tempRoot)
    return tempRoot
  }

  function createExecutableFile (filePath: string): void {
    fs.mkdirSync(path.dirname(filePath), { recursive: true })
    fs.writeFileSync(filePath, '#!/bin/sh\nexit 0\n')
    fs.chmodSync(filePath, 0o755)
  }

  function createNonExecutableFile (filePath: string): void {
    fs.mkdirSync(path.dirname(filePath), { recursive: true })
    fs.writeFileSync(filePath, '#!/bin/sh\nexit 0\n')
    fs.chmodSync(filePath, 0o644)
  }

  function createManagedVenv (globalStorageRoot: string, executable = true): void {
    createExecutableFile(managedPythonPath(globalStorageRoot))
    if (executable) {
      createExecutableFile(managedExecutablePath(globalStorageRoot))
    } else {
      createNonExecutableFile(managedExecutablePath(globalStorageRoot))
    }
  }

  function createExtensionContext (globalStorageRoot: string, update = jest.fn().mockResolvedValue(undefined)): vscode.ExtensionContext {
    const get = jest.fn().mockReturnValue(undefined)
    jest.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue({
      get,
      update
    } as unknown as vscode.WorkspaceConfiguration)

    return {
      globalStorageUri: { fsPath: globalStorageRoot },
      subscriptions: [],
      workspaceState: {
        get: jest.fn(),
        update: jest.fn()
      }
    } as unknown as vscode.ExtensionContext
  }

  function createMockSpawnChild (): MockSpawnChild {
    const child = new EventEmitter() as MockSpawnChild
    child.stdout = new PassThrough()
    child.stderr = new PassThrough()
    return child
  }

  async function waitForSpawnCall (count = 1): Promise<void> {
    if (mockedSpawn.mock.calls.length >= count) {
      return
    }

    await new Promise<void>((resolve) => {
      spawnWaiters.set(count, resolve)
    })
  }

  function closeProcess (index: number, exitCode: number, stdout = '', stderr = ''): void {
    if (stdout.length > 0) {
      spawnedChildren[index].stdout.write(stdout)
    }
    if (stderr.length > 0) {
      spawnedChildren[index].stderr.write(stderr)
    }
    spawnedChildren[index].emit('close', exitCode)
  }

  async function completeVenvCreation (globalStorageRoot: string, index = 0): Promise<void> {
    await waitForSpawnCall(index + 1)
    expect(mockedSpawn.mock.calls[index][1][3]).toBe(managedVenvPath(globalStorageRoot))
    createExecutableFile(managedPythonPath(globalStorageRoot))
    closeProcess(index, 0)
  }

  async function completeFreshInstallation (globalStorageRoot: string): Promise<void> {
    await completeVenvCreation(globalStorageRoot, 0)

    await waitForSpawnCall(2)
    createExecutableFile(managedExecutablePath(globalStorageRoot))
    closeProcess(1, 0)

    await waitForSpawnCall(3)
    closeProcess(2, 0, `${BITBAKE_SETUP_VERSION}\n`)

    await waitForSpawnCall(4)
    closeProcess(3, 0)
  }

  async function markExistingVenvStale (): Promise<void> {
    await waitForSpawnCall(1)
    closeProcess(0, 0, '2.18.0\n')
  }

  function managedVenvPath (globalStorageRoot: string): string {
    return path.join(globalStorageRoot, 'bitbake-setup')
  }

  function managedExecutablePath (globalStorageRoot: string): string {
    return path.join(managedVenvPath(globalStorageRoot), 'bin', 'bitbake-setup')
  }

  function managedPythonPath (globalStorageRoot: string): string {
    return path.join(managedVenvPath(globalStorageRoot), 'bin', 'python')
  }

  function managedMarkerPath (globalStorageRoot: string): string {
    return path.join(managedVenvPath(globalStorageRoot), 'existing-marker.txt')
  }

  function backupPaths (globalStorageRoot: string): string[] {
    return fs.readdirSync(globalStorageRoot)
      .filter((entry) => entry.startsWith('bitbake-setup-backup-'))
      .map((entry) => path.join(globalStorageRoot, entry))
  }

  function expectAllSpawnsWithoutShell (): void {
    for (const spawnCall of mockedSpawn.mock.calls) {
      expect(spawnCall[2]).toEqual(expect.objectContaining({ shell: false }))
    }
  }

  function createDeferred<T> (): Deferred<T> {
    let resolve!: (value: T | PromiseLike<T>) => void
    const promise = new Promise<T>((promiseResolve) => {
      resolve = promiseResolve
    })

    return { promise, resolve }
  }

  it('fresh install creates the virtualenv directly at the final managed path and writes the setting after validation', async () => {
    const globalStorageRoot = createTempRoot()
    const context = createExtensionContext(globalStorageRoot)

    const installPromise = installBitbakeSetup(context)
    await completeFreshInstallation(globalStorageRoot)
    const result = await installPromise

    expect(result).toBe(managedExecutablePath(globalStorageRoot))
    expect(mockedSpawn.mock.calls[0]).toEqual([
      'python3',
      ['-m', 'venv', '--clear', managedVenvPath(globalStorageRoot)],
      expect.objectContaining({ shell: false })
    ])
    expect(fs.existsSync(managedExecutablePath(globalStorageRoot))).toBe(true)
    expect((vscode.workspace.getConfiguration('bitbake') as unknown as { update: jest.Mock }).update).toHaveBeenCalledWith(
      'bitbakeSetupPath',
      managedExecutablePath(globalStorageRoot),
      vscode.ConfigurationTarget.Global
    )
    expect(vscode.window.showErrorMessage).not.toHaveBeenCalled()
  })

  it('pip invocation uses the final managed virtualenv Python and the exact pinned package', async () => {
    const globalStorageRoot = createTempRoot()
    const context = createExtensionContext(globalStorageRoot)

    const installPromise = installBitbakeSetup(context)
    await completeFreshInstallation(globalStorageRoot)
    await installPromise

    expect(mockedSpawn.mock.calls[1]).toEqual([
      managedPythonPath(globalStorageRoot),
      ['-m', 'pip', 'install', `bitbake-setup==${BITBAKE_SETUP_VERSION}`],
      expect.objectContaining({ shell: false })
    ])
  })

  it('validates the exact installed package version through the managed virtualenv Python', async () => {
    const globalStorageRoot = createTempRoot()
    const context = createExtensionContext(globalStorageRoot)

    const installPromise = installBitbakeSetup(context)
    await completeFreshInstallation(globalStorageRoot)
    await installPromise

    expect(mockedSpawn.mock.calls[2]).toEqual([
      managedPythonPath(globalStorageRoot),
      ['-c', "import importlib.metadata; print(importlib.metadata.version('bitbake-setup'))"],
      expect.objectContaining({ shell: false })
    ])
  })

  it('validates the actual installed bitbake-setup launcher with help', async () => {
    const globalStorageRoot = createTempRoot()
    const context = createExtensionContext(globalStorageRoot)

    const installPromise = installBitbakeSetup(context)
    await completeFreshInstallation(globalStorageRoot)
    await installPromise

    expect(mockedSpawn.mock.calls[3]).toEqual([
      managedExecutablePath(globalStorageRoot),
      ['--help'],
      expect.objectContaining({ shell: false })
    ])
  })

  it('reuses a valid managed virtualenv only after the launcher probe succeeds', async () => {
    const globalStorageRoot = createTempRoot()
    createManagedVenv(globalStorageRoot)
    const update = jest.fn().mockResolvedValue(undefined)
    const context = createExtensionContext(globalStorageRoot, update)

    const installPromise = installBitbakeSetup(context)
    await waitForSpawnCall(1)
    closeProcess(0, 0, `${BITBAKE_SETUP_VERSION}\n`)
    expect(update).not.toHaveBeenCalled()

    await waitForSpawnCall(2)
    expect(update).not.toHaveBeenCalled()
    closeProcess(1, 0)
    const result = await installPromise

    expect(result).toBe(managedExecutablePath(globalStorageRoot))
    expect(mockedSpawn).toHaveBeenCalledTimes(2)
    expect(mockedSpawn.mock.calls[0][0]).toBe(managedPythonPath(globalStorageRoot))
    expect(mockedSpawn.mock.calls[1]).toEqual([
      managedExecutablePath(globalStorageRoot),
      ['--help'],
      expect.objectContaining({ shell: false })
    ])
    expect(update).toHaveBeenCalledWith(
      'bitbakeSetupPath',
      managedExecutablePath(globalStorageRoot),
      vscode.ConfigurationTarget.Global
    )
  })

  it('treats launcher spawn failure as stale for an otherwise valid managed virtualenv', async () => {
    const globalStorageRoot = createTempRoot()
    createManagedVenv(globalStorageRoot)
    fs.writeFileSync(managedMarkerPath(globalStorageRoot), 'stale venv')
    const context = createExtensionContext(globalStorageRoot)

    const installPromise = installBitbakeSetup(context)
    await waitForSpawnCall(1)
    closeProcess(0, 0, `${BITBAKE_SETUP_VERSION}\n`)

    await waitForSpawnCall(2)
    spawnedChildren[1].emit('error', Object.assign(new Error('spawn bitbake-setup ENOENT'), { code: 'ENOENT' }))

    await completeVenvCreation(globalStorageRoot, 2)

    await waitForSpawnCall(4)
    createExecutableFile(managedExecutablePath(globalStorageRoot))
    closeProcess(3, 0)

    await waitForSpawnCall(5)
    closeProcess(4, 0, `${BITBAKE_SETUP_VERSION}\n`)

    await waitForSpawnCall(6)
    closeProcess(5, 0)
    const result = await installPromise

    expect(result).toBe(managedExecutablePath(globalStorageRoot))
    expect(fs.existsSync(managedMarkerPath(globalStorageRoot))).toBe(false)
    expect(mockedSpawn.mock.calls[1]).toEqual([
      managedExecutablePath(globalStorageRoot),
      ['--help'],
      expect.objectContaining({ shell: false })
    ])
    expect(mockedSpawn.mock.calls[2][0]).toBe('python3')
  })

  it('treats launcher nonzero exit as stale for an otherwise valid managed virtualenv', async () => {
    const globalStorageRoot = createTempRoot()
    createManagedVenv(globalStorageRoot)
    fs.writeFileSync(managedMarkerPath(globalStorageRoot), 'stale venv')
    const context = createExtensionContext(globalStorageRoot)

    const installPromise = installBitbakeSetup(context)
    await waitForSpawnCall(1)
    closeProcess(0, 0, `${BITBAKE_SETUP_VERSION}\n`)

    await waitForSpawnCall(2)
    closeProcess(1, 1, '', 'broken launcher')

    await completeVenvCreation(globalStorageRoot, 2)

    await waitForSpawnCall(4)
    createExecutableFile(managedExecutablePath(globalStorageRoot))
    closeProcess(3, 0)

    await waitForSpawnCall(5)
    closeProcess(4, 0, `${BITBAKE_SETUP_VERSION}\n`)

    await waitForSpawnCall(6)
    closeProcess(5, 0)
    const result = await installPromise

    expect(result).toBe(managedExecutablePath(globalStorageRoot))
    expect(fs.existsSync(managedMarkerPath(globalStorageRoot))).toBe(false)
    expect(mockedSpawn.mock.calls[1][0]).toBe(managedExecutablePath(globalStorageRoot))
    expect(mockedSpawn.mock.calls[2][0]).toBe('python3')
  })

  it('replaces a stale managed virtualenv at the final managed path and removes the backup on success', async () => {
    const globalStorageRoot = createTempRoot()
    createManagedVenv(globalStorageRoot)
    fs.writeFileSync(managedMarkerPath(globalStorageRoot), 'stale venv')
    const context = createExtensionContext(globalStorageRoot)

    const installPromise = installBitbakeSetup(context)
    await markExistingVenvStale()
    await completeVenvCreation(globalStorageRoot, 1)

    await waitForSpawnCall(3)
    createExecutableFile(managedExecutablePath(globalStorageRoot))
    closeProcess(2, 0)

    await waitForSpawnCall(4)
    closeProcess(3, 0, `${BITBAKE_SETUP_VERSION}\n`)

    await waitForSpawnCall(5)
    closeProcess(4, 0)
    const result = await installPromise

    expect(result).toBe(managedExecutablePath(globalStorageRoot))
    expect(fs.existsSync(managedMarkerPath(globalStorageRoot))).toBe(false)
    expect(backupPaths(globalStorageRoot)).toEqual([])
    expect(mockedSpawn.mock.calls[1]).toEqual([
      'python3',
      ['-m', 'venv', '--clear', managedVenvPath(globalStorageRoot)],
      expect.objectContaining({ shell: false })
    ])
    expect(mockedSpawn.mock.calls[2][0]).toBe(managedPythonPath(globalStorageRoot))
    expect(mockedSpawn.mock.calls[4][0]).toBe(managedExecutablePath(globalStorageRoot))
  })

  it('keeps a committed stale replacement when obsolete backup cleanup fails', async () => {
    const globalStorageRoot = createTempRoot()
    createManagedVenv(globalStorageRoot)
    fs.writeFileSync(managedMarkerPath(globalStorageRoot), 'previous venv')
    const update = jest.fn().mockResolvedValue(undefined)
    const context = createExtensionContext(globalStorageRoot, update)
    const loggerError = jest.spyOn(logger, 'error')
    const originalRm = fs.promises.rm.bind(fs.promises)
    jest.spyOn(fs.promises, 'rm').mockImplementation(async (directoryPath, options) => {
      if (typeof directoryPath === 'string' && directoryPath.startsWith(path.join(globalStorageRoot, 'bitbake-setup-backup-'))) {
        throw new Error('backup cleanup denied')
      }

      return await originalRm(directoryPath, options)
    })

    const installPromise = installBitbakeSetup(context)
    await markExistingVenvStale()
    await completeVenvCreation(globalStorageRoot, 1)

    await waitForSpawnCall(3)
    createExecutableFile(managedExecutablePath(globalStorageRoot))
    closeProcess(2, 0)

    await waitForSpawnCall(4)
    closeProcess(3, 0, `${BITBAKE_SETUP_VERSION}\n`)

    await waitForSpawnCall(5)
    closeProcess(4, 0)
    const result = await installPromise

    expect(result).toBe(managedExecutablePath(globalStorageRoot))
    expect(fs.existsSync(managedExecutablePath(globalStorageRoot))).toBe(true)
    expect(fs.existsSync(managedMarkerPath(globalStorageRoot))).toBe(false)
    expect(backupPaths(globalStorageRoot)).toHaveLength(1)
    expect(update).toHaveBeenCalledWith(
      'bitbakeSetupPath',
      managedExecutablePath(globalStorageRoot),
      vscode.ConfigurationTarget.Global
    )
    expect(loggerError).toHaveBeenCalledWith(expect.stringContaining('Failed to remove previous managed bitbake-setup virtualenv backup'))
    expect(loggerError).toHaveBeenCalledWith(expect.stringContaining('backup cleanup denied'))
    expect(vscode.window.showErrorMessage).not.toHaveBeenCalled()
  })

  it('cleans partial state when virtualenv creation fails on fresh install', async () => {
    const globalStorageRoot = createTempRoot()
    const context = createExtensionContext(globalStorageRoot)
    const showErrorMessage = jest.spyOn(vscode.window, 'showErrorMessage').mockResolvedValue(undefined)

    const installPromise = installBitbakeSetup(context)
    await waitForSpawnCall(1)
    fs.mkdirSync(managedVenvPath(globalStorageRoot), { recursive: true })
    fs.writeFileSync(path.join(managedVenvPath(globalStorageRoot), 'partial.txt'), 'partial')
    closeProcess(0, 1, '', 'venv failed')
    const result = await installPromise

    expect(result).toBeUndefined()
    expect(fs.existsSync(managedVenvPath(globalStorageRoot))).toBe(false)
    expect((vscode.workspace.getConfiguration('bitbake') as unknown as { update: jest.Mock }).update).not.toHaveBeenCalled()
    expect(showErrorMessage).toHaveBeenCalledWith(
      'Failed to create the managed bitbake-setup Python virtual environment.',
      'Open Settings'
    )
  })

  it('removes fresh partial state before waiting for the failure notification to resolve', async () => {
    const globalStorageRoot = createTempRoot()
    const update = jest.fn().mockResolvedValue(undefined)
    const context = createExtensionContext(globalStorageRoot, update)
    const showErrorMessage = jest.spyOn(vscode.window, 'showErrorMessage')
    const deferredMessage = createDeferred<undefined>()
    const messageShown = createDeferred<undefined>()
    showErrorMessage.mockImplementation(() => {
      messageShown.resolve(undefined)
      return deferredMessage.promise as never
    })

    const installPromise = installBitbakeSetup(context)
    await waitForSpawnCall(1)
    fs.mkdirSync(managedVenvPath(globalStorageRoot), { recursive: true })
    fs.writeFileSync(path.join(managedVenvPath(globalStorageRoot), 'partial.txt'), 'partial')
    closeProcess(0, 1, '', 'venv failed')

    await messageShown.promise

    expect(showErrorMessage).toHaveBeenCalledTimes(1)
    expect(fs.existsSync(managedVenvPath(globalStorageRoot))).toBe(false)
    expect(update).not.toHaveBeenCalled()

    let settled = false
    installPromise.then(() => { settled = true }).catch(() => { settled = true })
    await Promise.resolve()
    expect(settled).toBe(false)

    deferredMessage.resolve(undefined)
    const result = await installPromise

    expect(result).toBeUndefined()
    expect(showErrorMessage).toHaveBeenCalledWith(
      'Failed to create the managed bitbake-setup Python virtual environment.',
      'Open Settings'
    )
    expect(showErrorMessage).toHaveBeenCalledTimes(1)
  })

  it('cleans partial state when pip install fails on fresh install', async () => {
    const globalStorageRoot = createTempRoot()
    const context = createExtensionContext(globalStorageRoot)
    const showErrorMessage = jest.spyOn(vscode.window, 'showErrorMessage').mockResolvedValue(undefined)

    const installPromise = installBitbakeSetup(context)
    await completeVenvCreation(globalStorageRoot)

    await waitForSpawnCall(2)
    fs.writeFileSync(path.join(managedVenvPath(globalStorageRoot), 'partial.txt'), 'partial')
    closeProcess(1, 1, '', 'pip failed')
    const result = await installPromise

    expect(result).toBeUndefined()
    expect(fs.existsSync(managedVenvPath(globalStorageRoot))).toBe(false)
    expect((vscode.workspace.getConfiguration('bitbake') as unknown as { update: jest.Mock }).update).not.toHaveBeenCalled()
    expect(showErrorMessage).toHaveBeenCalledWith(
      `Failed to install bitbake-setup==${BITBAKE_SETUP_VERSION} into the managed Python virtual environment.`,
      'Open Settings'
    )
  })

  it('cleans partial state and leaves the setting untouched when fresh launcher validation fails', async () => {
    const globalStorageRoot = createTempRoot()
    const update = jest.fn().mockResolvedValue(undefined)
    const context = createExtensionContext(globalStorageRoot, update)
    const showErrorMessage = jest.spyOn(vscode.window, 'showErrorMessage').mockResolvedValue(undefined)

    const installPromise = installBitbakeSetup(context)
    await completeVenvCreation(globalStorageRoot)

    await waitForSpawnCall(2)
    createExecutableFile(managedExecutablePath(globalStorageRoot))
    closeProcess(1, 0)

    await waitForSpawnCall(3)
    closeProcess(2, 0, `${BITBAKE_SETUP_VERSION}\n`)

    await waitForSpawnCall(4)
    closeProcess(3, 1, '', 'launcher failed')
    const result = await installPromise

    expect(result).toBeUndefined()
    expect(fs.existsSync(managedVenvPath(globalStorageRoot))).toBe(false)
    expect(update).not.toHaveBeenCalled()
    expect(showErrorMessage).toHaveBeenCalledWith(
      'The managed bitbake-setup launcher failed validation.',
      'Open Settings'
    )
  })

  it('restores a stale managed virtualenv when replacement virtualenv creation fails', async () => {
    const globalStorageRoot = createTempRoot()
    createManagedVenv(globalStorageRoot)
    fs.writeFileSync(managedMarkerPath(globalStorageRoot), 'previous venv')
    const context = createExtensionContext(globalStorageRoot)

    const installPromise = installBitbakeSetup(context)
    await markExistingVenvStale()

    await waitForSpawnCall(2)
    fs.mkdirSync(managedVenvPath(globalStorageRoot), { recursive: true })
    fs.writeFileSync(path.join(managedVenvPath(globalStorageRoot), 'partial.txt'), 'partial')
    closeProcess(1, 1, '', 'venv failed')
    const result = await installPromise

    expect(result).toBeUndefined()
    expect(fs.readFileSync(managedMarkerPath(globalStorageRoot), 'utf8')).toBe('previous venv')
    expect((vscode.workspace.getConfiguration('bitbake') as unknown as { update: jest.Mock }).update).not.toHaveBeenCalled()
  })

  it('restores stale backup before waiting for the failure notification to resolve', async () => {
    const globalStorageRoot = createTempRoot()
    createManagedVenv(globalStorageRoot)
    fs.writeFileSync(managedMarkerPath(globalStorageRoot), 'previous venv')
    const update = jest.fn().mockResolvedValue(undefined)
    const context = createExtensionContext(globalStorageRoot, update)
    const showErrorMessage = jest.spyOn(vscode.window, 'showErrorMessage')
    const deferredMessage = createDeferred<undefined>()
    const messageShown = createDeferred<undefined>()
    showErrorMessage.mockImplementation(() => {
      messageShown.resolve(undefined)
      return deferredMessage.promise as never
    })

    const installPromise = installBitbakeSetup(context)
    await markExistingVenvStale()

    await waitForSpawnCall(2)
    fs.mkdirSync(managedVenvPath(globalStorageRoot), { recursive: true })
    fs.writeFileSync(path.join(managedVenvPath(globalStorageRoot), 'partial.txt'), 'partial')
    closeProcess(1, 1, '', 'venv failed')

    await messageShown.promise

    expect(showErrorMessage).toHaveBeenCalledTimes(1)
    expect(fs.readFileSync(managedMarkerPath(globalStorageRoot), 'utf8')).toBe('previous venv')
    expect(backupPaths(globalStorageRoot)).toEqual([])
    expect(update).not.toHaveBeenCalled()

    let settled = false
    installPromise.then(() => { settled = true }).catch(() => { settled = true })
    await Promise.resolve()
    expect(settled).toBe(false)

    deferredMessage.resolve(undefined)
    const result = await installPromise

    expect(result).toBeUndefined()
    expect(showErrorMessage).toHaveBeenCalledWith(
      'Failed to create the managed bitbake-setup Python virtual environment.',
      'Open Settings'
    )
    expect(showErrorMessage).toHaveBeenCalledTimes(1)
  })

  it('surfaces rollback failure distinctly and preserves backup evidence when restore cannot remove the partial venv', async () => {
    const globalStorageRoot = createTempRoot()
    createManagedVenv(globalStorageRoot)
    fs.writeFileSync(managedMarkerPath(globalStorageRoot), 'previous venv')
    const update = jest.fn().mockResolvedValue(undefined)
    const context = createExtensionContext(globalStorageRoot, update)
    const loggerError = jest.spyOn(logger, 'error')
    const originalRm = fs.promises.rm.bind(fs.promises)
    let managedRemovalAttempts = 0
    jest.spyOn(fs.promises, 'rm').mockImplementation(async (directoryPath, options) => {
      if (directoryPath === managedVenvPath(globalStorageRoot)) {
        managedRemovalAttempts++
        throw new Error('partial removal denied')
      }

      return await originalRm(directoryPath, options)
    })

    const installPromise = installBitbakeSetup(context)
    await markExistingVenvStale()

    await waitForSpawnCall(2)
    fs.mkdirSync(managedVenvPath(globalStorageRoot), { recursive: true })
    fs.writeFileSync(path.join(managedVenvPath(globalStorageRoot), 'partial.txt'), 'partial')
    closeProcess(1, 1, '', 'venv failed')
    const result = await installPromise
    const [backupPath] = backupPaths(globalStorageRoot)

    expect(result).toBeUndefined()
    expect(update).not.toHaveBeenCalled()
    expect(managedRemovalAttempts).toBe(1)
    expect(fs.existsSync(path.join(managedVenvPath(globalStorageRoot), 'partial.txt'))).toBe(true)
    expect(backupPath).toBeDefined()
    expect(fs.readFileSync(path.join(backupPath, 'existing-marker.txt'), 'utf8')).toBe('previous venv')
    expect(loggerError).toHaveBeenCalledWith(expect.stringContaining('Failed to restore previous managed bitbake-setup virtualenv'))
    expect(loggerError).toHaveBeenCalledWith(expect.stringContaining('partial removal denied'))
    expect(loggerError).toHaveBeenCalledWith(expect.stringContaining('bitbake-setup installation failed'))
  })

  it('restores a stale managed virtualenv when replacement pip install fails', async () => {
    const globalStorageRoot = createTempRoot()
    createManagedVenv(globalStorageRoot)
    fs.writeFileSync(managedMarkerPath(globalStorageRoot), 'previous venv')
    const context = createExtensionContext(globalStorageRoot)

    const installPromise = installBitbakeSetup(context)
    await markExistingVenvStale()
    await completeVenvCreation(globalStorageRoot, 1)

    await waitForSpawnCall(3)
    fs.writeFileSync(path.join(managedVenvPath(globalStorageRoot), 'partial.txt'), 'partial')
    closeProcess(2, 1, '', 'pip failed')
    const result = await installPromise

    expect(result).toBeUndefined()
    expect(fs.readFileSync(managedMarkerPath(globalStorageRoot), 'utf8')).toBe('previous venv')
    expect((vscode.workspace.getConfiguration('bitbake') as unknown as { update: jest.Mock }).update).not.toHaveBeenCalled()
  })

  it('restores a stale managed virtualenv when replacement executable validation fails', async () => {
    const globalStorageRoot = createTempRoot()
    createManagedVenv(globalStorageRoot)
    fs.writeFileSync(managedMarkerPath(globalStorageRoot), 'previous venv')
    const context = createExtensionContext(globalStorageRoot)

    const installPromise = installBitbakeSetup(context)
    await markExistingVenvStale()
    await completeVenvCreation(globalStorageRoot, 1)

    await waitForSpawnCall(3)
    createNonExecutableFile(managedExecutablePath(globalStorageRoot))
    closeProcess(2, 0)
    const result = await installPromise

    expect(result).toBeUndefined()
    expect(fs.readFileSync(managedMarkerPath(globalStorageRoot), 'utf8')).toBe('previous venv')
    expect((vscode.workspace.getConfiguration('bitbake') as unknown as { update: jest.Mock }).update).not.toHaveBeenCalled()
  })

  it('restores a stale managed virtualenv when replacement version validation fails', async () => {
    const globalStorageRoot = createTempRoot()
    createManagedVenv(globalStorageRoot)
    fs.writeFileSync(managedMarkerPath(globalStorageRoot), 'previous venv')
    const context = createExtensionContext(globalStorageRoot)

    const installPromise = installBitbakeSetup(context)
    await markExistingVenvStale()
    await completeVenvCreation(globalStorageRoot, 1)

    await waitForSpawnCall(3)
    createExecutableFile(managedExecutablePath(globalStorageRoot))
    closeProcess(2, 0)

    await waitForSpawnCall(4)
    closeProcess(3, 0, '2.18.0\n')
    const result = await installPromise

    expect(result).toBeUndefined()
    expect(fs.readFileSync(managedMarkerPath(globalStorageRoot), 'utf8')).toBe('previous venv')
    expect((vscode.workspace.getConfiguration('bitbake') as unknown as { update: jest.Mock }).update).not.toHaveBeenCalled()
  })

  it('restores a stale managed virtualenv when replacement launcher validation fails', async () => {
    const globalStorageRoot = createTempRoot()
    createManagedVenv(globalStorageRoot)
    fs.writeFileSync(managedMarkerPath(globalStorageRoot), 'previous venv')
    const update = jest.fn().mockResolvedValue(undefined)
    const context = createExtensionContext(globalStorageRoot, update)
    const showErrorMessage = jest.spyOn(vscode.window, 'showErrorMessage').mockResolvedValue(undefined)

    const installPromise = installBitbakeSetup(context)
    await markExistingVenvStale()
    await completeVenvCreation(globalStorageRoot, 1)

    await waitForSpawnCall(3)
    createExecutableFile(managedExecutablePath(globalStorageRoot))
    closeProcess(2, 0)

    await waitForSpawnCall(4)
    closeProcess(3, 0, `${BITBAKE_SETUP_VERSION}\n`)
    expect(update).not.toHaveBeenCalled()

    await waitForSpawnCall(5)
    closeProcess(4, 1, '', 'launcher failed')
    const result = await installPromise

    expect(result).toBeUndefined()
    expect(fs.readFileSync(managedMarkerPath(globalStorageRoot), 'utf8')).toBe('previous venv')
    expect(update).not.toHaveBeenCalled()
    expect(showErrorMessage).toHaveBeenCalledWith(
      'The managed bitbake-setup launcher failed validation.',
      'Open Settings'
    )
  })

  it('updates the setting only after final validation succeeds', async () => {
    const globalStorageRoot = createTempRoot()
    const update = jest.fn().mockResolvedValue(undefined)
    const context = createExtensionContext(globalStorageRoot, update)

    const installPromise = installBitbakeSetup(context)
    await completeVenvCreation(globalStorageRoot)

    await waitForSpawnCall(2)
    createExecutableFile(managedExecutablePath(globalStorageRoot))
    closeProcess(1, 0)
    expect(update).not.toHaveBeenCalled()

    await waitForSpawnCall(3)
    expect(update).not.toHaveBeenCalled()
    closeProcess(2, 0, `${BITBAKE_SETUP_VERSION}\n`)

    await waitForSpawnCall(4)
    expect(update).not.toHaveBeenCalled()
    closeProcess(3, 0)
    await installPromise

    expect(update).toHaveBeenCalledTimes(1)
  })

  it('does not use a shell for any spawned process', async () => {
    const globalStorageRoot = createTempRoot()
    const context = createExtensionContext(globalStorageRoot)

    const installPromise = installBitbakeSetup(context)
    await completeFreshInstallation(globalStorageRoot)
    await installPromise

    expectAllSpawnsWithoutShell()
  })

  it('shares concurrent installation calls for the same global storage path', async () => {
    const globalStorageRoot = createTempRoot()
    const update = jest.fn().mockResolvedValue(undefined)
    const context = createExtensionContext(globalStorageRoot, update)

    const firstInstallPromise = installBitbakeSetup(context)
    const secondInstallPromise = installBitbakeSetup(context)
    await completeFreshInstallation(globalStorageRoot)
    const [firstResult, secondResult] = await Promise.all([firstInstallPromise, secondInstallPromise])

    expect(firstResult).toBe(managedExecutablePath(globalStorageRoot))
    expect(secondResult).toBe(managedExecutablePath(globalStorageRoot))
    expect(update).toHaveBeenCalledTimes(1)
    expect(mockedSpawn).toHaveBeenCalledTimes(4)
  })

  it('handles a missing python3 executable gracefully and leaves the setting untouched', async () => {
    const globalStorageRoot = createTempRoot()
    const context = createExtensionContext(globalStorageRoot)
    const showErrorMessage = jest.spyOn(vscode.window, 'showErrorMessage').mockResolvedValue(undefined)

    const installPromise = installBitbakeSetup(context)
    await waitForSpawnCall(1)
    spawnedChildren[0].emit('error', Object.assign(new Error('spawn python3 ENOENT'), { code: 'ENOENT' }))
    const result = await installPromise

    expect(result).toBeUndefined()
    expect(fs.existsSync(managedVenvPath(globalStorageRoot))).toBe(false)
    expect((vscode.workspace.getConfiguration('bitbake') as unknown as { update: jest.Mock }).update).not.toHaveBeenCalled()
    expect(showErrorMessage).toHaveBeenCalledWith(
      'bitbake-setup installation failed.',
      'Open Settings'
    )
  })

  it('opens bitbake-setup settings when selected from an installer failure message', async () => {
    const globalStorageRoot = createTempRoot()
    const context = createExtensionContext(globalStorageRoot)
    jest.spyOn(vscode.window, 'showErrorMessage').mockResolvedValue('Open Settings' as never)

    const installPromise = installBitbakeSetup(context)
    await waitForSpawnCall(1)
    closeProcess(0, 1)
    const result = await installPromise

    expect(result).toBeUndefined()
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
      'workbench.action.openSettings',
      'bitbake.bitbakeSetupPath'
    )
  })

  it('does not open settings when an installer failure message is dismissed', async () => {
    const globalStorageRoot = createTempRoot()
    const context = createExtensionContext(globalStorageRoot)
    jest.spyOn(vscode.window, 'showErrorMessage').mockResolvedValue(undefined)

    const installPromise = installBitbakeSetup(context)
    await waitForSpawnCall(1)
    closeProcess(0, 1)
    const result = await installPromise

    expect(result).toBeUndefined()
    expect(vscode.commands.executeCommand).not.toHaveBeenCalled()
  })
})
