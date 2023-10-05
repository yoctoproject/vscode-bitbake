/* --------------------------------------------------------------------------------------------
 * Copyright (c) Eugen Wiens. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import {
  createConnection,
  type Connection,
  TextDocuments,
  type InitializeResult,
  type TextDocumentPositionParams,
  type CompletionItem,
  type Definition,
  ProposedFeatures,
  TextDocumentSyncKind,
  type Hover
} from 'vscode-languageserver/node'
import { BitBakeDocScanner } from './BitBakeDocScanner'
import { BitBakeProjectScanner } from './BitBakeProjectScanner'
import { ContextHandler } from './ContextHandler'
import { SymbolScanner } from './SymbolScanner'
import { TextDocument } from 'vscode-languageserver-textdocument'
import logger from 'winston'

// Create a connection for the server. The connection uses Node's IPC as a transport
const connection: Connection = createConnection(ProposedFeatures.all)
const documents = new TextDocuments<TextDocument>(TextDocument)
const documentAsTextMap = new Map< string, string[] >()
const bitBakeDocScanner = new BitBakeDocScanner()
const bitBakeProjectScanner: BitBakeProjectScanner = new BitBakeProjectScanner(connection)
const contextHandler: ContextHandler = new ContextHandler(bitBakeProjectScanner)

connection.onInitialize((params): InitializeResult => {
  const workspaceRoot = params.rootPath ?? ''
  bitBakeProjectScanner.setProjectPath(workspaceRoot)

  setTimeout(() => {
    bitBakeProjectScanner.rescanProject()
  }, 500)

  return {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      completionProvider: {
        resolveProvider: true
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
  bitBakeDocScanner.parse(settings.bitbake.pathToBitbakeFolder)
})

connection.onDidChangeWatchedFiles((change) => {
  logger.debug(`onDidChangeWatchedFiles: ${JSON.stringify(change)}`)
  bitBakeProjectScanner.rescanProject()
})

connection.onCompletion((textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
  logger.debug('onCompletion')
  const documentAsText = documentAsTextMap.get(textDocumentPosition.textDocument.uri)
  if (documentAsText === undefined) {
    return []
  }
  return contextHandler.getComletionItems(textDocumentPosition, documentAsText)
})

connection.onCompletionResolve((item: CompletionItem): CompletionItem => {
  logger.debug(`onCompletionResolve ${JSON.stringify(item)}`)

  item.insertText = contextHandler.getInsertStringForTheElement(item)

  return item
})

connection.onExecuteCommand((params) => {
  logger.info(`executeCommand ${JSON.stringify(params)}`)

  if (params.command === 'bitbake.rescan-project') {
    bitBakeProjectScanner.rescanProject()
  }
})

connection.onDefinition((textDocumentPositionParams: TextDocumentPositionParams): Definition => {
  logger.debug(`onDefinition ${JSON.stringify(textDocumentPositionParams)}`)
  const documentAsText = documentAsTextMap.get(textDocumentPositionParams.textDocument.uri)

  if (documentAsText === undefined) {
    return []
  }

  return contextHandler.getDefinition(textDocumentPositionParams, documentAsText)
})

connection.onHover(async (params): Promise<Hover | undefined> => {
  const { position, textDocument } = params
  const documentAsText = documentAsTextMap.get(textDocument.uri)
  const textLine = documentAsText?.[position.line]
  if (textLine === undefined) {
    return undefined
  }
  const matches = textLine.matchAll(bitBakeDocScanner.variablesRegex)
  for (const match of matches) {
    const name = match[1].toUpperCase()
    if (name === undefined || match.index === undefined) {
      continue
    }
    const start = match.index
    const end = start + name.length
    if ((start > position.character) || (end <= position.character)) {
      continue
    }

    const definition = bitBakeDocScanner.variablesInfos[name]?.definition
    const hover: Hover = {
      contents: {
        kind: 'markdown',
        value: `**${name}**\n___\n${definition}`
      },
      range: {
        start: position,
        end: {
          ...position,
          character: end
        }
      }
    }
    return hover
  }
})

connection.listen()

documents.onDidOpen((event) => {
  const textDocument = event.document
  if (textDocument.getText().length > 0) {
    documentAsTextMap.set(textDocument.uri, textDocument.getText().split(/\r?\n/g))
  }

  setSymbolScanner(new SymbolScanner(textDocument.uri, contextHandler.definitionProvider))
})

documents.onDidChangeContent((event) => {
  const textDocument = event.document
  documentAsTextMap.set(textDocument.uri, textDocument.getText().split(/\r?\n/g))

  setSymbolScanner(new SymbolScanner(textDocument.uri, contextHandler.definitionProvider))
})

documents.onDidClose((event) => {
  documentAsTextMap.delete(event.document.uri)
  setSymbolScanner(null)
})

documents.onDidSave((event) => {
  logger.debug(`onDidSave ${JSON.stringify(event)}`)
  bitBakeProjectScanner.parseAllRecipes()
})

documents.listen(connection)
