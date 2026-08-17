/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2026 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import fs from 'fs'
import path from 'path'

import { runBitbakeSetup } from './BitbakeSetupRunner'

export interface BitbakeSetupRegistryConfiguration {
  id: string
  description: string
  expires?: string
}

export type BitbakeSetupRegistryListFailureReason =
  'temporary-directory-failed' |
  'spawn-failed' |
  'list-failed' |
  'read-failed' |
  'malformed-json' |
  'invalid-schema' |
  'cleanup-failed'

export interface BitbakeSetupRegistryListSuccess {
  kind: 'success'
  configurations: BitbakeSetupRegistryConfiguration[]
  stdout: string
  stderr: string
}

export interface BitbakeSetupRegistryListFailure {
  kind: 'failure'
  reason: BitbakeSetupRegistryListFailureReason
  details?: string
  exitCode?: number | null
  stdout?: string
  stderr?: string
  previousResult?: BitbakeSetupRegistryListNonCleanupResult
}

type BitbakeSetupRegistryListNonCleanupResult =
  BitbakeSetupRegistryListSuccess |
  Omit<BitbakeSetupRegistryListFailure, 'reason' | 'previousResult'> & {
    reason: Exclude<
    BitbakeSetupRegistryListFailureReason,
    'cleanup-failed'
    >
  }

export type BitbakeSetupRegistryListResult =
  BitbakeSetupRegistryListSuccess |
  BitbakeSetupRegistryListFailure

export async function listBitbakeSetupRegistryConfigurations (
  executablePath: string,
  temporaryParentPath: string,
  registry?: string
): Promise<BitbakeSetupRegistryListResult> {
  let tempRoot: string

  try {
    tempRoot = await fs.promises.mkdtemp(
      path.join(temporaryParentPath, 'bitbake-setup-list-')
    )
  } catch (error) {
    return {
      kind: 'failure',
      reason: 'temporary-directory-failed',
      details: errorToString(error)
    }
  }

  let result: BitbakeSetupRegistryListNonCleanupResult | undefined
  let cleanupError: unknown

  try {
    result = await runList(
      executablePath,
      tempRoot,
      registry
    )
  } finally {
    try {
      await fs.promises.rm(tempRoot, {
        recursive: true,
        force: true
      })
    } catch (error) {
      cleanupError = error
    }
  }

  if (cleanupError !== undefined) {
    return {
      kind: 'failure',
      reason: 'cleanup-failed',
      details: errorToString(cleanupError),
      previousResult: result
    }
  }

  if (result === undefined) {
    throw new Error(
      'bitbake-setup registry list did not produce a result'
    )
  }

  return result
}

async function runList (
  executablePath: string,
  tempRoot: string,
  registry?: string
): Promise<BitbakeSetupRegistryListNonCleanupResult> {
  const outputPath = path.join(tempRoot, 'configurations.json')

  const argv = registry === undefined || registry.length === 0
    ? ['list', '--write-json', outputPath]
    : [
        '--setting',
        'default',
        'registry',
        registry,
        'list',
        '--write-json',
        outputPath
      ]

  let runResult

  try {
    runResult = await runBitbakeSetup(
      executablePath,
      argv,
      tempRoot
    )
  } catch (error) {
    return {
      kind: 'failure',
      reason: 'spawn-failed',
      details: errorToString(error)
    }
  }

  if (runResult.exitCode !== 0) {
    return {
      kind: 'failure',
      reason: 'list-failed',
      exitCode: runResult.exitCode,
      stdout: runResult.stdout,
      stderr: runResult.stderr
    }
  }

  let text: string

  try {
    text = await fs.promises.readFile(outputPath, 'utf8')
  } catch (error) {
    return {
      kind: 'failure',
      reason: 'read-failed',
      details: errorToString(error),
      exitCode: runResult.exitCode,
      stdout: runResult.stdout,
      stderr: runResult.stderr
    }
  }

  let payload: unknown

  try {
    payload = JSON.parse(text)
  } catch (error) {
    return {
      kind: 'failure',
      reason: 'malformed-json',
      details: errorToString(error),
      exitCode: runResult.exitCode,
      stdout: runResult.stdout,
      stderr: runResult.stderr
    }
  }

  let configurations: BitbakeSetupRegistryConfiguration[]

  try {
    configurations = parseBitbakeSetupRegistryList(payload)
  } catch (error) {
    return {
      kind: 'failure',
      reason: 'invalid-schema',
      details: errorToString(error),
      exitCode: runResult.exitCode,
      stdout: runResult.stdout,
      stderr: runResult.stderr
    }
  }

  return {
    kind: 'success',
    configurations,
    stdout: runResult.stdout,
    stderr: runResult.stderr
  }
}

export function parseBitbakeSetupRegistryList (
  payload: unknown
): BitbakeSetupRegistryConfiguration[] {
  const root = requireObject(payload, 'bitbake-setup registry list')

  return Object.entries(root).map(([id, value]) => {
    const configuration = requireObject(
      value,
      `bitbake-setup registry configuration '${id}'`
    )

    const description = requireString(
      configuration.description,
      `bitbake-setup registry configuration '${id}'.description`
    )

    const expires = optionalString(
      configuration.expires,
      `bitbake-setup registry configuration '${id}'.expires`
    )

    return {
      id,
      description,
      expires
    }
  })
}

function requireObject (
  value: unknown,
  location: string
): Record<string, unknown> {
  if (
    value === null ||
    typeof value !== 'object' ||
    Array.isArray(value)
  ) {
    throw new Error(`${location} must be an object`)
  }

  return value as Record<string, unknown>
}

function requireString (
  value: unknown,
  location: string
): string {
  if (typeof value !== 'string') {
    throw new Error(`${location} must be a string`)
  }

  return value
}

function optionalString (
  value: unknown,
  location: string
): string | undefined {
  if (value === undefined) {
    return undefined
  }

  return requireString(value, location)
}

function errorToString (error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  return String(error)
}
