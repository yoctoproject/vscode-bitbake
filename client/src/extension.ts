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
import { type BitbakeScanResult, scanContainsData } from './lib/src/types/BitbakeScanResult'
import { reviewDiagnostics } from './language/diagnosticsSupport'
import { embeddedLanguageDocsManager } from './language/EmbeddedLanguageDocsManager'
import { NotificationMethod } from './lib/src/types/notifications'

let client: LanguageClient
const bitbakeDriver: BitbakeDriver = new BitbakeDriver()
let bitbakeTaskProvider: BitbakeTaskProvider
let taskProvider: vscode.Disposable
const bitbakeWorkspace: BitbakeWorkspace = new BitbakeWorkspace()
// eslint-disable-next-line @typescript-eslint/no-unused-vars
let bitbakeRecipesView: BitbakeRecipesView | undefined
let devtoolWorkspacesView: DevtoolWorkspacesView | undefined
let terminalProvider: BitbakeTerminalProfileProvider | undefined

export function canModifyConfig (): boolean {
  const disableConfigModification = vscode.workspace.getConfiguration('bitbake').get('disableConfigModification')
  return disableConfigModification !== true
}

function loadLoggerSettings (): void {
  logger.level = vscode.workspace.getConfiguration('bitbake').get('loggingLevel') ?? 'info'
  logger.info('Bitbake logging level: ' + logger.level)
}

function loadEmbeddedLanguageDocsManagerSettings (): void {
  const isDisabled = vscode.workspace.getConfiguration('bitbake').get('disableEmbeddedLanguagesFiles')
  logger.info(`Disable embedded language features ${isDisabled as any}`)
  if (typeof isDisabled === 'boolean') {
    embeddedLanguageDocsManager.isDisabled = isDisabled
  }
}

function configureBitBakeFileAssociation (): void {
  const filesSettings = vscode.workspace.getConfiguration('files')
  const associations = filesSettings.get<Record<string, string>>('associations') ?? {}
  associations['*.conf'] = 'bitbake'
  associations['*.inc'] = 'bitbake'
  if (canModifyConfig()) {
    void filesSettings.update('associations', associations, vscode.ConfigurationTarget.Workspace)
  }
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
    let extraPaths = pythonConfig.get<string[]>(pythonSubConf) ?? []
    if (!Object.isExtensible(extraPaths)) extraPaths = []
    for (const pathToAdd of [pathToBitbakeLib, pathToPokyMetaLib]) {
      if (!extraPaths.includes(pathToAdd)) {
        extraPaths.push(pathToAdd)
      }
      if (canModifyConfig()) {
        void pythonConfig.update(pythonSubConf, extraPaths, vscode.ConfigurationTarget.Workspace)
      }
    }
  }
}

async function disableInteferingSettings (): Promise<void> {
  const config = vscode.workspace.getConfiguration()
  for (const languageKey of ['[python]', '[shellscript]']) {
    const languageConfig = config.get<Record<string, unknown>>(languageKey) ?? {}
    // 'files.trimTrailingWhitespace' modifies the embedded languages documents and breaks the mapping of the positions
    languageConfig['files.trimTrailingWhitespace'] = false
    if (canModifyConfig()) {
      await config.update(languageKey, languageConfig, vscode.ConfigurationTarget.Workspace)
    }
  }
}

