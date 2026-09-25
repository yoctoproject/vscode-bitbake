/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2026 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import fs from 'fs'
import path from 'path'
import * as vscode from 'vscode'

const bitbakeSetupWorkspaceIndicators = [
  'build/init-build-env',
  'layers',
  'config',
  'bitbake.code-workspace'
]

export async function confirmBitbakeSetupInitialization (
  directory: string
): Promise<boolean> {
  const entries = await readDirectoryEntries(directory)

  if (entries === undefined || entries.length === 0) {
    return true
  }

  const existingIndicators = bitbakeSetupWorkspaceIndicators.filter(
    indicator => fs.existsSync(path.join(directory, indicator))
  )

  const message = existingIndicators.length > 0
    ? `The selected directory appears to contain an existing bitbake-setup workspace (${existingIndicators.join(', ')}). Continue without deleting existing files?`
    : 'The selected directory is not empty. bitbake-setup may create or modify files in it. Continue?'

  const selection = await vscode.window.showWarningMessage(
    message,
    { modal: true },
    'Continue'
  )

  return selection === 'Continue'
}

async function readDirectoryEntries (
  directory: string
): Promise<string[] | undefined> {
  try {
    return await fs.promises.readdir(directory)
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'ENOENT'
    ) {
      return undefined
    }

    throw error
  }
}
