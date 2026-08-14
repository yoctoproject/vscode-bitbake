/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { spawn } from 'child_process'
import * as vscode from 'vscode'

import { logger } from '../lib/src/utils/OutputLogger'
import { discoverBitbakeSetupExecutable } from '../utils/BitbakeSetupDiscovery'
import { BITBAKE_SETUP_VERSION } from './BitbakeSetupReference'

const BITBAKE_SETUP_MANAGED_DIRECTORY = 'bitbake-setup'
const BITBAKE_SETUP_BACKUP_PREFIX = 'bitbake-setup-backup-'
const BITBAKE_SETUP_SETTING = 'bitbakeSetupPath'
const BITBAKE_SETUP_SETTINGS_QUERY = 'bitbake.bitbakeSetupPath'
const BITBAKE_SETUP_PACKAGE = `bitbake-setup==${BITBAKE_SETUP_VERSION}`
const BITBAKE_SETUP_VERSION_QUERY = [
  '-c',
  "import importlib.metadata; print(importlib.metadata.version('bitbake-setup'))"
]
const BITBAKE_SETUP_LAUNCHER_PROBE_ARGS = ['--help']

const bitbakeSetupInstallations = new Map<string, Promise<string | undefined>>()

type ProcessResult = {
  exitCode: number | null
  stdout: string
  stderr: string
}

type ManagedVenvValidationResult =
  | {
    ok: true
  }
  | {
    ok: false
    message: string
  }

export async function installBitbakeSetup (context: vscode.ExtensionContext): Promise<string | undefined> {
  const globalStoragePath = context.globalStorageUri.fsPath
  const activeInstallation = bitbakeSetupInstallations.get(globalStoragePath)
  if (activeInstallation !== undefined) {
    return await activeInstallation
  }

  const installation = installBitbakeSetupTransaction(context)
  bitbakeSetupInstallations.set(globalStoragePath, installation)

  try {
    return await installation
  } finally {
    if (bitbakeSetupInstallations.get(globalStoragePath) === installation) {
      bitbakeSetupInstallations.delete(globalStoragePath)
    }
  }
}

async function installBitbakeSetupTransaction (context: vscode.ExtensionContext): Promise<string | undefined> {
  const globalStoragePath = context.globalStorageUri.fsPath
  const managedVenvPath = path.join(globalStoragePath, BITBAKE_SETUP_MANAGED_DIRECTORY)
  const managedPythonPath = pythonPathForVenv(managedVenvPath)
  const managedExecutablePath = getManagedBitbakeSetupExecutablePath(context)

  if (!fs.existsSync(globalStoragePath)) {
    await fs.promises.mkdir(globalStoragePath, { recursive: true })
  }

  if (fs.existsSync(managedVenvPath) && await isReusableManagedVenv(managedVenvPath, managedPythonPath, managedExecutablePath)) {
    return await reuseManagedVenv(managedExecutablePath, managedVenvPath)
  }

  if (!fs.existsSync(managedVenvPath)) {
    return await installFreshManagedVenv(managedVenvPath, managedPythonPath, managedExecutablePath)
  }

  return await replaceStaleManagedVenv(globalStoragePath, managedVenvPath, managedPythonPath, managedExecutablePath)
}

async function reuseManagedVenv (managedExecutablePath: string, managedVenvPath: string): Promise<string | undefined> {
  try {
    logger.info(`Reusing managed bitbake-setup virtualenv at ${managedVenvPath}`)
    await updateConfiguredBitbakeSetupPath(managedExecutablePath)
    return managedExecutablePath
  } catch (error) {
    logger.error(`Failed to configure managed bitbake-setup path ${managedExecutablePath}: ${String(error)}`)
    await showInstallationFailureMessage('bitbake-setup installation failed.')
    return undefined
  }
}

