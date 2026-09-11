/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2026 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import fs from 'fs'
import path from 'path'
import { parse as parseJson5 } from 'json5'

import { runBitbakeSetupTerminal } from '../ui/BitbakeSetupTerminal'
import {
  parseBitbakeSetupConfigurationManifest
} from './BitbakeSetupConfiguration'
import {
  getBitbakeSetupSelectableConfigurations,
  type BitbakeSetupSelectableConfiguration
} from './BitbakeSetupConfigurationSelection'

export const WRYNOSE_CONFIGURATIONS_DIAGNOSTIC_MARKER =
  'ERROR: Unable to choose from bitbake configurations in non-interactive mode:'

export type BitbakeSetupWrynoseProbeFailureReason =
  'temporary-directory-failed' |
  'spawn-failed' |
  'unexpected-zero-exit' |
  'unexpected-nonzero-exit' |
  'missing-diagnostic-marker' |
  'malformed-diagnostic-payload' |
  'invalid-diagnostic-schema' |
  'cleanup-failed'

export interface BitbakeSetupWrynoseProbeSuccess {
  kind: 'success'
  configurations: BitbakeSetupSelectableConfiguration[]
  stdout: string
  stderr: string
}

export interface BitbakeSetupWrynoseProbeFailure {
  kind: 'failure'
  reason: BitbakeSetupWrynoseProbeFailureReason
  details?: string
  exitCode?: number | null
  stdout?: string
  stderr?: string
  previousResult?: BitbakeSetupWrynoseProbeNonCleanupResult
}

type BitbakeSetupWrynoseProbeNonCleanupResult =
  BitbakeSetupWrynoseProbeSuccess |
  Omit<BitbakeSetupWrynoseProbeFailure, 'reason' | 'previousResult'> & {
    reason: Exclude<BitbakeSetupWrynoseProbeFailureReason, 'cleanup-failed'>
  }

export type BitbakeSetupWrynoseProbeResult =
  BitbakeSetupWrynoseProbeSuccess |
  BitbakeSetupWrynoseProbeFailure

const WRYNOSE_PROBE_TOP_DIR_NAME = 'workspace'

export async function probeBitbakeSetupWrynoseConfigurations (
  executablePath: string,
  temporaryParentPath: string,
  registryConfiguration: string,
  registry?: string
): Promise<BitbakeSetupWrynoseProbeResult> {
  let tempRoot: string

  try {
    tempRoot = await fs.promises.mkdtemp(
      path.join(temporaryParentPath, 'bitbake-setup-wrynose-')
    )
  } catch (error) {
    return {
      kind: 'failure',
      reason: 'temporary-directory-failed',
      details: errorToString(error)
    }
  }

  let result: BitbakeSetupWrynoseProbeNonCleanupResult | undefined
  let cleanupError: unknown

  try {
    result = await runProbe(
      executablePath,
      tempRoot,
      registryConfiguration,
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
      'Wrynose diagnostic compatibility probe did not produce a result'
    )
  }

  return result
}

async function runProbe (
  executablePath: string,
  tempRoot: string,
  registryConfiguration: string,
  registry?: string
): Promise<BitbakeSetupWrynoseProbeNonCleanupResult> {
  const argv = [
    '--setting',
    'default',
    'top-dir-prefix',
    tempRoot,
    '--setting',
    'default',
    'top-dir-name',
    WRYNOSE_PROBE_TOP_DIR_NAME
  ]

  if (registry !== undefined && registry.length > 0) {
    argv.push(
      '--setting',
      'default',
      'registry',
      registry
    )
  }

  argv.push(
    'init',
    '--non-interactive',
    registryConfiguration
  )

  let runResult

  try {
    runResult = await runBitbakeSetupTerminal(
      executablePath,
      argv,
      tempRoot,
      'BitBake: Inspect bitbake-setup configuration',
      true
    )
  } catch (error) {
    return {
      kind: 'failure',
      reason: 'spawn-failed',
      details: errorToString(error)
    }
  }

  if (runResult.exitCode === 0) {
    return {
      kind: 'failure',
      reason: 'unexpected-zero-exit',
      exitCode: runResult.exitCode,
      stdout: runResult.output,
      stderr: ''
    }
  }

  if (runResult.exitCode !== 1) {
    return {
      kind: 'failure',
      reason: 'unexpected-nonzero-exit',
      exitCode: runResult.exitCode,
      stdout: runResult.output,
      stderr: ''
    }
  }

  if (!runResult.output.includes(WRYNOSE_CONFIGURATIONS_DIAGNOSTIC_MARKER)) {
    return {
      kind: 'failure',
      reason: 'missing-diagnostic-marker',
      exitCode: runResult.exitCode,
      stdout: runResult.output,
      stderr: ''
    }
  }

  const payload = extractWrynoseDiagnosticObject(runResult.output)

  if (payload === undefined) {
    return {
      kind: 'failure',
      reason: 'malformed-diagnostic-payload',
      exitCode: runResult.exitCode,
      stdout: runResult.output,
      stderr: ''
    }
  }

  let parsedPayload: unknown

  try {
    parsedPayload = parseJson5(payload)
  } catch (error) {
    return {
      kind: 'failure',
      reason: 'malformed-diagnostic-payload',
      details: errorToString(error),
      exitCode: runResult.exitCode,
      stdout: runResult.output,
      stderr: ''
    }
  }

  let configurations: BitbakeSetupSelectableConfiguration[]

  try {
    configurations = parseFlattenedWrynoseConfigurations(parsedPayload)
  } catch (error) {
    return {
      kind: 'failure',
      reason: 'invalid-diagnostic-schema',
      details: errorToString(error),
      exitCode: runResult.exitCode,
      stdout: runResult.output,
      stderr: ''
    }
  }

  return {
    kind: 'success',
    configurations,
    stdout: runResult.output,
    stderr: ''
  }
}

