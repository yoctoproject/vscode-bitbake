/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import fs from 'fs'
import path from 'path'
import { spawn } from 'child_process'
import * as vscode from 'vscode'

import { logger } from '../lib/src/utils/OutputLogger'

const BITBAKE_SETUP_MANAGED_DIRECTORY = 'bitbake-setup'
const BITBAKE_SETUP_SETTING = 'bitbakeSetupPath'
const BITBAKE_SETUP_SETTINGS_QUERY = 'bitbake.bitbakeSetupPath'
const BITBAKE_SETUP_VERSION = '2.19.0'
const BITBAKE_SETUP_PACKAGE = `bitbake-setup==${BITBAKE_SETUP_VERSION}`
const BITBAKE_SETUP_VERSION_QUERY = [
  '-c',
  "import importlib.metadata; print(importlib.metadata.version('bitbake-setup'))"
]

const bitbakeSetupInstallations = new Map<string, Promise<string | undefined>>()

type ProcessResult = {
  exitCode: number | null
  stdout: string
  stderr: string
}

export async function installBitbakeSetup (context: vscode.ExtensionContext): Promise<string | undefined> {
  const globalStoragePath = context.globalStorageUri.fsPath
  const activeInstallation = bitbakeSetupInstallations.get(globalStoragePath)
  if (activeInstallation !== undefined) {
    return await activeInstallation
  }

  const installation = installManagedBitbakeSetup(context)
  bitbakeSetupInstallations.set(globalStoragePath, installation)

  try {
    return await installation
  } finally {
    if (bitbakeSetupInstallations.get(globalStoragePath) === installation) {
      bitbakeSetupInstallations.delete(globalStoragePath)
    }
  }
}

async function installManagedBitbakeSetup (context: vscode.ExtensionContext): Promise<string | undefined> {
  const globalStoragePath = context.globalStorageUri.fsPath
  const managedVenvPath = path.join(globalStoragePath, BITBAKE_SETUP_MANAGED_DIRECTORY)
  const managedPythonPath = pythonPathForVenv(managedVenvPath)
  const managedExecutablePath = getManagedBitbakeSetupExecutablePath(context)

  try {
    await fs.promises.mkdir(globalStoragePath, { recursive: true })

    if (await isReusableManagedInstallation(managedVenvPath, managedPythonPath, managedExecutablePath)) {
      logger.info(`Reusing managed bitbake-setup virtualenv at ${managedVenvPath}`)
      return await configureManagedBitbakeSetup(managedExecutablePath)
    }

    logger.info(`Installing ${BITBAKE_SETUP_PACKAGE} into managed virtualenv ${managedVenvPath}`)
    return await recreateManagedBitbakeSetup(managedVenvPath, managedPythonPath, managedExecutablePath)
  } catch (error) {
    logger.error(`bitbake-setup installation failed: ${String(error)}`)
    await showInstallationFailureMessage('bitbake-setup installation failed.')
    return undefined
  }
}

async function recreateManagedBitbakeSetup (
  managedVenvPath: string,
  managedPythonPath: string,
  managedExecutablePath: string
): Promise<string | undefined> {
  const venvResult = await createVirtualenv(managedVenvPath)
  if (venvResult.exitCode !== 0) {
    logger.error(`bitbake-setup virtualenv creation failed with exit code ${String(venvResult.exitCode)}: ${venvResult.stderr || venvResult.stdout}`)
    await showInstallationFailureMessage('Failed to create the managed bitbake-setup Python virtual environment.')
    return undefined
  }

  const pipResult = await installBitbakeSetupPackage(managedPythonPath)
  if (pipResult.exitCode !== 0) {
    logger.error(`bitbake-setup pip install failed with exit code ${String(pipResult.exitCode)}: ${pipResult.stderr || pipResult.stdout}`)
    await showInstallationFailureMessage(`Failed to install ${BITBAKE_SETUP_PACKAGE} into the managed Python virtual environment.`)
    return undefined
  }

  if (!isValidBitbakeSetupExecutable(managedExecutablePath)) {
    logger.error(`bitbake-setup validation failed for ${managedExecutablePath}`)
    await showInstallationFailureMessage('The managed Python virtual environment does not contain a valid bitbake-setup executable.')
    return undefined
  }

  logger.info(`Installed managed bitbake-setup at ${managedExecutablePath}`)
  return await configureManagedBitbakeSetup(managedExecutablePath)
}

async function configureManagedBitbakeSetup (managedExecutablePath: string): Promise<string> {
  await updateConfiguredBitbakeSetupPath(managedExecutablePath)
  return managedExecutablePath
}

