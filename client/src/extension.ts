/* --------------------------------------------------------------------------------------------
 * Copyright (c) Eugen Wiens. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as vscode from 'vscode'
import { type LanguageClient } from 'vscode-languageclient/node'

import { ClientNotificationManager } from './ui/ClientNotificationManager'
import { logger } from './lib/src/utils/OutputLogger'
import { activateLanguageServer, deactivateLanguageServer } from './language/languageClient'
import { BitbakeDriver } from './lib/src/BitbakeDriver'
import { BitbakeTaskProvider } from './ui/BitbakeTaskProvider'
import { registerBitbakeCommands } from './ui/BitbakeCommands'
import { BitbakeWorkspace } from './ui/BitbakeWorkspace'
import { BitbakeRecipesView } from './ui/BitbakeRecipesView'
import { BitBakeProjectScannerClient } from './language/BitbakeProjectScannerClient'
import { BitbakeStatusBar } from './ui/BitbakeStatusBar'

let client: LanguageClient
const bitbakeDriver: BitbakeDriver = new BitbakeDriver()
let bitbakeTaskProvider: BitbakeTaskProvider
let taskProvider: vscode.Disposable
const bitbakeWorkspace: BitbakeWorkspace = new BitbakeWorkspace()
export let bitbakeExtensionContext: vscode.ExtensionContext
// eslint-disable-next-line @typescript-eslint/no-unused-vars
let bitbakeRecipesView: BitbakeRecipesView | undefined

function loadLoggerSettings (): void {
  logger.level = vscode.workspace.getConfiguration('bitbake').get('loggingLevel') ?? 'info'
  logger.info('Bitbake logging level: ' + logger.level)
}

function updatePythonPath (pathToBitbakeFolder: string): void {
  const pythonConfig = vscode.workspace.getConfiguration('python')
  const extraPaths = pythonConfig.get<string[]>('autoComplete.extraPaths') ?? []
  const pathToBitbakeLib = `${pathToBitbakeFolder}/lib`
  if (!extraPaths.includes(pathToBitbakeLib)) {
    extraPaths.push(`${pathToBitbakeFolder}/lib`)
  }
  void pythonConfig.update('autoComplete.extraPaths', extraPaths, vscode.ConfigurationTarget.Workspace)
  void pythonConfig.update('analysis.extraPaths', extraPaths, vscode.ConfigurationTarget.Workspace)
}

export async function activate (context: vscode.ExtensionContext): Promise<void> {
  logger.outputChannel = vscode.window.createOutputChannel('BitBake')

  loadLoggerSettings()
  bitbakeExtensionContext = context
  bitbakeDriver.loadSettings(vscode.workspace.getConfiguration('bitbake'), vscode.workspace.workspaceFolders?.[0].uri.fsPath)
  updatePythonPath(bitbakeDriver.bitbakeSettings.pathToBitbakeFolder)
  bitbakeWorkspace.loadBitbakeWorkspace(context.workspaceState)
  bitbakeTaskProvider = new BitbakeTaskProvider(bitbakeDriver)
  client = await activateLanguageServer(context)

  taskProvider = vscode.tasks.registerTaskProvider('bitbake', bitbakeTaskProvider)

  const notificationManager = new ClientNotificationManager(client, context.globalState)
  context.subscriptions.push(...notificationManager.buildHandlers())
  const bitBakeProjectScannerClient = new BitBakeProjectScannerClient(client)
  context.subscriptions.push(...bitBakeProjectScannerClient.buildHandlers())
  bitbakeRecipesView = new BitbakeRecipesView(bitbakeWorkspace, bitBakeProjectScannerClient)
  bitbakeRecipesView.registerView(context)
  void vscode.commands.executeCommand('setContext', 'bitbake.active', true)
  const bitbakeStatusBar = new BitbakeStatusBar(bitBakeProjectScannerClient)
  context.subscriptions.push(bitbakeStatusBar.statusBarItem)

  // Handle settings change for bitbake driver
  context.subscriptions.push(vscode.workspace.onDidChangeConfiguration((event) => {
    if (event.affectsConfiguration('bitbake')) {
      bitbakeDriver.loadSettings(vscode.workspace.getConfiguration('bitbake'), vscode.workspace.workspaceFolders?.[0].uri.fsPath)
      logger.debug('Bitbake settings changed')
    }
    if (event.affectsConfiguration('bitbake.loggingLevel')) {
      loadLoggerSettings()
    }
  }))
  context.subscriptions.push(vscode.workspace.onDidChangeWorkspaceFolders((event) => {
    logger.debug('Bitbake workspace changed: ' + JSON.stringify(event))
    loadLoggerSettings()
    bitbakeDriver.loadSettings(vscode.workspace.getConfiguration('bitbake'), vscode.workspace.workspaceFolders?.[0].uri.fsPath)
    bitbakeWorkspace.loadBitbakeWorkspace(context.workspaceState)
  }))

  registerBitbakeCommands(context, bitbakeWorkspace, bitbakeTaskProvider)

  logger.info('Congratulations, your extension "BitBake" is now active!')
}

export function deactivate (): Thenable<void> | undefined {
  taskProvider.dispose();
  (logger.outputChannel as vscode.OutputChannel).dispose()
  return deactivateLanguageServer(client)
}
