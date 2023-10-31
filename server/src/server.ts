/* --------------------------------------------------------------------------------------------
 * Copyright (c) Eugen Wiens. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import {
  type Connection,
  type InitializeResult,
  type CompletionItem,
  createConnection,
  TextDocuments,
  ProposedFeatures,
  TextDocumentSyncKind,
  type InitializeParams
} from 'vscode-languageserver/node'
import { bitBakeDocScanner } from './BitBakeDocScanner'
import bitBakeProjectScanner from './BitBakeProjectScanner'
import contextHandler from './ContextHandler'
import { SymbolScanner } from './SymbolScanner'
import { TextDocument } from 'vscode-languageserver-textdocument'
import { analyzer } from './tree-sitter/analyzer'
import { generateParser } from './tree-sitter/parser'
import logger from 'winston'
import { onCompletionHandler } from './connectionHandlers/onCompletion'
import { onDefinitionHandler } from './connectionHandlers/onDefinition'
import { setOutputParserConnection } from './OutputParser'
import { setNotificationManagerConnection } from './ServerNotificationManager'
import { onHoverHandler } from './connectionHandlers/onHover'
// Create a connection for the server. The connection uses Node's IPC as a transport
const connection: Connection = createConnection(ProposedFeatures.all)
const documents = new TextDocuments<TextDocument>(TextDocument)

connection.onInitialize(async (params: InitializeParams): Promise<InitializeResult> => {
  const workspaceRoot = params.workspaceFolders?.[0]?.uri ?? ''
  bitBakeProjectScanner.setProjectPath(workspaceRoot)

  setOutputParserConnection(connection)
  setNotificationManagerConnection(connection)

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

// The settings interface describe the server relevant settings part
interface Settings {
  bitbake: BitbakeSettings
}

interface BitbakeSettings {
  loggingLevel: string
  shouldDeepExamine: boolean
  pathToEnvScript: string
  pathToBuildFolder: string
  pathToBitbakeFolder: string
}

function setSymbolScanner (newSymbolScanner: SymbolScanner | null): void {
  logger.debug('set new symbol scanner')
  contextHandler.symbolScanner = newSymbolScanner
}

connection.onDidChangeConfiguration((change) => {
  const settings = change.settings as Settings
  bitBakeProjectScanner.shouldDeepExamine = settings.bitbake.shouldDeepExamine
  logger.level = settings.bitbake.loggingLevel
  bitBakeProjectScanner.pathToBuildFolder = settings.bitbake.pathToBuildFolder
  bitBakeProjectScanner.pathToBitbakeFolder = settings.bitbake.pathToBitbakeFolder
  bitBakeDocScanner.parseVariablesFile(settings.bitbake.pathToBitbakeFolder)
  bitBakeDocScanner.parseVariableFlagFile(settings.bitbake.pathToBitbakeFolder)
  bitBakeProjectScanner.rescanProject()
})

connection.onDidChangeWatchedFiles((change) => {
  logger.debug(`onDidChangeWatchedFiles: ${JSON.stringify(change)}`)
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

connection.listen()

documents.onDidChangeContent(async (event) => {
  const textDocument = event.document

  setSymbolScanner(new SymbolScanner(textDocument.uri, contextHandler.definitionProvider))

  if (textDocument.getText().length > 0) {
    const diagnostics = await analyzer.analyze({ document: textDocument, uri: textDocument.uri })
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
