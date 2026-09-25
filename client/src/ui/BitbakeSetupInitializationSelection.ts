/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2026 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as vscode from 'vscode'

import {
  listBitbakeSetupRegistryConfigurations,
  type BitbakeSetupRegistryConfiguration,
  type BitbakeSetupRegistryListFailure
} from '../utils/BitbakeSetupRegistryList'
import {
  probeBitbakeSetupWrynoseConfigurations,
  type BitbakeSetupWrynoseProbeFailure
} from '../utils/BitbakeSetupWrynoseCompatibility'
import {
  type BitbakeSetupSelectableConfiguration
} from '../utils/BitbakeSetupConfigurationSelection'
import {
  type BitbakeSetupFragmentGroup,
  type BitbakeSetupFragmentOption
} from '../utils/BitbakeSetupConfiguration'

export interface BitbakeSetupInitializationSelection {
  directory: string
  registry?: string
  registryConfiguration: string
  configuration: string
  fragments: string[]
}

interface RegistryConfigurationQuickPickItem extends vscode.QuickPickItem {
  configuration: BitbakeSetupRegistryConfiguration
}

interface SelectableConfigurationQuickPickItem extends vscode.QuickPickItem {
  configuration: BitbakeSetupSelectableConfiguration
}

interface FragmentQuickPickItem extends vscode.QuickPickItem {
  option: BitbakeSetupFragmentOption
}

export async function collectBitbakeSetupInitializationSelection (
  executablePath: string,
  temporaryParentPath: string
): Promise<BitbakeSetupInitializationSelection | undefined> {
  const directory = await selectInitializationDirectory()
  if (directory === undefined) {
    return undefined
  }

  const registry = await selectRegistry()
  if (registry === null) {
    return undefined
  }

  const registryList = await listBitbakeSetupRegistryConfigurations(
    executablePath,
    temporaryParentPath,
    registry
  )

  if (registryList.kind === 'failure') {
    await showRegistryListFailure(registryList)
    return undefined
  }

  const registryConfiguration = await selectRegistryConfiguration(
    registryList.configurations
  )

  if (registryConfiguration === undefined) {
    return undefined
  }

  const configurationProbe = await probeBitbakeSetupWrynoseConfigurations(
    executablePath,
    temporaryParentPath,
    registryConfiguration.id,
    registry
  )

  if (configurationProbe.kind === 'failure') {
    await showConfigurationProbeFailure(configurationProbe)
    return undefined
  }

  const configuration = await selectConfiguration(
    configurationProbe.configurations
  )

  if (configuration === undefined) {
    return undefined
  }

  const fragments = await selectFragments(configuration.fragmentGroups)
  if (fragments === undefined) {
    return undefined
  }

  return {
    directory,
    registry,
    registryConfiguration: registryConfiguration.id,
    configuration: configuration.name,
    fragments
  }
}

async function selectInitializationDirectory (): Promise<string | undefined> {
  const selection = await vscode.window.showOpenDialog({
    canSelectFiles: false,
    canSelectFolders: true,
    canSelectMany: false,
    defaultUri: vscode.workspace.workspaceFolders?.[0]?.uri,
    openLabel: 'Initialize workspace'
  })

  return selection?.[0]?.fsPath
}

async function selectRegistry (): Promise<string | undefined | null> {
  const value = await vscode.window.showInputBox({
    prompt: 'Optional bitbake-setup registry. Leave empty to use the built-in Yocto Project registry.',
    placeHolder: 'Registry path or URL (optional)'
  })

  if (value === undefined) {
    return null
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

async function selectRegistryConfiguration (
  configurations: BitbakeSetupRegistryConfiguration[]
): Promise<BitbakeSetupRegistryConfiguration | undefined> {
  if (configurations.length === 0) {
    await vscode.window.showErrorMessage(
      'bitbake-setup did not report any available configuration templates.'
    )
    return undefined
  }

  const items: RegistryConfigurationQuickPickItem[] =
    configurations.map(configuration => ({
      label: configuration.id,
      description: configuration.description,
      detail: configuration.expires === undefined
        ? undefined
        : `Expires: ${configuration.expires}`,
      configuration
    }))

  const selection = await vscode.window.showQuickPick(items, {
    placeHolder: 'Select a bitbake-setup configuration template'
  })

  return selection?.configuration
}

async function selectConfiguration (
  configurations: BitbakeSetupSelectableConfiguration[]
): Promise<BitbakeSetupSelectableConfiguration | undefined> {
  if (configurations.length === 0) {
    await vscode.window.showErrorMessage(
      'The selected bitbake-setup template does not expose any selectable configurations.'
    )
    return undefined
  }

  const items: SelectableConfigurationQuickPickItem[] =
    configurations.map(configuration => ({
      label: configuration.name,
      description: configuration.description,
      configuration
    }))

  const selection = await vscode.window.showQuickPick(items, {
    placeHolder: 'Select a bitbake-setup configuration'
  })

  return selection?.configuration
}

async function selectFragments (
  groups: BitbakeSetupFragmentGroup[]
): Promise<string[] | undefined> {
  const fragments: string[] = []

  for (const group of groups) {
    const fragment = await selectFragment(group)

    if (fragment === undefined) {
      return undefined
    }

    fragments.push(fragment.name)
  }

  return fragments
}

async function selectFragment (
  group: BitbakeSetupFragmentGroup
): Promise<BitbakeSetupFragmentOption | undefined> {
  if (group.options.length === 0) {
    await vscode.window.showErrorMessage(
      `bitbake-setup fragment group '${group.name}' does not contain any options.`
    )
    return undefined
  }

  const items: FragmentQuickPickItem[] =
    group.options.map(option => ({
      label: option.name,
      description: option.description,
      option
    }))

  const selection = await vscode.window.showQuickPick(items, {
    placeHolder: group.description
  })

  return selection?.option
}

async function showRegistryListFailure (
  failure: BitbakeSetupRegistryListFailure
): Promise<void> {
  await vscode.window.showErrorMessage(
    formatFailure(
      'Failed to list bitbake-setup configuration templates',
      failure.reason,
      failure.details
    )
  )
}

async function showConfigurationProbeFailure (
  failure: BitbakeSetupWrynoseProbeFailure
): Promise<void> {
  await vscode.window.showErrorMessage(
    formatFailure(
      'Failed to inspect the selected bitbake-setup configuration template',
      failure.reason,
      failure.details
    )
  )
}

function formatFailure (
  message: string,
  reason: string,
  details?: string
): string {
  if (details === undefined || details.length === 0) {
    return `${message}: ${reason}`
  }

  return `${message}: ${reason} (${details})`
}
