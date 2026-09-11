/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import fs from 'fs'
import path from 'path'

const BITBAKE_SETUP_EXECUTABLE = 'bitbake-setup'

export type BitbakeSetupExecutableDiscoveryResult =
  | {
    kind: 'resolved-configured'
    executablePath: string
  }
  | {
    kind: 'resolved-path'
    executablePath: string
  }
  | {
    kind: 'configured-path-invalid'
    configuredPath: string
  }
  | {
    kind: 'not-found'
  }

export function discoverBitbakeSetupExecutable (configuredPath: string | undefined, pathValue: string | undefined): BitbakeSetupExecutableDiscoveryResult {
  if (configuredPath !== undefined && configuredPath !== '') {
    return isExecutableRegularFile(configuredPath)
      ? {
          kind: 'resolved-configured',
          executablePath: configuredPath
        }
      : {
          kind: 'configured-path-invalid',
          configuredPath
        }
  }

  return discoverBitbakeSetupExecutableFromPath(pathValue)
}

function discoverBitbakeSetupExecutableFromPath (pathValue: string | undefined): BitbakeSetupExecutableDiscoveryResult {
  if (pathValue === undefined || pathValue === '') {
    return { kind: 'not-found' }
  }

  for (const pathEntry of pathValue.split(path.delimiter)) {
    const executablePath = path.join(pathEntry, BITBAKE_SETUP_EXECUTABLE)
    if (isExecutableRegularFile(executablePath)) {
      return {
        kind: 'resolved-path',
        executablePath
      }
    }
  }

  return { kind: 'not-found' }
}

function isExecutableRegularFile (filePath: string): boolean {
  try {
    const stats = fs.statSync(filePath)
    if (!stats.isFile()) {
      return false
    }

    fs.accessSync(filePath, fs.constants.X_OK)
    return true
  } catch {
    return false
  }
}
