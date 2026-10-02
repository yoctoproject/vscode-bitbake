/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2026 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import fs from 'fs'
import path from 'path'
import * as vscode from 'vscode'

import { resolveBitbakeSetupExecutablePath } from './BitbakeSetupAvailability'
import { runRawProcessTerminal } from './BitbakeTerminal'
import {
  listBitbakeSetupRegistryConfigurations,
  type BitbakeSetupRegistryConfiguration
} from '../utils/BitbakeSetupRegistryList'
import {
  probeBitbakeSetupWrynoseConfigurations
} from '../utils/BitbakeSetupWrynoseCompatibility'
import {
  type BitbakeSetupSelectableConfiguration,
  type BitbakeSetupFragmentGroup,
  type BitbakeSetupFragmentOption
} from '../utils/BitbakeSetupConfiguration'

interface RegistryConfigurationQuickPickItem extends vscode.QuickPickItem {
  configuration: BitbakeSetupRegistryConfiguration
}

interface SelectableConfigurationQuickPickItem extends vscode.QuickPickItem {
  configuration: BitbakeSetupSelectableConfiguration
}

interface FragmentQuickPickItem extends vscode.QuickPickItem {
  option: BitbakeSetupFragmentOption
}

export class BitbakeSetup {
  constructor (private readonly context: vscode.ExtensionContext) {}

  async initializeWorkspace (): Promise<void> {
    const executablePath = await resolveBitbakeSetupExecutablePath(this.context)
    if (executablePath === undefined) {
      return
    }

    const selection = await this.collectInitializationSelection(executablePath)
    if (selection === undefined) {
      return
    }

    let argv: string[]

    try {
      if (!await this.confirmInitialization(selection.directory)) {
        return
      }

      argv = buildBitbakeSetupInitArguments({
        ...selection
      })
    } catch (error) {
      await vscode.window.showErrorMessage(
        `Failed to prepare bitbake-setup initialization: ${formatError(error)}`
      )
      return
    }

    let result
    try {
      result = await runRawProcessTerminal(
        executablePath,
        argv,
        path.dirname(selection.directory),
        'BitBake: Initialize workspace with bitbake-setup'
      )
    } catch (error) {
      await vscode.window.showErrorMessage(
        `Failed to start bitbake-setup: ${formatError(error)}`
      )
      return
    }

    if (result.exitCode !== 0) {
      await vscode.window.showErrorMessage(
        `bitbake-setup initialization failed with exit code ${result.exitCode}. See terminal output for details.`
      )
      return
    }

    const workspacePath = path.join(
      selection.directory,
      'bitbake.code-workspace'
    )

    if (!isRegularFile(workspacePath)) {
      await vscode.window.showErrorMessage(
        `bitbake-setup completed successfully but did not generate the expected workspace file: ${workspacePath}`
      )
      return
    }

    const choice = await vscode.window.showInformationMessage(
      'bitbake-setup workspace initialized successfully.',
      'Open Workspace'
    )

    if (choice === 'Open Workspace') {
      await vscode.commands.executeCommand(
        'vscode.openFolder',
        vscode.Uri.file(workspacePath),
        { forceNewWindow: true }
      )
    }
  }

  private async collectInitializationSelection (
    executablePath: string
  ): Promise<{
      directory: string
      registry?: string
      registryConfiguration: string
      configuration: string
      fragments: string[]
    } | undefined> {
    const directory = await this.selectInitializationDirectory()
    if (directory === undefined) {
      return undefined
    }

    const registry = await this.selectRegistry()
    if (registry === null) {
      return undefined
    }

    let registryConfigurations: BitbakeSetupRegistryConfiguration[]

    try {
      registryConfigurations = await listBitbakeSetupRegistryConfigurations(
        executablePath,
        this.context.globalStorageUri.fsPath,
        registry
      )
    } catch (error) {
      await vscode.window.showErrorMessage(
        `Failed to list bitbake-setup configuration templates: ${formatError(error)}`
      )
      return undefined
    }

    const registryConfiguration = await this.selectRegistryConfiguration(
      registryConfigurations
    )

    if (registryConfiguration === undefined) {
      return undefined
    }

    let configurations: BitbakeSetupSelectableConfiguration[]

    try {
      configurations = await probeBitbakeSetupWrynoseConfigurations(
        executablePath,
        this.context.globalStorageUri.fsPath,
        registryConfiguration.id,
        registry
      )
    } catch (error) {
      await vscode.window.showErrorMessage(
        `Failed to inspect the selected bitbake-setup configuration template: ${formatError(error)}`
      )
      return undefined
    }

    const configuration = await this.selectConfiguration(
      configurations
    )

    if (configuration === undefined) {
      return undefined
    }

    const fragments = await this.selectFragments(configuration.fragmentGroups)
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

  private async selectInitializationDirectory (): Promise<string | undefined> {
    const selection = await vscode.window.showOpenDialog({
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false,
      defaultUri: vscode.workspace.workspaceFolders?.[0]?.uri,
      openLabel: 'Initialize workspace'
    })

    return selection?.[0]?.fsPath
  }

  private async selectRegistry (): Promise<string | undefined | null> {
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

  private async selectRegistryConfiguration (
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

  private async selectConfiguration (
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

  private async selectFragments (
    groups: BitbakeSetupFragmentGroup[]
  ): Promise<string[] | undefined> {
    const fragments: string[] = []

    for (const group of groups) {
      const fragment = await this.selectFragment(group)

      if (fragment === undefined) {
        return undefined
      }

      fragments.push(fragment.name)
    }

    return fragments
  }

  private async selectFragment (
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

  private async confirmInitialization (directory: string): Promise<boolean> {
    const entries = await readDirectoryEntries(directory)

    if (entries === undefined || entries.length === 0) {
      return true
    }

    const selection = await vscode.window.showWarningMessage(
      'The selected directory is not empty. bitbake-setup may create or modify files in it. Continue?',
      { modal: true },
      'Continue',
      'Cancel'
    )

    return selection === 'Continue'
  }
}

function buildBitbakeSetupInitArguments (
  input: {
    directory: string
    registry?: string
    registryConfiguration: string
    configuration: string
    fragments: string[]
  }
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
    '--non-interactive',
    '--init-vscode',
    input.registryConfiguration,
    input.configuration,
    ...input.fragments
  )

  return argv
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

function isRegularFile (filePath: string): boolean {
  try {
    return fs.statSync(filePath).isFile()
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'ENOENT'
    ) {
      return false
    }

    throw error
  }
}

function formatError (error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
