/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2026 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import path from 'path'

export interface BitbakeSetupInitArguments {
  directory: string
  registry?: string
  registryConfiguration: string
  configuration: string
  fragments: string[]
  initializeVsCode?: boolean
}

export function buildBitbakeSetupInitArguments (
  input: BitbakeSetupInitArguments
): string[] {
  const topDirectoryName = path.basename(input.directory)

  if (topDirectoryName.length === 0) {
    throw new Error(
      'The bitbake-setup initialization directory must not be a filesystem root.'
    )
  }

  const argv: string[] = [
    '--setting',
    'default',
    'top-dir-prefix',
    path.dirname(input.directory),
    '--setting',
    'default',
    'top-dir-name',
    topDirectoryName
  ]

  if (input.registry !== undefined && input.registry.length > 0) {
    argv.push(
      '--setting',
      'default',
      'registry',
      input.registry
    )
  }

  argv.push(
    'init',
    '--non-interactive'
  )

  if (input.initializeVsCode === true) {
    argv.push('--init-vscode')
  } else if (input.initializeVsCode === false) {
    argv.push('--no-init-vscode')
  }

  argv.push(
    input.registryConfiguration,
    input.configuration,
    ...input.fragments
  )

  return argv
}
