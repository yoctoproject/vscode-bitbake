/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import fs from 'fs'
import os from 'os'
import path from 'path'
import { discoverBitbakeSetupExecutable } from '../../../utils/BitbakeSetupDiscovery'

describe('BitbakeSetupDiscovery Tests', () => {
  const tempRoots: string[] = []

  afterEach(() => {
    while (tempRoots.length > 0) {
      const tempRoot = tempRoots.pop()
      if (tempRoot !== undefined) {
        fs.rmSync(tempRoot, { recursive: true, force: true })
      }
    }
  })

  function createTempRoot (): string {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bitbake-setup-discovery-'))
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

  it('uses a valid configured executable even when PATH also contains one', () => {
    const tempRoot = createTempRoot()
    const configuredPath = path.join(tempRoot, 'configured', 'bitbake-setup')
    const pathCandidate = path.join(tempRoot, 'path', 'bin', 'bitbake-setup')

    createExecutableFile(configuredPath)
    createExecutableFile(pathCandidate)

    const result = discoverBitbakeSetupExecutable(configuredPath, path.dirname(pathCandidate))

    expect(result).toStrictEqual({
      kind: 'resolved-configured',
      executablePath: configuredPath
    })
  })

  it('reports a missing configured executable as invalid without falling back to PATH', () => {
    const tempRoot = createTempRoot()
    const missingConfiguredPath = path.join(tempRoot, 'configured', 'bitbake-setup')
    const pathCandidate = path.join(tempRoot, 'path', 'bin', 'bitbake-setup')

    createExecutableFile(pathCandidate)

    const result = discoverBitbakeSetupExecutable(missingConfiguredPath, path.dirname(pathCandidate))

    expect(result).toStrictEqual({
      kind: 'configured-path-invalid',
      configuredPath: missingConfiguredPath
    })
  })

  it('reports a configured directory as invalid', () => {
    const tempRoot = createTempRoot()
    const configuredDirectory = path.join(tempRoot, 'configured', 'bitbake-setup')

    fs.mkdirSync(configuredDirectory, { recursive: true })

    const result = discoverBitbakeSetupExecutable(configuredDirectory, undefined)

    expect(result).toStrictEqual({
      kind: 'configured-path-invalid',
      configuredPath: configuredDirectory
    })
  })

  it('reports a configured regular file without execute permission as invalid', () => {
    const tempRoot = createTempRoot()
    const configuredPath = path.join(tempRoot, 'configured', 'bitbake-setup')

    createNonExecutableFile(configuredPath)

    const result = discoverBitbakeSetupExecutable(configuredPath, undefined)

    expect(result).toStrictEqual({
      kind: 'configured-path-invalid',
      configuredPath
    })
  })

  it('returns the first valid executable in PATH order', () => {
    const tempRoot = createTempRoot()
    const firstPathEntry = path.join(tempRoot, 'first', 'bin')
    const secondPathEntry = path.join(tempRoot, 'second', 'bin')
    const firstCandidate = path.join(firstPathEntry, 'bitbake-setup')
    const secondCandidate = path.join(secondPathEntry, 'bitbake-setup')

    createExecutableFile(firstCandidate)
    createExecutableFile(secondCandidate)

    const result = discoverBitbakeSetupExecutable(undefined, [firstPathEntry, secondPathEntry].join(path.delimiter))

    expect(result).toStrictEqual({
      kind: 'resolved-path',
      executablePath: firstCandidate
    })
  })

  it('skips missing, directory, and non-executable PATH candidates', () => {
    const tempRoot = createTempRoot()
    const missingPathEntry = path.join(tempRoot, 'missing', 'bin')
    const directoryPathEntry = path.join(tempRoot, 'directory', 'bin')
    const nonExecutablePathEntry = path.join(tempRoot, 'non-executable', 'bin')
    const validPathEntry = path.join(tempRoot, 'valid', 'bin')
    const directoryCandidate = path.join(directoryPathEntry, 'bitbake-setup')
    const nonExecutableCandidate = path.join(nonExecutablePathEntry, 'bitbake-setup')
    const validCandidate = path.join(validPathEntry, 'bitbake-setup')

    fs.mkdirSync(directoryCandidate, { recursive: true })
    createNonExecutableFile(nonExecutableCandidate)
    createExecutableFile(validCandidate)

    const result = discoverBitbakeSetupExecutable(undefined, [missingPathEntry, directoryPathEntry, nonExecutablePathEntry, validPathEntry].join(path.delimiter))

    expect(result).toStrictEqual({
      kind: 'resolved-path',
      executablePath: validCandidate
    })
  })

  it('reports not found for missing or empty PATH', () => {
    expect(discoverBitbakeSetupExecutable(undefined, undefined)).toStrictEqual({ kind: 'not-found' })
    expect(discoverBitbakeSetupExecutable(undefined, '')).toStrictEqual({ kind: 'not-found' })
  })

  it('reports not found when no configured path and no PATH candidate matches', () => {
    const tempRoot = createTempRoot()
    const firstPathEntry = path.join(tempRoot, 'first', 'bin')
    const secondPathEntry = path.join(tempRoot, 'second', 'bin')

    fs.mkdirSync(firstPathEntry, { recursive: true })
    fs.mkdirSync(secondPathEntry, { recursive: true })

    const result = discoverBitbakeSetupExecutable(undefined, [firstPathEntry, secondPathEntry].join(path.delimiter))

    expect(result).toStrictEqual({ kind: 'not-found' })
  })
})
