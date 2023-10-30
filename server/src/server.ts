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
  type Position,
  FileChangeType
} from 'vscode-languageserver/node'
import { bitBakeDocScanner } from './BitBakeDocScanner'
import bitBakeProjectScanner from './BitBakeProjectScanner'
import contextHandler from './ContextHandler'
import { SymbolScanner } from './SymbolScanner'
import { TextDocument } from 'vscode-languageserver-textdocument'
import { analyzer } from './tree-sitter/analyzer'
import { generateParser } from './tree-sitter/parser'
import { logger } from './lib/src/utils/OutputLogger'
import { onCompletionHandler } from './connectionHandlers/onCompletion'
import { onDefinitionHandler } from './connectionHandlers/onDefinition'
import { setOutputParserConnection } from './OutputParser'
import { setNotificationManagerConnection, serverNotificationManager } from './ServerNotificationManager'
import { onHoverHandler } from './connectionHandlers/onHover'
import { generateEmbeddedLanguageDocs, getEmbeddedLanguageDocInfosOnPosition } from './embedded-languages/general-support'
import { embeddedLanguageDocsManager } from './embedded-languages/documents-manager'
// Create a connection for the server. The connection uses Node's IPC as a transport
const connection: Connection = createConnection(ProposedFeatures.all)
const documents = new TextDocuments<TextDocument>(TextDocument)
let workspaceRoot: string = ''

connection.onInitialize(async (params: InitializeParams): Promise<InitializeResult> => {
  workspaceRoot = new URL(params.workspaceFolders?.[0]?.uri ?? '').pathname

  setOutputParserConnection(connection)
  setNotificationManagerConnection(connection)

  const storagePath = params.initializationOptions.storagePath as string
  embeddedLanguageDocsManager.storagePath = storagePath

  const parser = await generateParser()
  analyzer.initialize(parser)

  bitBakeDocScanner.parseYoctoTaskFile()

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

function checkBitbakePresence (): void {
  const bitbakeFolder = bitBakeProjectScanner.bitbakeDriver.bitbakeSettings.pathToBitbakeFolder
  const bitbakeBinPath = bitbakeFolder + '/bin/bitbake'

  if (!fs.existsSync(bitbakeBinPath)) {
    serverNotificationManager.sendBitBakeNotFound()
  }
}

connection.onDidChangeConfiguration((change) => {
  logger.level = change.settings.bitbake.loggingLevel
  bitBakeProjectScanner.loadSettings(change.settings.bitbake, workspaceRoot)
  bitBakeDocScanner.parseVariablesFile(bitBakeProjectScanner.bitbakeDriver.bitbakeSettings.pathToBitbakeFolder)
  bitBakeDocScanner.parseVariableFlagFile(bitBakeProjectScanner.bitbakeDriver.bitbakeSettings.pathToBitbakeFolder)
  checkBitbakePresence()
  bitBakeProjectScanner.rescanProject()
})

connection.onDidChangeWatchedFiles((change) => {
  logger.debug(`onDidChangeWatchedFiles: ${JSON.stringify(change)}`)
  change.changes?.forEach((change) => {
    if (change.type === FileChangeType.Deleted) {
      embeddedLanguageDocsManager.deleteEmbeddedLanguageDocs(change.uri)
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
    bitBakeProjectScanner.rescanProject()
  }
})

connection.onDefinition(onDefinitionHandler)

connection.onHover(onHoverHandler)

connection.onRequest('custom/getEmbeddedLanguageDocInfos', async ({ uriString, position }: { uriString: string, position: Position }): Promise<{ uri: string, lineOffset: number } | undefined> => {
  return getEmbeddedLanguageDocInfosOnPosition(uriString, position)
})

connection.onNotification('custom/fileNameChanged', ({ oldUriString, newUriString }: { oldUriString: string, newUriString: string }): void => {
  embeddedLanguageDocsManager.moveEmbeddedLanguageDocs(oldUriString, newUriString)
})

connection.listen()

documents.onDidChangeContent(async (event) => {
  const textDocument = event.document

  setSymbolScanner(new SymbolScanner(textDocument.uri, contextHandler.definitionProvider))

  if (textDocument.getText().length > 0) {
    const diagnostics = await analyzer.analyze({ document: textDocument, uri: textDocument.uri })
    generateEmbeddedLanguageDocs(event.document)
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
