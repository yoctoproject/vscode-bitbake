/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as vscode from 'vscode'
import * as child_process from 'child_process'
import semver from 'semver'

import { bitbakeESDKMode, configureDevtoolSDKFallback, generateCPPProperties } from '../driver/BitbakeESDK'
import { type BitbakeDriver } from '../driver/BitbakeDriver'
import { type BitBakeProjectScanner } from '../driver/BitBakeProjectScanner'
import { type BitbakeSettings } from '../lib/src/BitbakeSettings'
import { type BitbakeScanResult, type DevtoolWorkspaceInfo, type LayerInfo } from '../lib/src/types/BitbakeScanResult'
import { logger } from '../lib/src/utils/OutputLogger'
import { finishProcessExecution } from '../utils/ProcessUtils'
import { clientNotificationManager } from './ClientNotificationManager'
import { selectRecipe } from './RecipeSelection'
import { type BitbakeTaskDefinition } from './BitbakeTaskProvider'
import { runBitbakeTerminal, runBitbakeTerminalCustomCommand } from './BitbakeTerminal'
import { type BitbakeWorkspace } from './BitbakeWorkspace'
import { type LanguageClient } from 'vscode-languageclient/node'

export function registerDevtoolCommands (context: vscode.ExtensionContext, bitbakeWorkspace: BitbakeWorkspace, bitBakeProjectScanner: BitBakeProjectScanner, client: LanguageClient): void {
  context.subscriptions.push(vscode.commands.registerCommand('bitbake.devtool-modify', async (uri) => { await devtoolModifyCommand(bitbakeWorkspace, bitBakeProjectScanner, uri) }),
    vscode.commands.registerCommand('bitbake.devtool-update', async (uri) => { await devtoolUpdateCommand(bitbakeWorkspace, bitBakeProjectScanner, uri) }),
    vscode.commands.registerCommand('bitbake.devtool-reset', async (uri) => { await devtoolResetCommand(bitbakeWorkspace, bitBakeProjectScanner, uri) }),
    vscode.commands.registerCommand('bitbake.devtool-open-workspace', async (uri) => { await devtoolOpenWorkspaceCommand(bitbakeWorkspace, bitBakeProjectScanner, uri) }),
    vscode.commands.registerCommand('bitbake.devtool-ide-sdk', async (uri) => { await devtoolIdeSDKCommand(bitbakeWorkspace, bitBakeProjectScanner, uri) }),
    vscode.commands.registerCommand('bitbake.devtool-sdk-fallback', async (uri) => { await devtoolSDKFallbackCommand(bitbakeWorkspace, bitBakeProjectScanner, client, uri) }),
    vscode.commands.registerCommand('bitbake.devtool-build', async (uri) => { await devtoolBuildCommand(bitbakeWorkspace, bitBakeProjectScanner, uri) }),
    vscode.commands.registerCommand('bitbake.devtool-deploy', async (uri) => { await devtoolDeployCommand(bitbakeWorkspace, bitBakeProjectScanner, uri) }),
    vscode.commands.registerCommand('bitbake.devtool-clean', async (uri) => { await devtoolCleanCommand(bitbakeWorkspace, bitBakeProjectScanner, uri) })
  )
}

// Exported for testing
export async function addDevtoolDebugBuild(command: string, scanResult: BitbakeScanResult, settings: BitbakeSettings, bitbakeDriver: BitbakeDriver): Promise<string> {
  if (await checkDevtoolDebugBuildAvailable(scanResult, bitbakeDriver) && !settings.disableDevtoolDebugBuild) {
    command += ' --debug-build'
  }
  return command
}

async function devtoolModifyCommand (bitbakeWorkspace: BitbakeWorkspace, bitBakeProjectScanner: BitBakeProjectScanner, uri?: unknown): Promise<void> {
  const chosenRecipe = await selectRecipe(bitbakeWorkspace, bitBakeProjectScanner, uri)
  if (chosenRecipe !== undefined) {
    logger.debug(`Command: devtool-modify: ${chosenRecipe}`)
    let command = `devtool modify ${chosenRecipe}`
    command = await addDevtoolDebugBuild(command, bitBakeProjectScanner.activeScanResult, bitBakeProjectScanner.bitbakeDriver.bitbakeSettings, bitBakeProjectScanner.bitbakeDriver)
    const process = await runBitbakeTerminalCustomCommand(bitBakeProjectScanner.bitbakeDriver, command, `Bitbake: Devtool Modify: ${chosenRecipe}`)
    process.onExit((event) => {
      if (event.exitCode === 0) {
        void bitBakeProjectScanner.rescanDevtoolWorkspaces().then(() => {
          // Running devtool-ide-sdk is very slow. Users may not want to start it all the time so we suggest it here.
          // For instance, if they only need to make a quick patch to a recipe, they may not want to wait for the SDK to be built.
          clientNotificationManager.showSDKSuggestion(chosenRecipe)
          void bitBakeProjectScanner.rescanProject()
        })
      }
    })
  }
}

