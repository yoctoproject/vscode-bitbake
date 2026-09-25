/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2026 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import fs from 'fs'
import path from 'path'
import * as vscode from 'vscode'

import { resolveBitbakeSetupExecutablePath } from './BitbakeSetupAvailability'
import { collectBitbakeSetupInitializationSelection } from './BitbakeSetupInitializationSelection'
import { confirmBitbakeSetupInitialization } from './BitbakeSetupInitializationGuard'
import { runBitbakeSetupTerminal } from './BitbakeSetupTerminal'
import { buildBitbakeSetupInitArguments } from '../utils/BitbakeSetupInitArguments'
import { parseBitbakeSetupInitializedDirectory } from '../utils/BitbakeSetupInitOutput'

export async function initializeWorkspaceWithBitbakeSetup (
  context: vscode.ExtensionContext
): Promise<void> {
  const executablePath = await resolveBitbakeSetupExecutablePath(context)
  if (executablePath === undefined) {
    return
  }

  const selection = await collectBitbakeSetupInitializationSelection(
    executablePath,
    context.globalStorageUri.fsPath
  )

  if (selection === undefined) {
    return
  }

  let argv: string[]

  try {
    const confirmed = await confirmBitbakeSetupInitialization(
      selection.directory
    )

    if (!confirmed) {
      return
    }

    argv = buildBitbakeSetupInitArguments({
      ...selection,
      initializeVsCode: true
    })
  } catch (error) {
    await vscode.window.showErrorMessage(
      `Failed to prepare bitbake-setup initialization: ${formatError(error)}`
    )
    return
  }

  let result
  try {
    result = await runBitbakeSetupTerminal(
      executablePath,
      argv,
      path.dirname(selection.directory)
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

  const initializedDirectory =
    parseBitbakeSetupInitializedDirectory(result.output)

  if (initializedDirectory === undefined) {
    await vscode.window.showErrorMessage(
      'bitbake-setup completed successfully but did not report the initialized setup directory.'
    )
    return
  }

  if (!isChildPath(selection.directory, initializedDirectory)) {
    await vscode.window.showErrorMessage(
      `bitbake-setup reported an initialized setup directory outside the selected directory: ${initializedDirectory}`
    )
    return
  }

  const workspacePath = path.join(
    initializedDirectory,
    'bitbake.code-workspace'
  )

  if (!fs.existsSync(workspacePath)) {
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

function isChildPath (
  parentDirectory: string,
  candidateDirectory: string
): boolean {
  const relativePath = path.relative(
    path.resolve(parentDirectory),
    path.resolve(candidateDirectory)
  )

  return relativePath.length > 0 &&
    relativePath !== '..' &&
    !relativePath.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relativePath)
}

function formatError (error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
