/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2026 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import fs from 'fs'
import os from 'os'
import path from 'path'
import * as vscode from 'vscode'

import {
  confirmBitbakeSetupInitialization
} from '../../../ui/BitbakeSetupInitializationGuard'

jest.mock('vscode')

describe('BitbakeSetupInitializationGuard', () => {
  const tempRoots: string[] = []

  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterEach(() => {
    while (tempRoots.length > 0) {
      const tempRoot = tempRoots.pop()

      if (tempRoot !== undefined) {
        fs.rmSync(tempRoot, {
          recursive: true,
          force: true
        })
      }
    }
  })

  function createTempDirectory (): string {
    const directory = fs.mkdtempSync(
      path.join(os.tmpdir(), 'bitbake-setup-initialization-guard-')
    )

    tempRoots.push(directory)
    return directory
  }

  it('proceeds without warning for an empty directory', async () => {
    const directory = createTempDirectory()

    const result = await confirmBitbakeSetupInitialization(directory)

    expect(result).toBe(true)
    expect(vscode.window.showWarningMessage).not.toHaveBeenCalled()
  })

  it('proceeds without warning when the target directory does not exist', async () => {
    const root = createTempDirectory()
    const directory = path.join(root, 'new-workspace')

    const result = await confirmBitbakeSetupInitialization(directory)

    expect(result).toBe(true)
    expect(vscode.window.showWarningMessage).not.toHaveBeenCalled()
  })

  it('requires explicit confirmation for a non-empty directory', async () => {
    const directory = createTempDirectory()
    fs.writeFileSync(
      path.join(directory, 'README.md'),
      'existing user content\n'
    )

    const showWarningMessage = jest.spyOn(
      vscode.window,
      'showWarningMessage'
    ).mockResolvedValue('Continue' as never)

    const result = await confirmBitbakeSetupInitialization(directory)

    expect(showWarningMessage).toHaveBeenCalledWith(
      'The selected directory is not empty. bitbake-setup may create or modify files in it. Continue?',
      { modal: true },
      'Continue'
    )
    expect(result).toBe(true)
    expect(fs.readFileSync(
      path.join(directory, 'README.md'),
      'utf8'
    )).toBe('existing user content\n')
  })

  it('reports existing bitbake-setup workspace indicators', async () => {
    const directory = createTempDirectory()

    fs.mkdirSync(
      path.join(directory, 'build'),
      { recursive: true }
    )
    fs.writeFileSync(
      path.join(directory, 'build', 'init-build-env'),
      ''
    )
    fs.mkdirSync(path.join(directory, 'layers'))
    fs.mkdirSync(path.join(directory, 'config'))
    fs.writeFileSync(
      path.join(directory, 'bitbake.code-workspace'),
      '{}'
    )

    const showWarningMessage = jest.spyOn(
      vscode.window,
      'showWarningMessage'
    ).mockResolvedValue('Continue' as never)

    const result = await confirmBitbakeSetupInitialization(directory)

    expect(showWarningMessage).toHaveBeenCalledWith(
      'The selected directory appears to contain an existing bitbake-setup workspace (build/init-build-env, layers, config, bitbake.code-workspace). Continue without deleting existing files?',
      { modal: true },
      'Continue'
    )
    expect(result).toBe(true)
  })

  it('cancels when the warning is dismissed', async () => {
    const directory = createTempDirectory()

    fs.writeFileSync(
      path.join(directory, 'existing.txt'),
      'keep me'
    )

    jest.spyOn(
      vscode.window,
      'showWarningMessage'
    ).mockResolvedValue(undefined)

    const result = await confirmBitbakeSetupInitialization(directory)

    expect(result).toBe(false)
    expect(fs.readFileSync(
      path.join(directory, 'existing.txt'),
      'utf8'
    )).toBe('keep me')
  })
})
