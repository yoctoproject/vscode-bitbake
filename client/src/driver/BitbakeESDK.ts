/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import path from 'path'
import { getBuildSetting, type BitbakeSettings } from '../lib/src/BitbakeSettings'
import { type DevtoolWorkspaceInfo } from '../lib/src/types/BitbakeScanResult'
import { loadJsonFile, setJsonProperty, saveJsonFile, mergeJsonArray } from '../utils/JSONFile'
import fs from 'fs'
import { logger } from '../lib/src/utils/OutputLogger'
import { type LanguageClient } from 'vscode-languageclient/node'
import { getVariableValue } from '../language/languageClient'
import { type BitBakeProjectScanner } from './BitBakeProjectScanner'

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
export function configureDevtoolSDKFallback (workspace: DevtoolWorkspaceInfo, bitbakeSettings: BitbakeSettings, activeConfig: string): void {
  createVSCodeFolderIfNotExists(workspace.path)
  copyBitbakeSettings(workspace.path, bitbakeSettings, activeConfig)
  generateTasksDefinitions(workspace, bitbakeSettings)
}

// exported for testing only
export function copyBitbakeSettings (workspace: string, bitbakeSettings: BitbakeSettings, activeConfig: string): void {
  const vscodeSettingsPath = path.join(workspace, '.vscode', 'settings.json')
  const vscodeSettings = loadJsonFile(vscodeSettingsPath)
  setJsonProperty(vscodeSettings, 'bitbake.pathToBitbakeFolder', bitbakeSettings.pathToBitbakeFolder)
  setJsonProperty(vscodeSettings, 'bitbake.pathToBuildFolder', getBuildSetting(bitbakeSettings, activeConfig, 'pathToBuildFolder'))
  setJsonProperty(vscodeSettings, 'bitbake.pathToEnvScript', getBuildSetting(bitbakeSettings, activeConfig, 'pathToEnvScript'))
  setJsonProperty(vscodeSettings, 'bitbake.workingDirectory', getBuildSetting(bitbakeSettings, activeConfig, 'workingDirectory'))
  setJsonProperty(vscodeSettings, 'bitbake.commandWrapper', getBuildSetting(bitbakeSettings, activeConfig, 'commandWrapper'))
  setJsonProperty(vscodeSettings, 'bitbake.shellEnv', getBuildSetting(bitbakeSettings, activeConfig, 'shellEnv') ?? {})
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

export async function generateCPPProperties (workspace: DevtoolWorkspaceInfo, bitBakeProjectScanner: BitBakeProjectScanner, client: LanguageClient): Promise<void> {
  const vscodeCppPropertiesPath = path.join(workspace.path, '.vscode', 'c_cpp_properties.json')
  const vscodeCppProperties = loadJsonFile(vscodeCppPropertiesPath)
  const recipe = workspace.name

  const STAGING_BINDIR_TOOLCHAIN = await bitBakeProjectScanner.resolveContainerPath(await getVariableValue(client, 'STAGING_BINDIR_TOOLCHAIN', recipe, true), true) ?? ''
  const CXX = await getVariableValue(client, 'CXX', recipe, true)
  const CXXFLAGS = await getVariableValue(client, 'CXXFLAGS', recipe)
  const TARGET_SYS = await getVariableValue(client, 'TARGET_SYS', recipe)
  const configuration = {
    name: TARGET_SYS,
    compilerPath: path.join(STAGING_BINDIR_TOOLCHAIN, CXX?.split(/\s+/)[0] ?? ''),
    compilerArgs: CXX?.split(/\s+/).slice(1).concat(CXXFLAGS?.split(/\s+/) ?? [])
  }

  const configurations = vscodeCppProperties.configurations
  if (configurations === undefined) {
    vscodeCppProperties.configurations = [configuration]
  } else {
    mergeJsonArray(configurations, [configuration])
  }
  saveJsonFile(vscodeCppPropertiesPath, vscodeCppProperties)
}