function parseFlattenedWrynoseConfigurations (
  payload: unknown
): BitbakeSetupSelectableConfiguration[] {
  if (!isPlainObject(payload)) {
    throw new Error('Wrynose diagnostic payload must be an object')
  }

  const entries = Object.entries(payload)

  if (entries.length === 0) {
    throw new Error('Wrynose diagnostic payload must not be empty')
  }

  if (!isSupportedWrynoseDiagnosticValue(payload)) {
    throw new Error('Wrynose diagnostic payload contains an unsupported value type')
  }

  const configurations = entries.map(([id, value]) => {
    if (!isPlainObject(value)) {
      throw new Error(
        `Wrynose diagnostic configuration '${id}' must be an object`
      )
    }

    if (value.name !== id) {
      throw new Error(
        `Wrynose diagnostic configuration '${id}' must contain matching name`
      )
    }

    return value
  })

  const manifest = parseBitbakeSetupConfigurationManifest({
    'bitbake-setup': {
      configurations
    }
  })

  return getBitbakeSetupSelectableConfigurations(manifest)
}

function extractWrynoseDiagnosticObject (
  stdout: string
): string | undefined {
  const markerIndex = stdout.indexOf(
    WRYNOSE_CONFIGURATIONS_DIAGNOSTIC_MARKER
  )

  if (markerIndex < 0) {
    return undefined
  }

  let payloadStart =
    markerIndex + WRYNOSE_CONFIGURATIONS_DIAGNOSTIC_MARKER.length

  while (
    payloadStart < stdout.length &&
    /\s/.test(stdout[payloadStart])
  ) {
    payloadStart++
  }

  if (stdout[payloadStart] !== '{') {
    return undefined
  }

  let depth = 0
  let quote: '\'' | '"' | undefined
  let escaped = false

  for (let index = payloadStart; index < stdout.length; index++) {
    const character = stdout[index]

    if (quote !== undefined) {
      if (escaped) {
        escaped = false
      } else if (character === '\\') {
        escaped = true
      } else if (character === quote) {
        quote = undefined
      }

      continue
    }

    if (character === '\'' || character === '"') {
      quote = character
    } else if (character === '{') {
      depth++
    } else if (character === '}') {
      depth--

      if (depth === 0) {
        return stdout.slice(payloadStart, index + 1)
      }

      if (depth < 0) {
        return undefined
      }
    }
  }

  return undefined
}

function isSupportedWrynoseDiagnosticValue (
  value: unknown
): boolean {
  if (typeof value === 'string') {
    return true
  }

  if (Array.isArray(value)) {
    return value.every(isSupportedWrynoseDiagnosticValue)
  }

  if (isPlainObject(value)) {
    return Object.values(value).every(isSupportedWrynoseDiagnosticValue)
  }

  return false
}

function isPlainObject (
  value: unknown
): value is Record<string, unknown> {
  if (
    value === null ||
    typeof value !== 'object' ||
    Array.isArray(value)
  ) {
    return false
  }

  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function errorToString (error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  return String(error)
}
