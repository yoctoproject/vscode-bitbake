/* --------------------------------------------------------------------------------------------
 * Copyright (c) Eugen Wiens. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as vscode from 'vscode'
import { type LanguageClient } from 'vscode-languageclient/node'

import { clientNotificationManager } from './ui/ClientNotificationManager'
import { logger } from './lib/src/utils/OutputLogger'
import { activateLanguageServer, deactivateLanguageServer } from './language/languageClient'
import { BitbakeDriver } from './driver/BitbakeDriver'
import { BitbakeTaskProvider } from './ui/BitbakeTaskProvider'
import { registerBitbakeCommands, registerDevtoolCommands } from './ui/BitbakeCommands'
import { BitbakeWorkspace } from './ui/BitbakeWorkspace'
import { BitbakeRecipesView } from './ui/BitbakeRecipesView'
import { BitbakeStatusBar } from './ui/BitbakeStatusBar'
import { BitBakeProjectScanner } from './driver/BitBakeProjectScanner'
import { BitbakeDocumentLinkProvider } from './documentLinkProvider'
import { DevtoolWorkspacesView } from './ui/DevtoolWorkspacesView'
import { bitbakeESDKMode, setBitbakeESDKMode } from './driver/BitbakeESDK'
import path from 'path'

let client: LanguageClient
const bitbakeDriver: BitbakeDriver = new BitbakeDriver()
let bitbakeTaskProvider: BitbakeTaskProvider
let taskProvider: vscode.Disposable
const bitbakeWorkspace: BitbakeWorkspace = new BitbakeWorkspace()
export let bitbakeExtensionContext: vscode.ExtensionContext
// eslint-disable-next-line @typescript-eslint/no-unused-vars
let bitbakeRecipesView: BitbakeRecipesView | undefined
let devtoolWorkspacesView: DevtoolWorkspacesView | undefined

function loadLoggerSettings (): void {
  logger.level = vscode.workspace.getConfiguration('bitbake').get('loggingLevel') ?? 'info'
  logger.info('Bitbake logging level: ' + logger.level)
}

function loadESDKSettings (): void {
  setBitbakeESDKMode(vscode.workspace.getConfiguration('bitbake').get('eSDKMode') ?? false)
  logger.info('Bitbake eSDK mode: ' + bitbakeESDKMode)
}

function updatePythonPath (): void {
  // Deliberately load the workspace configuration here instead of using
  // bitbakeDriver.bitbakeSettings, because the latter contains resolved
  // (absolute) paths, which is not very portable for settings.json. We want
  // something like "${workspaceFolder}/poky/bitbake/lib" instead of
  // "/home/<user>/<project>/poky/bitbake/lib"
  const bitbakeConfig = vscode.workspace.getConfiguration('bitbake')
  const pythonConfig = vscode.workspace.getConfiguration('python')
  const pathToBitbakeFolder = bitbakeConfig.pathToBitbakeFolder
  const pathToBitbakeLib = `${pathToBitbakeFolder}/lib`
  const pathToPokyMetaLib = path.join(pathToBitbakeFolder, '../meta/lib') // We assume BitBake is into Poky
  for (const pythonSubConf of ['autoComplete.extraPaths', 'analysis.extraPaths']) {
    const extraPaths = pythonConfig.get<string[]>(pythonSubConf) ?? []
    for (const pathToAdd of [pathToBitbakeLib, pathToPokyMetaLib]) {
      if (!extraPaths.includes(pathToAdd)) {
        extraPaths.push(pathToAdd)
      }
      void pythonConfig.update(pythonSubConf, extraPaths, vscode.ConfigurationTarget.Workspace)
    }
  }
}

async function disableInteferingSettings (): Promise<void> {
  const config = vscode.workspace.getConfiguration()
  for (const languageKey of ['[python]', '[shellscript]']) {
    const languageConfig = config.get<Record<string, unknown>>(languageKey) ?? {}
    // 'files.trimTrailingWhitespace' modifies the embedded languages documents and breaks the mapping of the positions
    languageConfig['files.trimTrailingWhitespace'] = false
    await config.update(languageKey, languageConfig, vscode.ConfigurationTarget.Workspace)
  }
}

export async function activate (context: vscode.ExtensionContext): Promise<void> {
  logger.outputChannel = vscode.window.createOutputChannel('BitBake')

  loadLoggerSettings()
  loadESDKSettings()
  bitbakeExtensionContext = context
  logger.debug('Loaded bitbake workspace settings: ' + JSON.stringify(vscode.workspace.getConfiguration('bitbake')))
  bitbakeDriver.loadSettings(vscode.workspace.getConfiguration('bitbake'), vscode.workspace.workspaceFolders?.[0].uri.fsPath)
  const bitBakeProjectScanner: BitBakeProjectScanner = new BitBakeProjectScanner(bitbakeDriver)
  updatePythonPath()
  await disableInteferingSettings()
  bitbakeWorkspace.loadBitbakeWorkspace(context.workspaceState)
  bitbakeTaskProvider = new BitbakeTaskProvider(bitbakeDriver)
  client = await activateLanguageServer(context)
  bitBakeProjectScanner.setClient(client)

  taskProvider = vscode.tasks.registerTaskProvider('bitbake', bitbakeTaskProvider)

  clientNotificationManager.setMemento(context.workspaceState)
  bitbakeRecipesView = new BitbakeRecipesView(bitbakeWorkspace, bitBakeProjectScanner)
  bitbakeRecipesView.registerView(context)
  devtoolWorkspacesView = new DevtoolWorkspacesView(bitBakeProjectScanner)
  devtoolWorkspacesView.registerView(context)
  void vscode.commands.executeCommand('setContext', 'bitbake.active', true)
  const bitbakeStatusBar = new BitbakeStatusBar(bitBakeProjectScanner)
  context.subscriptions.push(bitbakeStatusBar.statusBarItem)

  const provider = new BitbakeDocumentLinkProvider(client)
  const selector = { scheme: 'file', language: 'bitbake' }
  context.subscriptions.push(vscode.languages.registerDocumentLinkProvider(selector, provider))

  // Handle settings change for bitbake driver
  context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(async (event) => {
    if (event.affectsConfiguration('bitbake')) {
      await clientNotificationManager.resetNeverShowAgain('custom/bitbakeSettingsError')
      bitbakeDriver.loadSettings(vscode.workspace.getConfiguration('bitbake'), vscode.workspace.workspaceFolders?.[0].uri.fsPath)
      logger.debug('Bitbake settings changed')
      updatePythonPath()
      void vscode.commands.executeCommand('bitbake.rescan-project')
    }
    if (event.affectsConfiguration('bitbake.loggingLevel')) {
      loadLoggerSettings()
    }
    if (event.affectsConfiguration('bitbake.eSDKMode')) {
      loadESDKSettings()
    }
  }))
  context.subscriptions.push(vscode.workspace.onDidChangeWorkspaceFolders((event) => {
    logger.debug('Bitbake workspace changed: ' + JSON.stringify(event))
    loadLoggerSettings()
    bitbakeDriver.loadSettings(vscode.workspace.getConfiguration('bitbake'), vscode.workspace.workspaceFolders?.[0].uri.fsPath)
    updatePythonPath()
    bitbakeWorkspace.loadBitbakeWorkspace(context.workspaceState)
  }))

  registerBitbakeCommands(context, bitbakeWorkspace, bitbakeTaskProvider, bitBakeProjectScanner)
  registerDevtoolCommands(context, bitbakeWorkspace, bitBakeProjectScanner)

  logger.info('Congratulations, your extension "BitBake" is now active!')

  void vscode.commands.executeCommand('bitbake.rescan-project')
}

export function deactivate (): Thenable<void> | undefined {
  taskProvider.dispose();
  (logger.outputChannel as vscode.OutputChannel).dispose()
  return deactivateLanguageServer(client)
}