async function installExtensions (extensionId: string): Promise<void> {
  await vscode.window.showInformationMessage(`The extension ${extensionId} is required for yocto-project.yocto-bitbake to work properly. Do you want to install it?`, 'Install', 'Show extension page', 'Cancel')
    .then((item) => {
      if (item === 'Install') {
        void vscode.window.withProgress({
          location: vscode.ProgressLocation.Notification,
          title: `Installing ${extensionId}...`,
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
      } else if (item === 'Show extension page') {
        void vscode.commands.executeCommand('extension.open', extensionId)
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
  loadEmbeddedLanguageDocsManagerSettings()
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

  context.subscriptions.push(bitbakeRecipeScanner)
  bitbakeRecipeScanner.setLanguageClient(client)
  bitbakeRecipeScanner.subscribeToTaskEnd(context, bitbakeTaskProvider)
  context.subscriptions.push(
    bitbakeRecipeScanner.serverRecipeScanComplete.event(reviewDiagnostics)
  )

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

  configureBitBakeFileAssociation()

  // Handle settings change for bitbake driver
  context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(async (event) => {
    const currentSettings = vscode.workspace.getConfiguration('bitbake')
    bitbakeDriver.loadSettings(currentSettings, vscode.workspace.workspaceFolders?.[0].uri.fsPath)
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
    if (event.affectsConfiguration('bitbake.disableEmbeddedLanguagesFiles')) {
      loadEmbeddedLanguageDocsManagerSettings()
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

  context.subscriptions.push(
    // Check if the document that was just closed was the last one for a recipe
    vscode.workspace.onDidCloseTextDocument((document: vscode.TextDocument) => {
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
    }),
    // Run different bitbake commands based on the saved document type
    vscode.workspace.onDidSaveTextDocument(async (document: vscode.TextDocument) => {
      if (document.languageId !== 'bitbake') {
        // Embedded files also trigger this event, but we don't do anything with them
        return
      }
      const parseOnSave = vscode.workspace.getConfiguration('bitbake').get('parseOnSave')
      if (parseOnSave !== true) {
        return
      }
      const exts = ['.bb', '.bbappend', '.inc']
      const { fsPath } = document.uri

      if (exts.includes(path.extname(fsPath))) {
        const foundRecipe = bitBakeProjectScanner.scanResult._recipes.find((recipe) => recipe.name === extractRecipeName(fsPath))
        if (foundRecipe !== undefined) {
          logger.debug(`[onDidSave] Running 'bitbake -e' against the saved recipe: ${foundRecipe.name}`)
          // Note that it pends only one scan at a time. See client/src/driver/BitbakeRecipeScanner.ts.
          // Saving more than 2 files at the same time could cause the server to miss some of the scans.
          await vscode.commands.executeCommand('bitbake.scan-recipe-env', document.uri)
          return
        }
      }
      // saving other files or no recipe is resolved
      await vscode.commands.executeCommand('bitbake.parse-recipes')
    })
  )

  registerBitbakeCommands(context, bitbakeWorkspace, bitbakeTaskProvider, bitBakeProjectScanner, terminalProvider, client)
  registerDevtoolCommands(context, bitbakeWorkspace, bitBakeProjectScanner, client)

  logger.info('Congratulations, your extension "BitBake" is now active!')

  // Update the scan result stored in the global state
  bitBakeProjectScanner.onChange.on(BitBakeProjectScanner.EventType.SCAN_COMPLETE, (scanResult: BitbakeScanResult) => {
    void context.workspaceState.update('bitbake.ScanResult', scanResult).then(() => {
      logger.debug('BitBake scan result saved to workspace state')
    })
    void context.workspaceState.update('bitbake.ScanResultVersion', bitBakeProjectScanner.scanResultVersion).then(() => {
      logger.debug('BitBake scan result version saved to workspace state')
    })
  })

  const lastBitbakeScanResult: BitbakeScanResult | undefined = context.workspaceState.get('bitbake.ScanResult')
  const lastBitbakeScanResultVersion: number | undefined = context.workspaceState.get('bitbake.ScanResultVersion')

  const needToScan = lastBitbakeScanResult === undefined ||
    lastBitbakeScanResultVersion === undefined ||
    lastBitbakeScanResultVersion !== bitBakeProjectScanner.scanResultVersion

  if (needToScan) {
    logger.debug('No valid scan result found, scanning the project')
    void vscode.commands.executeCommand('bitbake.rescan-project')
  } else {
    logger.debug('Loading previous scan result')
    bitBakeProjectScanner.scanResult = lastBitbakeScanResult
    bitBakeProjectScanner.onChange.emit(BitBakeProjectScanner.EventType.SCAN_COMPLETE, bitBakeProjectScanner.scanResult)
    void client.sendNotification(NotificationMethod.ScanComplete, bitBakeProjectScanner.scanResult)
  }
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