async function installFreshManagedVenv (managedVenvPath: string, managedPythonPath: string, managedExecutablePath: string): Promise<string | undefined> {
  logger.info(`Installing bitbake-setup into managed virtualenv ${managedVenvPath}`)
  let failureMessage: string | undefined

  try {
    const validationResult = await createInstallAndValidateManagedVenv(managedVenvPath, managedPythonPath, managedExecutablePath)
    if (!validationResult.ok) {
      await removeDirectoryIfPresent(managedVenvPath)
      failureMessage = validationResult.message
    } else {
      await updateConfiguredBitbakeSetupPath(managedExecutablePath)
      logger.info(`Installed managed bitbake-setup at ${managedExecutablePath}`)
      return managedExecutablePath
    }
  } catch (error) {
    logger.error(`bitbake-setup installation failed: ${String(error)}`)
    await removeDirectoryIfPresent(managedVenvPath)
    failureMessage = 'bitbake-setup installation failed.'
  }

  if (failureMessage !== undefined) {
    await showInstallationFailureMessage(failureMessage)
  }
  return undefined
}

async function replaceStaleManagedVenv (
  globalStoragePath: string,
  managedVenvPath: string,
  managedPythonPath: string,
  managedExecutablePath: string
): Promise<string | undefined> {
  logger.info(`Replacing stale managed bitbake-setup virtualenv at ${managedVenvPath}`)
  let backupPath: string | undefined
  let shouldRestoreBackup = false
  let failureMessage: string | undefined

  try {
    backupPath = await createBackupPath(globalStoragePath)
    await fs.promises.rename(managedVenvPath, backupPath)
    shouldRestoreBackup = true

    const validationResult = await createInstallAndValidateManagedVenv(managedVenvPath, managedPythonPath, managedExecutablePath)
    if (!validationResult.ok) {
      shouldRestoreBackup = false
      await restoreManagedVenvBackup(managedVenvPath, backupPath)
      failureMessage = validationResult.message
    } else {
      await updateConfiguredBitbakeSetupPath(managedExecutablePath)
      shouldRestoreBackup = false
    }
  } catch (error) {
    logger.error(`bitbake-setup installation failed: ${String(error)}`)
    if (backupPath !== undefined && shouldRestoreBackup) {
      try {
        await restoreManagedVenvBackup(managedVenvPath, backupPath)
      } catch (restoreError) {
        logger.error(`bitbake-setup rollback failed after installation failure: ${String(restoreError)}`)
      }
    }
    failureMessage = 'bitbake-setup installation failed.'
  }

  if (failureMessage !== undefined) {
    await showInstallationFailureMessage(failureMessage)
    return undefined
  }

  try {
    if (backupPath !== undefined) {
      await removeDirectoryIfPresent(backupPath)
    }
  } catch (error) {
    logger.error(`Failed to remove previous managed bitbake-setup virtualenv backup at ${backupPath}: ${String(error)}`)
  }

  logger.info(`Replaced managed bitbake-setup at ${managedExecutablePath}`)
  return managedExecutablePath
}

async function createInstallAndValidateManagedVenv (
  managedVenvPath: string,
  managedPythonPath: string,
  managedExecutablePath: string
): Promise<ManagedVenvValidationResult> {
  const venvResult = await createVirtualenv(managedVenvPath)
  if (venvResult.exitCode !== 0) {
    const message = 'Failed to create the managed bitbake-setup Python virtual environment.'
    logger.error(`bitbake-setup virtualenv creation failed with exit code ${String(venvResult.exitCode)}: ${venvResult.stderr || venvResult.stdout}`)
    return { ok: false, message }
  }

  const pipResult = await installBitbakeSetupPackage(managedPythonPath)
  if (pipResult.exitCode !== 0) {
    const message = `Failed to install ${BITBAKE_SETUP_PACKAGE} into the managed Python virtual environment.`
    logger.error(`bitbake-setup pip install failed with exit code ${String(pipResult.exitCode)}: ${pipResult.stderr || pipResult.stdout}`)
    return { ok: false, message }
  }

  if (!isValidBitbakeSetupExecutable(managedExecutablePath)) {
    const message = 'The managed Python virtual environment does not contain a valid bitbake-setup executable.'
    logger.error(`bitbake-setup validation failed for ${managedExecutablePath}`)
    return { ok: false, message }
  }

  if (!await hasPinnedBitbakeSetupVersion(managedVenvPath, managedPythonPath)) {
    const message = `The managed Python virtual environment does not contain ${BITBAKE_SETUP_PACKAGE}.`
    logger.error(`bitbake-setup version validation failed for ${managedVenvPath}`)
    return { ok: false, message }
  }

  if (!await canRunBitbakeSetupLauncher(managedVenvPath, managedExecutablePath)) {
    const message = 'The managed bitbake-setup launcher failed validation.'
    logger.error(`bitbake-setup launcher validation failed for ${managedExecutablePath}`)
    return { ok: false, message }
  }

  return { ok: true }
}