async function devtoolSDKFallbackCommand (bitbakeWorkspace: BitbakeWorkspace, bitBakeProjectScanner: BitBakeProjectScanner, languageClient: LanguageClient, uri?: unknown): Promise<void> {
  const chosenRecipe = await selectRecipe(bitbakeWorkspace, bitBakeProjectScanner, uri)
  if (chosenRecipe !== undefined) {
    logger.debug(`Command: devtool-sdk-fallback: ${chosenRecipe}`)
    const workspace = bitBakeProjectScanner.activeScanResult._workspaces.find((workspace) => workspace.name === chosenRecipe)
    if (workspace === undefined) throw new Error('Devtool Workspace not found')
    const resolvedWorkspace: DevtoolWorkspaceInfo = {
      name: workspace.name,
      path: await bitBakeProjectScanner.resolveContainerPath(workspace.path) ?? workspace.path
    }
    configureDevtoolSDKFallback(resolvedWorkspace, bitBakeProjectScanner.bitbakeDriver.bitbakeSettings, bitBakeProjectScanner.bitbakeDriver.activeBuildConfiguration)
    await generateCPPProperties(resolvedWorkspace, bitBakeProjectScanner, languageClient)
    showSDKConfigurationDone(chosenRecipe)
  }
}

function showSDKConfigurationDone (recipe: string): void {
  void vscode.window.showInformationMessage(`Devtool workspace for ${recipe} successfully configured`, 'Open Workspace').then((choice) => {
    if (choice === 'Open Workspace') {
      void vscode.commands.executeCommand('bitbake.devtool-open-workspace', recipe)
    }
  }, (reason) => {
    logger.error(`Failed to show SDK configuration done message: ${reason}`)
  })
}

async function devtoolIdeSDKCommand (bitbakeWorkspace: BitbakeWorkspace, bitBakeProjectScanner: BitBakeProjectScanner, uri?: unknown): Promise<void> {
  const chosenRecipe = await selectRecipe(bitbakeWorkspace, bitBakeProjectScanner, uri)
  const bitbakeDriver = bitBakeProjectScanner.bitbakeDriver
  if (chosenRecipe !== undefined) {
    logger.debug(`Command: devtool-ide-sdk: ${chosenRecipe}`)
    if (!checkIdeSdkConfiguration(bitbakeDriver)) {
      clientNotificationManager.showSDKConfigurationError()
      return
    }
    if (!await checkIdeSdkAvailable(bitBakeProjectScanner.activeScanResult, bitBakeProjectScanner.bitbakeDriver)) {
      clientNotificationManager.showSDKUnavailableError(chosenRecipe)
      return
    }
    const command = bitbakeDriver.composeDevtoolIDECommand(chosenRecipe)
    await runBitbakeTerminalCustomCommand(bitbakeDriver, command, `Bitbake: Devtool ide-sdk: ${chosenRecipe}`)

    showSDKConfigurationDone(chosenRecipe)
  }
}

async function checkIdeSdkAvailable (scanResult: BitbakeScanResult, bitbakeDriver: BitbakeDriver): Promise<boolean> {
  if(!bitbakeESDKMode) {
    // devtool ide-sdk appeared in Yocto version Scarthgap
    return bitbakeVersionAboveEqual(scanResult, '2.8.0')
  } else {
    const command = "devtool --help | grep 'ide-sdk'"
    const process = runBitbakeTerminalCustomCommand(bitbakeDriver, command, 'Bitbake: Devtool ide-sdk: check')
    const res = await finishProcessExecution(process)
    return res.status === 0
  }
}

