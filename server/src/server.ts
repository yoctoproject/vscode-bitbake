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
// It seems our 'documents' variable is failing to handle files properly (documents.all() gives an empty list)
// Until we manage to fix this, we use this documentMap to store the content of the files
// Does it have any other purpose?
const documentMap = new Map< string, string[] >()
const bitBakeDocScanner = new BitBakeDocScanner()
const bitBakeProjectScanner: BitBakeProjectScanner = new BitBakeProjectScanner(connection)
const contextHandler: ContextHandler = new ContextHandler(bitBakeProjectScanner)

documents.listen(connection)

connection.onInitialize((params): InitializeResult => {
  const workspaceRoot = params.rootPath ?? ''
  bitBakeProjectScanner.setProjectPath(workspaceRoot)

  setTimeout(() => {
    bitBakeProjectScanner.rescanProject()
  }, 500)

  return {
    capabilities: {
      // TODO: replace for TextDocumentSyncKind.Incremental (should be more efficient)
      // Issue is our 'documents' variable is failing to track the files
      textDocumentSync: TextDocumentSyncKind.Full,
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

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent((change) => {
  // TODO: add symbol parsing here
  // TODO: This should be called when a file is modified. Understand why it is not.
  logger.debug(`onDidChangeContent: ${JSON.stringify(change)}`)
})

// The settings interface describe the server relevant settings part
interface Settings {
  bitbake: BitbakeSettings
}

interface BitbakeSettings {
  loggingLevel: string
  deepExamine: boolean
  workingFolder: string
  pathToBashScriptInterpreter: string
  machine: string
  generateWorkingFolder: boolean
  pathToBitbakeFolder: string
}

function setSymbolScanner (newSymbolScanner: SymbolScanner | null): void {
  logger.debug('set new symbol scanner')
  contextHandler.symbolScanner = newSymbolScanner
}

connection.onDidChangeConfiguration((change) => {
  const settings = change.settings as Settings
  bitBakeProjectScanner.deepExamine = settings.bitbake.deepExamine
  logger.level = settings.bitbake.loggingLevel
  bitBakeProjectScanner.workingPath = settings.bitbake.workingFolder
  bitBakeProjectScanner.generateWorkingPath = settings.bitbake.generateWorkingFolder
  bitBakeProjectScanner.scriptInterpreter = settings.bitbake.pathToBashScriptInterpreter
  bitBakeProjectScanner.machineName = settings.bitbake.machine
  const bitBakeFolder = settings.bitbake.pathToBitbakeFolder
  bitBakeDocScanner.parse(bitBakeFolder)
})

connection.onDidChangeWatchedFiles((change) => {
  logger.debug(`onDidChangeWatchedFiles: ${JSON.stringify(change)}`)
  bitBakeProjectScanner.rescanProject()
})

connection.onCompletion((textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
  logger.debug('onCompletion')
  const documentAsStringArray = documentMap.get(textDocumentPosition.textDocument.uri)
  if (documentAsStringArray === undefined) {
    return []
  }
  return contextHandler.getComletionItems(textDocumentPosition, documentAsStringArray)
})

connection.onCompletionResolve((item: CompletionItem): CompletionItem => {
  logger.debug(`onCompletionResolve ${JSON.stringify(item)}`)

  item.insertText = contextHandler.getInsertStringForTheElement(item)

  return item
})

connection.onDidOpenTextDocument((params) => {
  if (params.textDocument.text.length > 0) {
    documentMap.set(params.textDocument.uri, params.textDocument.text.split(/\r?\n/g))
  }

  setSymbolScanner(new SymbolScanner(params.textDocument.uri, contextHandler.definitionProvider))
})

connection.onDidChangeTextDocument((params) => {
  if (params.contentChanges.length > 0) {
    documentMap.set(params.textDocument.uri, params.contentChanges[0].text.split(/\r?\n/g))
  }

  setSymbolScanner(new SymbolScanner(params.textDocument.uri, contextHandler.definitionProvider))
})

connection.onDidCloseTextDocument((params) => {
  documentMap.delete(params.textDocument.uri)
  setSymbolScanner(null)
})

connection.onDidSaveTextDocument((params) => {
  logger.debug(`onDidSaveTextDocument ${JSON.stringify(params)}`)

  bitBakeProjectScanner.parseAllRecipes()
})

connection.onExecuteCommand((params) => {
  logger.info(`executeCommand ${JSON.stringify(params)}`)

  if (params.command === 'bitbake.rescan-project') {
    bitBakeProjectScanner.rescanProject()
  }
})

connection.onDefinition((textDocumentPositionParams: TextDocumentPositionParams): Definition => {
  logger.debug(`onDefinition ${JSON.stringify(textDocumentPositionParams)}`)
  const documentAsText = documentMap.get(textDocumentPositionParams.textDocument.uri)

  if (documentAsText === undefined) {
    return []
  }

  return contextHandler.getDefinition(textDocumentPositionParams, documentAsText)
})

connection.onHover(async (params): Promise<Hover | undefined> => {
  const { position, textDocument } = params
  const documentAsText = documentMap.get(textDocument.uri)
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

// Listen on the connection
connection.listen()