function isValidBitbakeSetupExecutable (executablePath: string): boolean {
  return discoverBitbakeSetupExecutable(executablePath, undefined).kind === 'resolved-configured'
}

async function isReusableManagedVenv (managedVenvPath: string, managedPythonPath: string, managedExecutablePath: string): Promise<boolean> {
  if (!isValidBitbakeSetupExecutable(managedExecutablePath)) {
    logger.info(`Managed bitbake-setup virtualenv at ${managedVenvPath} is not reusable because the executable is invalid.`)
    return false
  }

  return await hasPinnedBitbakeSetupVersion(managedVenvPath, managedPythonPath) &&
    await canRunBitbakeSetupLauncher(managedVenvPath, managedExecutablePath)
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

async function canRunBitbakeSetupLauncher (venvPath: string, executablePath: string): Promise<boolean> {
  let launcherResult: ProcessResult
  try {
    launcherResult = await runBitbakeSetupLauncherProbe(executablePath)
  } catch (error) {
    logger.info(`Managed bitbake-setup virtualenv at ${venvPath} is not reusable because the launcher could not be started: ${String(error)}`)
    return false
  }

  if (launcherResult.exitCode !== 0) {
    logger.info(`Managed bitbake-setup virtualenv at ${venvPath} is not reusable because the launcher validation failed.`)
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

async function runBitbakeSetupLauncherProbe (executablePath: string): Promise<ProcessResult> {
  logger.debug(`Checking managed bitbake-setup launcher with ${executablePath}`)
  return await runProcess(executablePath, BITBAKE_SETUP_LAUNCHER_PROBE_ARGS, 'launcher validation')
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

async function restoreManagedVenvBackup (managedVenvPath: string, backupPath: string): Promise<void> {
  try {
    await removeDirectoryIfPresent(managedVenvPath)
    if (!fs.existsSync(backupPath)) {
      throw new Error(`Managed bitbake-setup virtualenv backup is missing: ${backupPath}`)
    }
    await fs.promises.rename(backupPath, managedVenvPath)
  } catch (error) {
    logger.error(`Failed to restore previous managed bitbake-setup virtualenv at ${managedVenvPath}: ${String(error)}`)
    throw error
  }
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

async function removeDirectoryIfPresent (directoryPath: string): Promise<void> {
  await fs.promises.rm(directoryPath, { recursive: true, force: true })
}

async function createBackupPath (globalStoragePath: string): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const backupPath = path.join(globalStoragePath, `${BITBAKE_SETUP_BACKUP_PREFIX}${crypto.randomUUID()}`)
    if (!fs.existsSync(backupPath)) {
      return backupPath
    }
  }

  throw new Error('Failed to allocate a backup path for the managed bitbake-setup virtualenv.')
}

function pythonPathForVenv (venvPath: string): string {
  return path.join(venvPath, 'bin', 'python')
}

export function getManagedBitbakeSetupExecutablePath (context: vscode.ExtensionContext): string {
  return path.join(context.globalStorageUri.fsPath, BITBAKE_SETUP_MANAGED_DIRECTORY, 'bin', 'bitbake-setup')
}