async function isReusableManagedInstallation (managedVenvPath: string, managedPythonPath: string, managedExecutablePath: string): Promise<boolean> {
  if (!isValidBitbakeSetupExecutable(managedExecutablePath)) {
    logger.info(`Managed bitbake-setup virtualenv at ${managedVenvPath} is not reusable because the executable is invalid.`)
    return false
  }

  return await hasPinnedBitbakeSetupVersion(managedVenvPath, managedPythonPath)
}

function isValidBitbakeSetupExecutable (executablePath: string): boolean {
  try {
    const stats = fs.statSync(executablePath)
    if (!stats.isFile()) {
      return false
    }

    fs.accessSync(executablePath, fs.constants.X_OK)
    return true
  } catch {
    return false
  }
}

async function hasPinnedBitbakeSetupVersion (venvPath: string, pythonPath: string): Promise<boolean> {
  let versionResult: ProcessResult
  try {
    versionResult = await getInstalledBitbakeSetupVersion(pythonPath)
  } catch (error) {
    logger.info(`Managed bitbake-setup virtualenv at ${venvPath} is not reusable because the package version could not be queried: ${String(error)}`)
    return false
  }

  if (versionResult.exitCode !== 0) {
    logger.info(`Managed bitbake-setup virtualenv at ${venvPath} is not reusable because the package version query failed.`)
    return false
  }

  const version = versionResult.stdout.trim()
  if (version !== BITBAKE_SETUP_VERSION) {
    logger.info(`Managed bitbake-setup virtualenv at ${venvPath} has unsupported bitbake-setup version: ${version}`)
    return false
  }

  return true
}

async function createVirtualenv (venvPath: string): Promise<ProcessResult> {
  logger.debug(`Creating managed bitbake-setup virtualenv at ${venvPath}`)
  return await runProcess('python3', ['-m', 'venv', '--clear', venvPath], 'venv')
}

async function installBitbakeSetupPackage (pythonPath: string): Promise<ProcessResult> {
  logger.debug(`Installing ${BITBAKE_SETUP_PACKAGE} with ${pythonPath}`)
  return await runProcess(pythonPath, ['-m', 'pip', 'install', BITBAKE_SETUP_PACKAGE], 'pip install')
}

async function getInstalledBitbakeSetupVersion (pythonPath: string): Promise<ProcessResult> {
  logger.debug(`Checking installed bitbake-setup version with ${pythonPath}`)
  return await runProcess(pythonPath, BITBAKE_SETUP_VERSION_QUERY, 'version query')
}

async function runProcess (command: string, args: string[], operation: string): Promise<ProcessResult> {
  return await new Promise<ProcessResult>((resolve, reject) => {
    const child = spawn(command, args, {
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe']
    })

    let stdout = ''
    let stderr = ''

    child.stdout?.on('data', (data: Buffer | string) => {
      stdout += data.toString()
    })

    child.stderr?.on('data', (data: Buffer | string) => {
      stderr += data.toString()
    })

    child.once('error', (error) => {
      logger.error(`bitbake-setup ${operation} spawn error: ${String(error)}`)
      reject(error)
    })

    child.once('close', (exitCode) => {
      logger.debug(`bitbake-setup ${operation} finished with exit code ${String(exitCode)}`)
      if (stdout.length > 0) {
        logger.debug(`bitbake-setup ${operation} stdout: ${stdout.trimEnd()}`)
      }
      if (stderr.length > 0) {
        logger.debug(`bitbake-setup ${operation} stderr: ${stderr.trimEnd()}`)
      }
      resolve({
        exitCode,
        stdout,
        stderr
      })
    })
  })
}

async function updateConfiguredBitbakeSetupPath (executablePath: string): Promise<void> {
  await vscode.workspace.getConfiguration('bitbake').update(BITBAKE_SETUP_SETTING, executablePath, vscode.ConfigurationTarget.Global)
}

async function showInstallationFailureMessage (message: string): Promise<void> {
  const selection = await vscode.window.showErrorMessage(message, 'Open Settings')
  if (selection === 'Open Settings') {
    await vscode.commands.executeCommand('workbench.action.openSettings', BITBAKE_SETUP_SETTINGS_QUERY)
  }
}

function pythonPathForVenv (venvPath: string): string {
  return path.join(venvPath, 'bin', 'python')
}

export function getManagedBitbakeSetupExecutablePath (context: vscode.ExtensionContext): string {
  return path.join(context.globalStorageUri.fsPath, BITBAKE_SETUP_MANAGED_DIRECTORY, 'bin', 'bitbake-setup')
}
