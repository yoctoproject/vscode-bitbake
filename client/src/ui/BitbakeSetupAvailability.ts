/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import path from 'path'
import * as vscode from 'vscode'
import { discoverBitbakeSetupExecutable, type BitbakeSetupExecutableDiscoveryResult } from '../utils/BitbakeSetupDiscovery'
import { getManagedBitbakeSetupExecutablePath, installBitbakeSetup } from './BitbakeSetupInstaller'

const BITBAKE_SETUP_SETTING = 'bitbakeSetupPath'
const BITBAKE_SETUP_SETTINGS_QUERY = 'bitbake.bitbakeSetupPath'

export async function resolveBitbakeSetupExecutablePath (context: vscode.ExtensionContext): Promise<string | undefined> {
  const configuredPath = getConfiguredBitbakeSetupPath()
  if (configuredPath !== undefined && configuredPath !== '' && isConfiguredManagedBitbakeSetupExecutablePath(context, configuredPath)) {
    return await installBitbakeSetup(context)
  }

  const discoveryResult = discoverBitbakeSetupExecutable(configuredPath, process.env.PATH)

  switch (discoveryResult.kind) {
    case 'resolved-configured':
    case 'resolved-path':
      return discoveryResult.executablePath
    case 'configured-path-invalid':
      await showInvalidConfiguredPathMessage(discoveryResult)
      return undefined
    case 'not-found':
      return await showBitbakeSetupNotFoundMessage(context)
  }
}

function isConfiguredManagedBitbakeSetupExecutablePath (context: vscode.ExtensionContext, configuredPath: string): boolean {
  return path.normalize(configuredPath) === path.normalize(getManagedBitbakeSetupExecutablePath(context))
}

function getConfiguredBitbakeSetupPath (): string | undefined {
  return vscode.workspace.getConfiguration('bitbake').get<string>(BITBAKE_SETUP_SETTING)
}

async function showInvalidConfiguredPathMessage (discoveryResult: Extract<BitbakeSetupExecutableDiscoveryResult, { kind: 'configured-path-invalid' }>): Promise<void> {
  const selection = await vscode.window.showErrorMessage(
    `The configured bitbake-setup path is invalid: ${discoveryResult.configuredPath}`,
    'Open Settings'
  )

  if (selection === 'Open Settings') {
    await vscode.commands.executeCommand('workbench.action.openSettings', BITBAKE_SETUP_SETTINGS_QUERY)
  }
}

async function showBitbakeSetupNotFoundMessage (context: vscode.ExtensionContext): Promise<string | undefined> {
  const selection = await vscode.window.showWarningMessage(
    'bitbake-setup was not found in PATH and no explicit bitbake.bitbakeSetupPath is configured.',
    'Install',
    'Open Settings'
  )

  if (selection === 'Install') {
    return await installBitbakeSetup(context)
  }

  if (selection === 'Open Settings') {
    await vscode.commands.executeCommand('workbench.action.openSettings', BITBAKE_SETUP_SETTINGS_QUERY)
  }

  return undefined
}
