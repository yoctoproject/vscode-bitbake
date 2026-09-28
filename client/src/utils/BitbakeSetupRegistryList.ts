/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2026 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import fs from 'fs'
import path from 'path'

import { runRawProcessTerminal } from '../ui/BitbakeTerminal'

export interface BitbakeSetupRegistryConfiguration {
  id: string
  description: string
  expires?: string
}

export async function listBitbakeSetupRegistryConfigurations (
  executablePath: string,
  temporaryParentPath: string,
  registry?: string
): Promise<BitbakeSetupRegistryConfiguration[]> {
  let tempRoot: string

  try {
    tempRoot = await fs.promises.mkdtemp(
      path.join(temporaryParentPath, 'bitbake-setup-list-')
    )
  } catch (error) {
    throw new Error(
      `Failed to create temporary directory for bitbake-setup registry list: ${errorToString(error)}`
    )
  }

  try {
    const configurations = await runList(
      executablePath,
      tempRoot,
      registry
    )

    await cleanupTemporaryDirectory(tempRoot)
    return configurations
  } catch (error) {
    await cleanupTemporaryDirectory(tempRoot)
    throw error
  }
}

async function cleanupTemporaryDirectory (
  tempRoot: string
): Promise<void> {
  try {
    await fs.promises.rm(tempRoot, {
      recursive: true,
      force: true
    })
  } catch (error) {
    throw new Error(
      `Failed to clean up temporary directory for bitbake-setup registry list: ${errorToString(error)}`
    )
  }
}

async function runList (
  executablePath: string,
  tempRoot: string,
  registry?: string
): Promise<BitbakeSetupRegistryConfiguration[]> {
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
    runResult = await runRawProcessTerminal(
      executablePath,
      argv,
      tempRoot,
      'BitBake: Inspect bitbake-setup registry',
      true
    )
  } catch (error) {
    throw new Error(
      `Failed to start bitbake-setup registry list: ${errorToString(error)}`
    )
  }

  if (runResult.exitCode !== 0) {
    throw new Error(
      `bitbake-setup registry list failed with exit code ${runResult.exitCode}`
    )
  }

  let text: string

  try {
    text = await fs.promises.readFile(outputPath, 'utf8')
  } catch (error) {
    throw new Error(
      `Failed to read bitbake-setup registry list output from ${outputPath}: ${errorToString(error)}`
    )
  }

  let payload: unknown

  try {
    payload = JSON.parse(text)
  } catch (error) {
    throw new Error(
      `Failed to parse bitbake-setup registry list JSON from ${outputPath}: ${errorToString(error)}`
    )
  }

  try {
    return parseBitbakeSetupRegistryList(payload)
  } catch (error) {
    throw new Error(
      `Malformed bitbake-setup registry list JSON from ${outputPath}: ${errorToString(error)}`
    )
  }
}

function parseBitbakeSetupRegistryList (
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
