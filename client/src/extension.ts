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
import path from 'path'
import bitbakeRecipeScanner from './driver/BitbakeRecipeScanner'
import { BitbakeTerminalProfileProvider } from './ui/BitbakeTerminalProfile'
import { BitbakeTerminalLinkProvider } from './ui/BitbakeTerminalLinkProvider'
import { extractRecipeName } from './lib/src/utils/files'
import { BitbakeConfigPicker } from './ui/BitbakeConfigPicker'
import { scanContainsData } from './lib/src/types/BitbakeScanResult'

let client: LanguageClient
const bitbakeDriver: BitbakeDriver = new BitbakeDriver()
let bitbakeTaskProvider: BitbakeTaskProvider
let taskProvider: vscode.Disposable
const bitbakeWorkspace: BitbakeWorkspace = new BitbakeWorkspace()
export let bitbakeExtensionContext: vscode.ExtensionContext
// eslint-disable-next-line @typescript-eslint/no-unused-vars
let bitbakeRecipesView: BitbakeRecipesView | undefined
let devtoolWorkspacesView: DevtoolWorkspacesView | undefined
let terminalProvider: BitbakeTerminalProfileProvider | undefined

function loadLoggerSettings (): void {
  logger.level = vscode.workspace.getConfiguration('bitbake').get('loggingLevel') ?? 'info'
  logger.info('Bitbake logging level: ' + logger.level)
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

async function installExtensions (extensionId: string): Promise<void> {
  await vscode.window.withProgress({
    location: vscode.ProgressLocation.Notification,
    title: ` yocto-project.yocto-bitbake depends on extension ${extensionId}, installing it...`,
    cancellable: false
  }, async (progress, token) => {
    try {
      await vscode.commands.executeCommand('workbench.extensions.installExtension', extensionId).then(() => {
        progress.report({ message: `${extensionId} has been installed` })
      })
    } catch (error) {
      await vscode.window.showErrorMessage(`Failed to install ${extensionId}: ${JSON.stringify(error)}`)
    }
  })
}

export async function activate (context: vscode.ExtensionContext): Promise<void> {
  const requiredExtensions = [
    'mads-hartmann.bash-ide-vscode', // https://marketplace.visualstudio.com/items?itemName=mads-hartmann.bash-ide-vscode
    'ms-python.python' // https://marketplace.visualstudio.com/items?itemName=ms-python.python
  ]

  for (const extensionId of requiredExtensions) {
    // mads-hartmann.bash-ide-vscode is not currently available in the web version of VSCode, thus do not install it
    if (vscode.extensions.getExtension(extensionId) === undefined && vscode.env.uiKind !== vscode.UIKind.Web) {
      await installExtensions(extensionId)
    }
  }

  logger.outputChannel = vscode.window.createOutputChannel('BitBake')

  loadLoggerSettings()
  bitbakeExtensionContext = context
  logger.debug('Loaded bitbake workspace settings: ' + JSON.stringify(vscode.workspace.getConfiguration('bitbake')))
  bitbakeDriver.loadSettings(vscode.workspace.getConfiguration('bitbake'), vscode.workspace.workspaceFolders?.[0].uri.fsPath)
  const bitBakeProjectScanner: BitBakeProjectScanner = new BitBakeProjectScanner(bitbakeDriver)
  updatePythonPath()
  await disableInteferingSettings()
  bitbakeWorkspace.loadBitbakeWorkspace(context.workspaceState)
  bitbakeTaskProvider = new BitbakeTaskProvider(bitbakeDriver)
  client = await activateLanguageServer(context, bitBakeProjectScanner)
  bitBakeProjectScanner.setClient(client)

  taskProvider = vscode.tasks.registerTaskProvider('bitbake', bitbakeTaskProvider)

  bitbakeRecipeScanner.setLanguageClient(client)
  bitbakeRecipeScanner.subscribeToTaskEnd(context, bitbakeTaskProvider)

  clientNotificationManager.setMemento(context.workspaceState)
  bitbakeRecipesView = new BitbakeRecipesView(bitbakeWorkspace, bitBakeProjectScanner)
  bitbakeRecipesView.registerView(context)
  devtoolWorkspacesView = new DevtoolWorkspacesView(bitBakeProjectScanner)
  devtoolWorkspacesView.registerView(context)
  void vscode.commands.executeCommand('setContext', 'bitbake.active', true)
  const bitbakeStatusBar = new BitbakeStatusBar(bitBakeProjectScanner)
  context.subscriptions.push(bitbakeStatusBar.statusBarItem)
  const bitbakeConfigPicker = new BitbakeConfigPicker(bitbakeDriver.bitbakeSettings, context)
  context.subscriptions.push(bitbakeConfigPicker.statusBarItem)
  bitbakeDriver.activeBuildConfiguration = bitbakeConfigPicker.activeBuildConfiguration
  terminalProvider = new BitbakeTerminalProfileProvider(bitbakeDriver)
  vscode.window.registerTerminalProfileProvider('bitbake.terminal', terminalProvider)
  const terminalLinkProvider = new BitbakeTerminalLinkProvider(bitBakeProjectScanner)
  vscode.window.registerTerminalLinkProvider(terminalLinkProvider)

  const provider = new BitbakeDocumentLinkProvider(client)
  const selector = { scheme: 'file', language: 'bitbake' }
  context.subscriptions.push(vscode.languages.registerDocumentLinkProvider(selector, provider))

  // Handle settings change for bitbake driver
  context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(async (event) => {
    const currentSettings = vscode.workspace.getConfiguration('bitbake')
    bitbakeDriver.loadSettings(currentSettings, vscode.workspace.workspaceFolders?.[0].uri.fsPath)
    if (event.affectsConfiguration('bitbake.shouldDeepExamine')) {
      bitBakeProjectScanner.shouldDeepExamine = currentSettings.get('shouldDeepExamine') ?? false
    }
    if (event.affectsConfiguration('bitbake.shellEnv') ||
        event.affectsConfiguration('bitbake.workingDirectory') ||
        event.affectsConfiguration('bitbake.pathToEnvScript') ||
        event.affectsConfiguration('bitbake.pathToBitbakeFolder') ||
        event.affectsConfiguration('bitbake.pathToBuildFolder') ||
        event.affectsConfiguration('bitbake.commandWrapper') ||
        event.affectsConfiguration('bitbake.buildConfigurations')) {
      bitbakeConfigPicker.updateStatusBar(bitbakeDriver.bitbakeSettings)
      await clientNotificationManager.resetNeverShowAgain('bitbake/bitbakeSettingsError')
      logger.debug('Bitbake settings changed')
      updatePythonPath()
      if (!scanContainsData(bitBakeProjectScanner.scanResult)) {
        void vscode.commands.executeCommand('bitbake.rescan-project')
      } else {
        void vscode.commands.executeCommand('bitbake.parse-recipes')
      }
    }
    if (event.affectsConfiguration('bitbake.loggingLevel')) {
      loadLoggerSettings()
    }
  }))
  context.subscriptions.push(vscode.workspace.onDidChangeWorkspaceFolders((event) => {
    logger.debug('Bitbake workspace changed: ' + JSON.stringify(event))
    loadLoggerSettings()
    bitbakeDriver.loadSettings(vscode.workspace.getConfiguration('bitbake'), vscode.workspace.workspaceFolders?.[0].uri.fsPath)
    bitbakeConfigPicker.updateStatusBar(bitbakeDriver.bitbakeSettings)
    updatePythonPath()
    bitbakeWorkspace.loadBitbakeWorkspace(context.workspaceState)
  }))
  context.subscriptions.push(bitbakeConfigPicker.onActiveConfigChanged.event((config) => {
    bitbakeDriver.activeBuildConfiguration = config
    // Re-scaning here would be very cumbersome, the user should do it manually if desired
  }))

  // Check if the document that was just closed was the last one for a recipe
  context.subscriptions.push(vscode.workspace.onDidCloseTextDocument((document: vscode.TextDocument) => {
    const ext = ['.bb', '.bbappend', '.inc']
    const { fsPath } = document.uri
    if (ext.includes(path.extname(fsPath))) {
      const recipeName = extractRecipeName(fsPath)
      const recipeFile = vscode.window.visibleTextEditors.find((editor) => {
        return ext.includes(path.extname(editor.document.uri.fsPath)) && extractRecipeName(editor.document.uri.fsPath) === recipeName
      })
      if (recipeFile === undefined) {
        logger.debug(`No files related to the recipe ${recipeName}, sending notification to remove scan results`)
        void client.sendNotification('bitbake/removeScanResult', { recipeName })
      }
    }
  }))

  registerBitbakeCommands(context, bitbakeWorkspace, bitbakeTaskProvider, bitBakeProjectScanner, terminalProvider, client)
  registerDevtoolCommands(context, bitbakeWorkspace, bitBakeProjectScanner, client)

  logger.info('Congratulations, your extension "BitBake" is now active!')

  void vscode.commands.executeCommand('bitbake.rescan-project')
}

export function deactivate (): Thenable<void> | undefined {
  // The server has to be handled before the disposables.
  // Otherwise it might attempt to use anything that has been disposed.
  return deactivateLanguageServer(client)
    .then(() => {
      taskProvider.dispose()
      logger.outputChannel?.dispose()
    })
}
