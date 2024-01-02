/* --------------------------------------------------------------------------------------------
 * Copyright (c) Eugen Wiens. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import {
  type Connection,
  type InitializeResult,
  type CompletionItem,
  type Disposable,
  createConnection,
  TextDocuments,
  ProposedFeatures,
  TextDocumentSyncKind,
  type InitializeParams,
  FileChangeType
} from 'vscode-languageserver/node'
import { bitBakeDocScanner } from './BitBakeDocScanner'
import { TextDocument } from 'vscode-languageserver-textdocument'
import { analyzer } from './tree-sitter/analyzer'
import { generateParser } from './tree-sitter/parser'
import { logger } from './lib/src/utils/OutputLogger'
import { onCompletionHandler } from './connectionHandlers/onCompletion'
import { onDefinitionHandler } from './connectionHandlers/onDefinition'
import { onHoverHandler } from './connectionHandlers/onHover'
import { generateEmbeddedLanguageDocs, getEmbeddedLanguageDocInfosOnPosition } from './embedded-languages/general-support'
import { embeddedLanguageDocsManager } from './embedded-languages/documents-manager'
import { RequestMethod, type RequestParams, type RequestResult } from './lib/src/types/requests'
import { NotificationMethod, type NotificationParams } from './lib/src/types/notifications'
import { getSemanticTokens, legend } from './semanticTokens'
import { bitBakeProjectScannerClient } from './BitbakeProjectScannerClient'

// Create a connection for the server. The connection uses Node's IPC as a transport
const connection: Connection = createConnection(ProposedFeatures.all)
const documents = new TextDocuments<TextDocument>(TextDocument)
let parseOnSave = true

const disposables: Disposable[] = []

let currentActiveTextDocument: TextDocument = TextDocument.create(
  'file://dummy_uri',
  'bitbake',
  0,
  ''
)

connection.onInitialize(async (params: InitializeParams): Promise<InitializeResult> => {
  logger.level = 'debug'
  logger.info('[onInitialize] Initializing connection')

  bitBakeProjectScannerClient.setConnection(connection)
  disposables.push(...bitBakeProjectScannerClient.buildHandlers())

  const storagePath = params.initializationOptions.storagePath as string
  const extensionPath = params.initializationOptions.extensionPath as string

  await embeddedLanguageDocsManager.setStoragePath(storagePath)

  logger.info('[onInitialize] Setting yocto doc path and parsing doc files')
  bitBakeDocScanner.setDocPathAndParse(extensionPath)

  const parser = await generateParser()
  analyzer.initialize(parser)

  bitBakeProjectScannerClient.onChange.on('scanReady', () => {
    logger.debug('[On scanReady] Analyzing the current document again...')
    void analyzer.analyze({ document: currentActiveTextDocument, uri: currentActiveTextDocument.uri })
  })

  return {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      completionProvider: {
        resolveProvider: true,
        triggerCharacters: [':', '[']
      },
      definitionProvider: true,
      hoverProvider: true,
      semanticTokensProvider: {
        legend,
        full: true
      }
    }
  }
})

connection.onShutdown(() => {
  disposables.forEach((disposable) => { disposable.dispose() })
})

// eslint-disable-next-line @typescript-eslint/no-misused-promises
connection.onDidChangeConfiguration(async (change) => {
  logger.level = change.settings.bitbake.loggingLevel
  parseOnSave = change.settings.bitbake.parseOnSave
})

// eslint-disable-next-line @typescript-eslint/no-misused-promises
connection.onDidChangeWatchedFiles(async (change) => {
  logger.debug(`onDidChangeWatchedFiles: ${JSON.stringify(change)}`)
  change.changes?.forEach((change) => {
    if (change.type === FileChangeType.Deleted) {
      void embeddedLanguageDocsManager.deleteEmbeddedLanguageDocs(change.uri)
    }
  })
})

connection.onCompletion(onCompletionHandler)

connection.onCompletionResolve((item: CompletionItem): CompletionItem => {
  logger.debug(`onCompletionResolve: ${JSON.stringify(item)}`)
  // TODO: An alternative: Currently it just returns the completion items created when onCompletion fires. Maybe here can be good place to get the documentation for completion items instead of getting all of the documentation at startup.
  return item
})

connection.onDefinition(onDefinitionHandler)

connection.onHover(onHoverHandler)

connection.onRequest(
  RequestMethod.EmbeddedLanguageDocInfos,
  async ({ uriString, position }: RequestParams['EmbeddedLanguageDocInfos']): RequestResult['EmbeddedLanguageDocInfos'] => {
    return getEmbeddedLanguageDocInfosOnPosition(uriString, position)
  }
)
// This request method 'textDocument/semanticTokens' will be sent when semanticTokensProvider capability is enabled
connection.onRequest('textDocument/semanticTokens/full', ({ textDocument }) => {
  logger.debug(`[OnRequest] <textDocument/semanticTokens/full> Document uri: ${textDocument.uri}`)
  return getSemanticTokens(textDocument.uri)
})

connection.onRequest(RequestMethod.getLinksInDocument, (params: RequestParams['getLinksInDocument']) => {
  return analyzer.getLinksInStringContent(params.documentUri)
})

connection.onNotification(
  NotificationMethod.FilenameChanged,
  ({ oldUriString, newUriString }: NotificationParams['FilenameChanged']): void => {
    embeddedLanguageDocsManager.renameEmbeddedLanguageDocs(oldUriString, newUriString)
  }
)

connection.listen()

documents.onDidChangeContent(async (event) => {
  const textDocument = event.document

  if (textDocument.getText().length > 0) {
    const diagnostics = await analyzer.analyze({ document: textDocument, uri: textDocument.uri })
    void generateEmbeddedLanguageDocs(event.document)
    void connection.sendDiagnostics({ uri: textDocument.uri, diagnostics })
  }

  currentActiveTextDocument = textDocument

  // Other language extensions might also associate .conf files with their langauge modes
  if (textDocument.uri.endsWith('.conf')) {
    logger.debug('verifyConfigurationFileAssociation')
    await connection.sendRequest('custom/verifyConfigurationFileAssociation', { filePath: new URL(textDocument.uri).pathname })
  }
})

documents.onDidSave(async (event) => {
  if (parseOnSave) {
    logger.debug(`onDidSave ${JSON.stringify(event)}`)
    void connection.sendRequest('bitbake/parseAllRecipes')
  }
})

documents.listen(connection)
