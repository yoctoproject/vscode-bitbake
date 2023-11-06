/* --------------------------------------------------------------------------------------------
 * Copyright (c) Eugen Wiens. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import fs from 'fs'
import {
  type Connection,
  type InitializeResult,
  type CompletionItem,
  createConnection,
  TextDocuments,
  ProposedFeatures,
  TextDocumentSyncKind,
  type InitializeParams,
  FileChangeType
} from 'vscode-languageserver/node'
import { bitBakeDocScanner } from './BitBakeDocScanner'
import { bitBakeProjectScanner, setBitBakeProjectScannerConnection } from './BitBakeProjectScanner'
import contextHandler from './ContextHandler'
import { SymbolScanner } from './SymbolScanner'
import { TextDocument } from 'vscode-languageserver-textdocument'
import { analyzer } from './tree-sitter/analyzer'
import { generateParser } from './tree-sitter/parser'
import { logger } from './lib/src/utils/OutputLogger'
import { onCompletionHandler } from './connectionHandlers/onCompletion'
import { onDefinitionHandler } from './connectionHandlers/onDefinition'
import { setNotificationManagerConnection, serverNotificationManager } from './ServerNotificationManager'
import { onHoverHandler } from './connectionHandlers/onHover'
import { generateEmbeddedLanguageDocs, getEmbeddedLanguageDocInfosOnPosition } from './embedded-languages/general-support'
import { embeddedLanguageDocsManager } from './embedded-languages/documents-manager'
import { RequestMethod, type RequestParams, type RequestResult } from './lib/src/types/requests'
import { NotificationMethod, type NotificationParams } from './lib/src/types/notifications'
// Create a connection for the server. The connection uses Node's IPC as a transport
const connection: Connection = createConnection(ProposedFeatures.all)
const documents = new TextDocuments<TextDocument>(TextDocument)
let workspaceRoot: string = ''

connection.onInitialize(async (params: InitializeParams): Promise<InitializeResult> => {
  logger.level = 'debug'
  logger.info('[onInitialize] Initializing connection')
  workspaceRoot = new URL(params.workspaceFolders?.[0]?.uri ?? '').pathname
  setNotificationManagerConnection(connection)
  setBitBakeProjectScannerConnection(connection)

  const storagePath = params.initializationOptions.storagePath as string
  const extensionPath = params.initializationOptions.extensionPath as string

  await embeddedLanguageDocsManager.setStoragePath(storagePath)

  logger.info('[onInitialize] Setting yocto doc path and parsing doc files')
  bitBakeDocScanner.setDocPathAndParse(extensionPath)

  const parser = await generateParser()
  analyzer.initialize(parser)

  return {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      completionProvider: {
        resolveProvider: true,
        triggerCharacters: [':', '[']
      },
      definitionProvider: true,
      executeCommandProvider: {
        commands: [
          'bitbake.rescan-project'
        ]
      },
      hoverProvider: true
    }
  }
})

function setSymbolScanner (newSymbolScanner: SymbolScanner | null): void {
  logger.debug('set new symbol scanner')
  contextHandler.symbolScanner = newSymbolScanner
}

function checkBitbakeSettingsSanity (): boolean {
  const bitbakeFolder = bitBakeProjectScanner.bitbakeDriver.bitbakeSettings.pathToBitbakeFolder
  const bitbakeBinPath = bitbakeFolder + '/bin/bitbake'

  if (!fs.existsSync(bitbakeBinPath)) {
    serverNotificationManager.sendBitBakeSettingsError("Bitbake binary doesn't exist: " + bitbakeBinPath)
    return false
  }

  const pathToEnvScript = bitBakeProjectScanner.bitbakeDriver.bitbakeSettings.pathToEnvScript
  if (!fs.existsSync(pathToEnvScript)) {
    serverNotificationManager.sendBitBakeSettingsError("Bitbake environment script doesn't exist: " + pathToEnvScript)
    return false
  }

  return true
}

connection.onDidChangeConfiguration((change) => {
  logger.level = change.settings.bitbake.loggingLevel
  bitBakeProjectScanner.loadSettings(change.settings.bitbake, workspaceRoot)
  checkBitbakeSettingsSanity()
  bitBakeProjectScanner.rescanProject()
})

connection.onDidChangeWatchedFiles((change) => {
  logger.debug(`onDidChangeWatchedFiles: ${JSON.stringify(change)}`)
  change.changes?.forEach((change) => {
    if (change.type === FileChangeType.Deleted) {
      void embeddedLanguageDocsManager.deleteEmbeddedLanguageDocs(change.uri)
    }
  })
  bitBakeProjectScanner.rescanProject()
})

connection.onCompletion(onCompletionHandler)

connection.onCompletionResolve((item: CompletionItem): CompletionItem => {
  logger.debug(`onCompletionResolve: ${JSON.stringify(item)}`)
  // TODO: An alternative: Currently it just returns the completion items created when onCompletion fires. Maybe here can be good place to get the documentation for completion items instead of getting all of the documentation at startup.
  return item
})

connection.onExecuteCommand((params) => {
  logger.info(`executeCommand ${JSON.stringify(params)}`)

  if (params.command === 'bitbake.rescan-project') {
    void bitBakeProjectScanner.rescanProject()
  }
})

connection.onDefinition(onDefinitionHandler)

connection.onHover(onHoverHandler)

connection.onRequest(
  RequestMethod.EmbeddedLanguageDocInfos,
  async ({ uriString, position }: RequestParams['EmbeddedLanguageDocInfos']): RequestResult['EmbeddedLanguageDocInfos'] => {
    return getEmbeddedLanguageDocInfosOnPosition(uriString, position)
  }
)

connection.onNotification(
  NotificationMethod.FilenameChanged,
  ({ oldUriString, newUriString }: NotificationParams['FilenameChanged']): void => {
    embeddedLanguageDocsManager.renameEmbeddedLanguageDocs(oldUriString, newUriString)
  }
)

connection.listen()

documents.onDidChangeContent(async (event) => {
  const textDocument = event.document

  setSymbolScanner(new SymbolScanner(textDocument.uri, contextHandler.definitionProvider))

  if (textDocument.getText().length > 0) {
    const diagnostics = await analyzer.analyze({ document: textDocument, uri: textDocument.uri })
    void generateEmbeddedLanguageDocs(event.document)
    void connection.sendDiagnostics({ uri: textDocument.uri, diagnostics })
  }

  // Other language extensions might also associate .conf files with their langauge modes
  if (textDocument.uri.endsWith('.conf')) {
    logger.debug('verifyConfigurationFileAssociation')
    await connection.sendRequest('custom/verifyConfigurationFileAssociation', { filePath: new URL(textDocument.uri).pathname })
  }
})

documents.onDidClose((event) => {
  setSymbolScanner(null)
})

documents.onDidSave((event) => {
  logger.debug(`onDidSave ${JSON.stringify(event)}`)
  bitBakeProjectScanner.parseAllRecipes()
})

documents.listen(connection)