async function checkDevtoolDebugBuildAvailable (scanResult: BitbakeScanResult, bitbakeDriver: BitbakeDriver): Promise<boolean> {
  if(!bitbakeESDKMode) {
    // devtool debug-build appeared in Yocto version Walnascard
    return bitbakeVersionAboveEqual(scanResult, '2.12.0')
  } else {
    const command = "devtool modify --help | grep '\\-\\-debug-build'"
    const process = runBitbakeTerminalCustomCommand(bitbakeDriver, command, 'Bitbake: Devtool debug-build: check')
    const res = await finishProcessExecution(process)
    return res.status === 0
  }
}

function checkIdeSdkConfiguration (bitbakeDriver: BitbakeDriver): boolean {
  const sdkImage = bitbakeDriver.getBuildConfig('sdkImage')
  return sdkImage !== undefined && sdkImage !== ''
}

async function pickLayer (extraOption: string, bitBakeProjectScanner: BitBakeProjectScanner): Promise<LayerInfo | undefined> {
  const layers = bitBakeProjectScanner.activeScanResult._layers
  const chosenLayer = await vscode.window.showQuickPick([...layers.map(layer => layer.name), extraOption], { placeHolder: 'Choose target BitBake layer' })
  if (chosenLayer === undefined) { return }

  if (chosenLayer === extraOption) {
    return { name: extraOption, path: '', priority: 0 }
  } else {
    return layers.find(layer => layer.name === chosenLayer)
  }
}

async function devtoolUpdateCommand (bitbakeWorkspace: BitbakeWorkspace, bitBakeProjectScanner: BitBakeProjectScanner, uri?: unknown): Promise<void> {
  const originalRecipeChoice = 'Update the original recipe'
  const chosenRecipe = await selectRecipe(bitbakeWorkspace, bitBakeProjectScanner, uri)
  if (chosenRecipe === undefined) { return }
  const chosenLayer = await pickLayer(originalRecipeChoice, bitBakeProjectScanner)
  if (chosenLayer === undefined) { return }
  const chosenLayerPath = await bitBakeProjectScanner.resolveHostPath(chosenLayer?.path)
  let command = ''

  if (chosenLayer?.name === originalRecipeChoice) {
    command = `devtool update-recipe ${chosenRecipe}`
  } else {
    command = `devtool update-recipe ${chosenRecipe} --append ${chosenLayerPath}`
  }

  logger.debug(`Command: devtool-update: ${chosenRecipe}`)
  const process = runBitbakeTerminalCustomCommand(bitBakeProjectScanner.bitbakeDriver, command, `Bitbake: Devtool Update: ${chosenRecipe}`)
  const res = await finishProcessExecution(process, async () => { await bitBakeProjectScanner.bitbakeDriver.killBitbake() })
  if (res.status === 0 && chosenLayer?.name !== originalRecipeChoice) {
    await openDevtoolUpdateBBAppend(res, bitBakeProjectScanner)
    void bitBakeProjectScanner.rescanProject()
  }
}

async function openDevtoolUpdateBBAppend (res: child_process.SpawnSyncReturns<Buffer>, bitBakeProjectScanner: BitBakeProjectScanner): Promise<void> {
  const output = res.stdout.toString()
  // Regex to extract path from: NOTE: Writing append file .../meta-poky/recipes-core/busybox/busybox_1.36.1.bbappend
  const regex = /Writing append file ([\w/._-]+)/g
  const match = regex.exec(output)
  if (match === null) {
    logger.error('Could not find bbappend file')
    return
  }
  let bbappendPath = match[1]
  bbappendPath = await bitBakeProjectScanner.resolveContainerPath(bbappendPath) as string
  const bbappendUri = vscode.Uri.file(bbappendPath)
  logger.debug(`Opening devtool-update-recipe bbappend file: ${bbappendPath}`)
  await vscode.commands.executeCommand('vscode.open', bbappendUri)
}

async function devtoolResetCommand (bitbakeWorkspace: BitbakeWorkspace, bitBakeProjectScanner: BitBakeProjectScanner, uri?: unknown): Promise<void> {
  const chosenRecipe = await selectRecipe(bitbakeWorkspace, bitBakeProjectScanner, uri)
  if (chosenRecipe !== undefined) {
    logger.debug(`Command: devtool-reset: ${chosenRecipe}`)
    const command = `devtool reset ${chosenRecipe}`
    const process = await runBitbakeTerminalCustomCommand(bitBakeProjectScanner.bitbakeDriver, command, `Bitbake: Devtool Reset: ${chosenRecipe}`)
    process.onExit((event) => {
      if (event.exitCode === 0) {
        void bitBakeProjectScanner.rescanDevtoolWorkspaces().then(() => {
          void bitBakeProjectScanner.rescanProject()
        })
      }
    })
  }
}

