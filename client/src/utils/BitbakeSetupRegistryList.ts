/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2026 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import fs from 'fs'
import os from 'os'
import path from 'path'

import { type BitBakeSetupDriver } from '../driver/BitBakeSetupDriver'
import { finishProcessExecution } from './ProcessUtils'

export interface BitbakeSetupRegistryConfiguration {
  id: string
  description: string
  expires?: string
}

export async function listBitbakeSetupRegistryConfigurations (
  driver: Pick<BitBakeSetupDriver, 'runBitbakeSetupCommand'>,
  registry?: string
): Promise<BitbakeSetupRegistryConfiguration[]> {
  const tempRoot = await fs.promises.mkdtemp(
    path.join(os.tmpdir(), 'bitbake-setup-list-')
  )

  try {
    const outputPath = path.join(tempRoot, 'configurations.json')
    const args = [
      '--setting',
      'default',
      'top-dir-prefix',
      tempRoot
    ]

    if (registry !== undefined && registry !== '') {
      args.push(
        '--setting',
        'default',
        'registry',
        registry
      )
    }

    args.push('list', '--write-json', outputPath)

    const process = driver.runBitbakeSetupCommand(
      args,
      'BitBake: Inspect bitbake-setup registry',
      true
    )
    const result = await finishProcessExecution(process)

    if (result.status !== 0) {
      throw new Error(
        `bitbake-setup registry list failed with exit code ${result.status}`
      )
    }

    const payload: unknown = JSON.parse(
      await fs.promises.readFile(outputPath, 'utf8')
    )

    return parseBitbakeSetupRegistryList(payload)
  } finally {
    await fs.promises.rm(tempRoot, {
      recursive: true,
      force: true
    })
  }
}

function parseBitbakeSetupRegistryList (
  payload: unknown
): BitbakeSetupRegistryConfiguration[] {
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('bitbake-setup registry list must be an object')
  }

  return Object.entries(payload).map(([id, value]) => {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error(`bitbake-setup registry configuration '${id}' must be an object`)
    }

    const configuration = value as Record<string, unknown>

    if (typeof configuration.description !== 'string') {
      throw new Error(`bitbake-setup registry configuration '${id}'.description must be a string`)
    }

    if (configuration.expires !== undefined && typeof configuration.expires !== 'string') {
      throw new Error(`bitbake-setup registry configuration '${id}'.expires must be a string`)
    }

    return {
      id,
      description: configuration.description,
      ...(configuration.expires !== undefined
        ? { expires: configuration.expires }
        : {})
    }
  })
}
