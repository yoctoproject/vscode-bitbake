/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2026 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import fs from 'fs'
import path from 'path'
import { parse as parseJson5 } from 'json5'

import { runRawProcessTerminal } from '../ui/BitbakeTerminal'
import {
  parseBitbakeSetupConfigurations,
  type BitbakeSetupSelectableConfiguration
} from './BitbakeSetupConfiguration'

export const WRYNOSE_CONFIGURATIONS_DIAGNOSTIC_MARKER =
  'ERROR: Unable to choose from bitbake configurations in non-interactive mode:'

const WRYNOSE_PROBE_TOP_DIR_NAME = 'workspace'

export async function probeBitbakeSetupWrynoseConfigurations (
  executablePath: string,
  temporaryParentPath: string,
  registryConfiguration: string,
  registry?: string
): Promise<BitbakeSetupSelectableConfiguration[]> {
  let tempRoot: string

  try {
    tempRoot = await fs.promises.mkdtemp(
      path.join(temporaryParentPath, 'bitbake-setup-wrynose-')
    )
  } catch (error) {
    throw new Error(
      `Failed to create temporary Wrynose probe directory: ${formatError(error)}`
    )
  }

  let configurations: BitbakeSetupSelectableConfiguration[] | undefined
  let probeError: unknown
  let cleanupError: unknown

  try {
    configurations = await runProbe(
      executablePath,
      tempRoot,
      registryConfiguration,
      registry
    )
  } catch (error) {
    probeError = error
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
    throw new Error(
      `Failed to remove temporary Wrynose probe directory '${tempRoot}': ${formatError(cleanupError)}`
    )
  }

  if (probeError !== undefined) {
    if (probeError instanceof Error) {
      throw probeError
    }

    throw new Error(formatError(probeError))
  }

  if (configurations === undefined) {
    throw new Error(
      'Wrynose diagnostic compatibility probe did not produce configurations'
    )
  }

  return configurations
}

async function runProbe (
  executablePath: string,
  tempRoot: string,
  registryConfiguration: string,
  registry?: string
): Promise<BitbakeSetupSelectableConfiguration[]> {
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
    runResult = await runRawProcessTerminal(
      executablePath,
      argv,
      tempRoot,
      'BitBake: Inspect bitbake-setup configuration',
      true
    )
  } catch (error) {
    throw new Error(
      `Failed to start Wrynose diagnostic compatibility probe: ${formatError(error)}`
    )
  }

  if (runResult.exitCode === 0) {
    throw new Error(
      'Wrynose diagnostic compatibility probe unexpectedly succeeded'
    )
  }

  if (runResult.exitCode !== 1) {
    throw new Error(
      `Wrynose diagnostic compatibility probe exited with unexpected status ${runResult.exitCode}`
    )
  }

  if (!runResult.output.includes(WRYNOSE_CONFIGURATIONS_DIAGNOSTIC_MARKER)) {
    throw new Error(
      'Wrynose diagnostic compatibility probe output did not contain the expected configurations marker'
    )
  }

  const payload = extractWrynoseDiagnosticObject(runResult.output)

  if (payload === undefined) {
    throw new Error(
      'Wrynose diagnostic compatibility probe output did not contain a balanced configurations object'
    )
  }

  let parsedPayload: unknown

  try {
    parsedPayload = parseJson5(payload)
  } catch (error) {
    throw new Error(
      `Failed to parse Wrynose configurations diagnostic as JSON5: ${formatError(error)}`
    )
  }

  return parseFlattenedWrynoseConfigurations(parsedPayload)
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

  return parseBitbakeSetupConfigurations({
    'bitbake-setup': {
      configurations: entries.map(([, value]) => value)
    }
  })
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

function formatError (error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  return String(error)
}