async function devtoolOpenWorkspaceCommand (bitbakeWorkspace: BitbakeWorkspace, bitBakeProjectScanner: BitBakeProjectScanner, uri?: unknown): Promise<void> {
  const chosenRecipe = await selectRecipe(bitbakeWorkspace, bitBakeProjectScanner, uri)
  if (chosenRecipe === undefined) { return }
  if (bitBakeProjectScanner.bitbakeDriver === undefined) { throw new Error('bitbakeDriver is undefined') }

  if (bitBakeProjectScanner.activeScanResult._workspaces.find((workspace) => workspace.name === chosenRecipe) === undefined) {
    await devtoolModifyCommand(bitbakeWorkspace, bitBakeProjectScanner, chosenRecipe)
  }

  logger.debug(`Command: devtool-open-workspace: ${chosenRecipe}`)
  let workspacePath = bitBakeProjectScanner.activeScanResult._workspaces.find((workspace) => workspace.name === chosenRecipe)?.path
  workspacePath = await bitBakeProjectScanner.resolveContainerPath(workspacePath)
  if (workspacePath === undefined) {
    logger.error('Devtool workspace not found')
    return
  }
  await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(workspacePath), { forceNewWindow: true })
}

async function devtoolBuildCommand (bitbakeWorkspace: BitbakeWorkspace, bitBakeProjectScanner: BitBakeProjectScanner, uri?: unknown): Promise<void> {
  const chosenRecipe = await selectRecipe(bitbakeWorkspace, bitBakeProjectScanner, uri)
  if (chosenRecipe !== undefined) {
    logger.debug(`Command: devtool-build: ${chosenRecipe}`)
    await runBitbakeTerminal(
      bitBakeProjectScanner.bitbakeDriver,
      {
        specialCommand: `devtool build ${chosenRecipe}`,
        type: 'bitbake'
      } satisfies BitbakeTaskDefinition,
    `Bitbake: Devtool Build: ${chosenRecipe}`)
  }
}

async function devtoolDeployCommand (bitbakeWorkspace: BitbakeWorkspace, bitBakeProjectScanner: BitBakeProjectScanner, uri?: unknown): Promise<void> {
  const chosenRecipe = await selectRecipe(bitbakeWorkspace, bitBakeProjectScanner, uri)
  const bitbakeDriver = bitBakeProjectScanner.bitbakeDriver
  if (chosenRecipe !== undefined) {
    logger.debug(`Command: devtool-deploy: ${chosenRecipe}`)
    const sshTarget = bitbakeDriver.getBuildConfig('sshTarget')
    if (sshTarget === undefined || sshTarget === '') {
      clientNotificationManager.showSDKConfigurationError()
      return
    }
    await runBitbakeTerminal(
      bitbakeDriver,
      {
        specialCommand: `devtool deploy-target ${chosenRecipe} ${sshTarget}`,
        type: 'bitbake'
      } satisfies BitbakeTaskDefinition,
    `Bitbake: Devtool Deploy: ${chosenRecipe}`)
  }
}

async function devtoolCleanCommand (bitbakeWorkspace: BitbakeWorkspace, bitBakeProjectScanner: BitBakeProjectScanner, uri?: unknown): Promise<void> {
  const chosenRecipe = await selectRecipe(bitbakeWorkspace, bitBakeProjectScanner, uri)
  if (chosenRecipe !== undefined) {
    logger.debug(`Command: devtool-clean: ${chosenRecipe}`)
    await runBitbakeTerminal(
      bitBakeProjectScanner.bitbakeDriver,
      {
        specialCommand: `devtool build -c ${chosenRecipe}`,
        type: 'bitbake'
      } satisfies BitbakeTaskDefinition,
    `Bitbake: Devtool Clean: ${chosenRecipe}`)
  }
}

function bitbakeVersionAboveEqual (scanResult: BitbakeScanResult, version: string): boolean {
  return semver.gte(scanResult._bitbakeVersion, version);
}
