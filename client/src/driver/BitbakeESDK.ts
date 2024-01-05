/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import path from 'path'
import { type BitbakeSettings } from '../lib/src/BitbakeSettings'
import { type DevtoolWorkspaceInfo } from '../lib/src/types/BitbakeScanResult'
import { loadJsonFile, setJsonProperty, saveJsonFile, mergeJsonArray } from '../utils/JSONFile'
import fs from 'fs'
import { logger } from '../lib/src/utils/OutputLogger'
import * as vscode from 'vscode'

export let bitbakeESDKMode: boolean = false

export function setBitbakeESDKMode (mode: boolean): void {
  bitbakeESDKMode = mode
}

function createVSCodeFolderIfNotExists (workspace: string): void {
  const vscodeFolderPath = path.join(workspace, '.vscode')
  if (!fs.existsSync(vscodeFolderPath)) {
    fs.mkdirSync(vscodeFolderPath)
  }
}

/// Copy our bitbake settings to the devtool workspace and add tasks definitions
export function configureDevtoolSDKFallback (workspace: DevtoolWorkspaceInfo, bitbakeSettings: BitbakeSettings): void {
  createVSCodeFolderIfNotExists(workspace.path)
  copyBitbakeSettings(workspace.path, bitbakeSettings)
  generateTasksDefinitions(workspace, bitbakeSettings)
  void vscode.window.showInformationMessage(`Devtool workspace for ${workspace.name} successfully configured`)
}

// exported for testing only
export function copyBitbakeSettings (workspace: string, bitbakeSettings: BitbakeSettings): void {
  const vscodeSettingsPath = path.join(workspace, '.vscode', 'settings.json')
  const vscodeSettings = loadJsonFile(vscodeSettingsPath)
  setJsonProperty(vscodeSettings, 'bitbake.pathToBitbakeFolder', bitbakeSettings.pathToBitbakeFolder)
  setJsonProperty(vscodeSettings, 'bitbake.pathToBuildFolder', bitbakeSettings.pathToBuildFolder)
  setJsonProperty(vscodeSettings, 'bitbake.pathToEnvScript', bitbakeSettings.pathToEnvScript)
  setJsonProperty(vscodeSettings, 'bitbake.workingDirectory', bitbakeSettings.workingDirectory)
  setJsonProperty(vscodeSettings, 'bitbake.commandWrapper', bitbakeSettings.commandWrapper)
  setJsonProperty(vscodeSettings, 'bitbake.shellEnv', bitbakeSettings.shellEnv ?? {})
  // Disables features like the bitbake scan which is slow and not useful
  setJsonProperty(vscodeSettings, 'bitbake.eSDKMode', true)
  saveJsonFile(vscodeSettingsPath, vscodeSettings)
  logger.info(`Generated ${vscodeSettingsPath}`)
  logger.debug(`Bitbake settings: ${JSON.stringify(vscodeSettings)}`)
}

// exported for testing only
export function generateTasksDefinitions (workspace: DevtoolWorkspaceInfo, bitbakeSettings: BitbakeSettings): void {
  const vscodeTasksPath = path.join(workspace.path, '.vscode', 'tasks.json')
  const vscodeTasks = loadJsonFile(vscodeTasksPath)
  setJsonProperty(vscodeTasks, 'version', '2.0.0')
  const recipeName = workspace.name
  const newTasks = []
  newTasks.push({
    label: `Devtool Build ${recipeName}`,
    type: 'bitbake',
    group: {
      kind: 'build'
    },
    specialCommand: `devtool build ${recipeName}`
  })
  newTasks.push({
    label: `Devtool Clean ${recipeName}`,
    type: 'bitbake',
    specialCommand: `devtool build -c ${recipeName}`
  })
  if (bitbakeSettings.sshTarget !== undefined && bitbakeSettings.sshTarget !== '') {
    newTasks.push({
      label: `Devtool Deploy ${recipeName}`,
      type: 'bitbake',
      specialCommand: `devtool deploy-target ${recipeName} ${bitbakeSettings.sshTarget}`,
      dependsOn: [`BitBake Build ${recipeName}`]
    })
  }
  const tasks = vscodeTasks.tasks
  if (tasks === undefined) {
    vscodeTasks.tasks = newTasks
  } else {
    mergeJsonArray(tasks, newTasks)
  }
  saveJsonFile(vscodeTasksPath, vscodeTasks)
  logger.info(`Generated ${vscodeTasksPath} for ${recipeName}`)
  logger.debug(`Tasks: ${JSON.stringify(vscodeTasks)}`)
}
