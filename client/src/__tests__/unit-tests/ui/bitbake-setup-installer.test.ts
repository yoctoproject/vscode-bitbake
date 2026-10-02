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
import { logger } from '../../../lib/src/utils/OutputLogger'

jest.mock('vscode')
jest.mock('child_process', () => ({
  spawn: jest.fn()
}))

describe('BitbakeSetupInstaller', () => {
  type MockSpawnChild = EventEmitter & { stdout: PassThrough, stderr: PassThrough }

  const bitbakeSetupVersion = '2.19.0'
  const bitbakeSetupPackage = `bitbake-setup==${bitbakeSetupVersion}`
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

  async function completeVenvCreation (globalStorageRoot: string, index: number): Promise<void> {
    await waitForSpawnCall(index + 1)
    expect(mockedSpawn.mock.calls[index]).toEqual([
      'python3',
      ['-m', 'venv', '--clear', managedVenvPath(globalStorageRoot)],
      expect.objectContaining({ shell: false })
    ])
    fs.rmSync(managedVenvPath(globalStorageRoot), { recursive: true, force: true })
    createExecutableFile(managedPythonPath(globalStorageRoot))
    closeProcess(index, 0)
  }

  async function completeSuccessfulInstall (globalStorageRoot: string, startIndex = 0): Promise<void> {
    await completeVenvCreation(globalStorageRoot, startIndex)

    await waitForSpawnCall(startIndex + 2)
    expect(mockedSpawn.mock.calls[startIndex + 1]).toEqual([
      managedPythonPath(globalStorageRoot),
      ['-m', 'pip', 'install', bitbakeSetupPackage],
      expect.objectContaining({ shell: false })
    ])
    createExecutableFile(managedExecutablePath(globalStorageRoot))
    closeProcess(startIndex + 1, 0)
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

  function expectOnlyManagedDirectory (globalStorageRoot: string): void {
    expect(fs.readdirSync(globalStorageRoot).sort()).toEqual(['bitbake-setup'])
  }

  function expectAllSpawnsWithoutShell (): void {
    for (const spawnCall of mockedSpawn.mock.calls) {
      expect(spawnCall[2]).toEqual(expect.objectContaining({ shell: false }))
    }
  }

  it('fresh install creates the virtualenv with --clear at the managed path', async () => {
    const globalStorageRoot = createTempRoot()
    const context = createExtensionContext(globalStorageRoot)

    const installPromise = installBitbakeSetup(context)
    await completeSuccessfulInstall(globalStorageRoot)
    const result = await installPromise

    expect(result).toBe(managedExecutablePath(globalStorageRoot))
    expect(mockedSpawn.mock.calls[0]).toEqual([
      'python3',
      ['-m', 'venv', '--clear', managedVenvPath(globalStorageRoot)],
      expect.objectContaining({ shell: false })
    ])
  })

  it('pip install uses the managed Python and exact pinned package', async () => {
    const globalStorageRoot = createTempRoot()
    const context = createExtensionContext(globalStorageRoot)

    const installPromise = installBitbakeSetup(context)
    await completeSuccessfulInstall(globalStorageRoot)
    await installPromise

    expect(mockedSpawn.mock.calls[1]).toEqual([
      managedPythonPath(globalStorageRoot),
      ['-m', 'pip', 'install', bitbakeSetupPackage],
      expect.objectContaining({ shell: false })
    ])
  })

  it('reuses a valid pinned managed installation', async () => {
    const globalStorageRoot = createTempRoot()
    createManagedVenv(globalStorageRoot)
    const update = jest.fn().mockResolvedValue(undefined)
    const context = createExtensionContext(globalStorageRoot, update)

    const installPromise = installBitbakeSetup(context)
    await waitForSpawnCall(1)
    expect(mockedSpawn.mock.calls[0]).toEqual([
      managedPythonPath(globalStorageRoot),
      ['-c', "import importlib.metadata; print(importlib.metadata.version('bitbake-setup'))"],
      expect.objectContaining({ shell: false })
    ])
    closeProcess(0, 0, `${bitbakeSetupVersion}\n`)
    const result = await installPromise

    expect(result).toBe(managedExecutablePath(globalStorageRoot))
    expect(mockedSpawn).toHaveBeenCalledTimes(1)
    expect(update).toHaveBeenCalledWith(
      'bitbakeSetupPath',
      managedExecutablePath(globalStorageRoot),
      vscode.ConfigurationTarget.Global
    )
  })

  it('recreates a stale managed installation when the installed version is wrong', async () => {
    const globalStorageRoot = createTempRoot()
    createManagedVenv(globalStorageRoot)
    fs.writeFileSync(managedMarkerPath(globalStorageRoot), 'stale venv')
    const context = createExtensionContext(globalStorageRoot)

    const installPromise = installBitbakeSetup(context)
    await waitForSpawnCall(1)
    closeProcess(0, 0, '2.18.0\n')
    await completeSuccessfulInstall(globalStorageRoot, 1)
    const result = await installPromise

    expect(result).toBe(managedExecutablePath(globalStorageRoot))
    expect(fs.existsSync(managedMarkerPath(globalStorageRoot))).toBe(false)
    expect(mockedSpawn.mock.calls[1][0]).toBe('python3')
    expect(mockedSpawn.mock.calls[1][1]).toEqual(['-m', 'venv', '--clear', managedVenvPath(globalStorageRoot)])
    expectOnlyManagedDirectory(globalStorageRoot)
  })

  it('recreates when the managed executable is missing', async () => {
    const globalStorageRoot = createTempRoot()
    createExecutableFile(managedPythonPath(globalStorageRoot))
    fs.writeFileSync(managedMarkerPath(globalStorageRoot), 'stale venv')
    const context = createExtensionContext(globalStorageRoot)

    const installPromise = installBitbakeSetup(context)
    await completeSuccessfulInstall(globalStorageRoot)
    const result = await installPromise

    expect(result).toBe(managedExecutablePath(globalStorageRoot))
    expect(mockedSpawn).toHaveBeenCalledTimes(2)
    expect(mockedSpawn.mock.calls[0][0]).toBe('python3')
    expect(fs.existsSync(managedMarkerPath(globalStorageRoot))).toBe(false)
    expectOnlyManagedDirectory(globalStorageRoot)
  })

  it('recreates when the managed executable is not executable', async () => {
    const globalStorageRoot = createTempRoot()
    createManagedVenv(globalStorageRoot, false)
    fs.writeFileSync(managedMarkerPath(globalStorageRoot), 'stale venv')
    const context = createExtensionContext(globalStorageRoot)

    const installPromise = installBitbakeSetup(context)
    await completeSuccessfulInstall(globalStorageRoot)
    const result = await installPromise

    expect(result).toBe(managedExecutablePath(globalStorageRoot))
    expect(mockedSpawn).toHaveBeenCalledTimes(2)
    expect(mockedSpawn.mock.calls[0][0]).toBe('python3')
    expect(fs.existsSync(managedMarkerPath(globalStorageRoot))).toBe(false)
    expectOnlyManagedDirectory(globalStorageRoot)
  })

  it('returns undefined when pip succeeds but the executable is invalid', async () => {
    const globalStorageRoot = createTempRoot()
    const update = jest.fn().mockResolvedValue(undefined)
    const context = createExtensionContext(globalStorageRoot, update)
    const showErrorMessage = jest.spyOn(vscode.window, 'showErrorMessage').mockResolvedValue(undefined)

    const installPromise = installBitbakeSetup(context)
    await completeVenvCreation(globalStorageRoot, 0)

    await waitForSpawnCall(2)
    createNonExecutableFile(managedExecutablePath(globalStorageRoot))
    closeProcess(1, 0)
    const result = await installPromise

    expect(result).toBeUndefined()
    expect(update).not.toHaveBeenCalled()
    expect(showErrorMessage).toHaveBeenCalledWith(
      'The managed Python virtual environment does not contain a valid bitbake-setup executable.',
      'Open Settings'
    )
  })

  it('returns undefined and does not update the setting when virtualenv creation fails', async () => {
    const globalStorageRoot = createTempRoot()
    const update = jest.fn().mockResolvedValue(undefined)
    const context = createExtensionContext(globalStorageRoot, update)
    const showErrorMessage = jest.spyOn(vscode.window, 'showErrorMessage').mockResolvedValue(undefined)

    const installPromise = installBitbakeSetup(context)
    await waitForSpawnCall(1)
    fs.mkdirSync(managedVenvPath(globalStorageRoot), { recursive: true })
    fs.writeFileSync(path.join(managedVenvPath(globalStorageRoot), 'partial.txt'), 'partial')
    closeProcess(0, 1, '', 'venv failed')
    const result = await installPromise

    expect(result).toBeUndefined()
    expect(fs.existsSync(path.join(managedVenvPath(globalStorageRoot), 'partial.txt'))).toBe(true)
    expect(update).not.toHaveBeenCalled()
    expect(showErrorMessage).toHaveBeenCalledWith(
      'Failed to create the managed bitbake-setup Python virtual environment.',
      'Open Settings'
    )
  })

  it('returns undefined and does not update the setting when pip install fails', async () => {
    const globalStorageRoot = createTempRoot()
    const update = jest.fn().mockResolvedValue(undefined)
    const context = createExtensionContext(globalStorageRoot, update)
    const showErrorMessage = jest.spyOn(vscode.window, 'showErrorMessage').mockResolvedValue(undefined)

    const installPromise = installBitbakeSetup(context)
    await completeVenvCreation(globalStorageRoot, 0)

    await waitForSpawnCall(2)
    fs.writeFileSync(path.join(managedVenvPath(globalStorageRoot), 'partial.txt'), 'partial')
    closeProcess(1, 1, '', 'pip failed')
    const result = await installPromise

    expect(result).toBeUndefined()
    expect(fs.existsSync(path.join(managedVenvPath(globalStorageRoot), 'partial.txt'))).toBe(true)
    expect(update).not.toHaveBeenCalled()
    expect(showErrorMessage).toHaveBeenCalledWith(
      `Failed to install ${bitbakeSetupPackage} into the managed Python virtual environment.`,
      'Open Settings'
    )
  })

  it('updates the global setting after successful install', async () => {
    const globalStorageRoot = createTempRoot()
    const update = jest.fn().mockResolvedValue(undefined)
    const context = createExtensionContext(globalStorageRoot, update)

    const installPromise = installBitbakeSetup(context)
    await completeSuccessfulInstall(globalStorageRoot)
    const result = await installPromise

    expect(result).toBe(managedExecutablePath(globalStorageRoot))
    expect(update).toHaveBeenCalledTimes(1)
    expect(update).toHaveBeenCalledWith(
      'bitbakeSetupPath',
      managedExecutablePath(globalStorageRoot),
      vscode.ConfigurationTarget.Global
    )
  })

  it('handles missing python3 without throwing to the caller', async () => {
    const globalStorageRoot = createTempRoot()
    const update = jest.fn().mockResolvedValue(undefined)
    const context = createExtensionContext(globalStorageRoot, update)
    const showErrorMessage = jest.spyOn(vscode.window, 'showErrorMessage').mockResolvedValue(undefined)

    const installPromise = installBitbakeSetup(context)
    await waitForSpawnCall(1)
    spawnedChildren[0].emit('error', Object.assign(new Error('spawn python3 ENOENT'), { code: 'ENOENT' }))
    const result = await installPromise

    expect(result).toBeUndefined()
    expect(update).not.toHaveBeenCalled()
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

  it('uses shell:false for all spawned processes', async () => {
    const globalStorageRoot = createTempRoot()
    const context = createExtensionContext(globalStorageRoot)

    const installPromise = installBitbakeSetup(context)
    await completeSuccessfulInstall(globalStorageRoot)
    await installPromise

    expectAllSpawnsWithoutShell()
  })

  it('shares concurrent installation calls for the same global storage path', async () => {
    const globalStorageRoot = createTempRoot()
    const update = jest.fn().mockResolvedValue(undefined)
    const context = createExtensionContext(globalStorageRoot, update)

    const firstInstallPromise = installBitbakeSetup(context)
    const secondInstallPromise = installBitbakeSetup(context)
    await completeSuccessfulInstall(globalStorageRoot)
    const [firstResult, secondResult] = await Promise.all([firstInstallPromise, secondInstallPromise])

    expect(firstResult).toBe(managedExecutablePath(globalStorageRoot))
    expect(secondResult).toBe(managedExecutablePath(globalStorageRoot))
    expect(update).toHaveBeenCalledTimes(1)
    expect(mockedSpawn).toHaveBeenCalledTimes(2)
  })
})
