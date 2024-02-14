/* --------------------------------------------------------------------------------------------
 * Copyright (c) Eugen Wiens. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import path from 'path'
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
  type TextDocumentChangeEvent
} from 'vscode-languageserver/node'
import { bitBakeDocScanner } from './BitBakeDocScanner'
import { TextDocument } from 'vscode-languageserver-textdocument'
import { analyzer } from './tree-sitter/analyzer'
import { generateParser } from './tree-sitter/parser'
import { logger } from './lib/src/utils/OutputLogger'
import { onCompletionHandler } from './connectionHandlers/onCompletion'
import { onDefinitionHandler } from './connectionHandlers/onDefinition'
import { onHoverHandler } from './connectionHandlers/onHover'
import { generateEmbeddedLanguageDocs, getEmbeddedLanguageTypeOnPosition } from './embedded-languages/general-support'
import { getSemanticTokens, legend } from './semanticTokens'
import { bitBakeProjectScannerClient } from './BitbakeProjectScannerClient'
import { RequestMethod, type RequestParams, type RequestResult } from './lib/src/types/requests'
import { NotificationMethod, type NotificationParams } from './lib/src/types/notifications'
import { expandSettingPath } from './lib/src/BitbakeSettings'
import { extractRecipeName } from './lib/src/utils/files'

// Create a connection for the server. The connection uses Node's IPC as a transport
const connection: Connection = createConnection(ProposedFeatures.all)
const documents = new TextDocuments<TextDocument>(TextDocument)
let parseOnSave = true
let workspaceFolder: string | undefined
let pokyFolder: string | undefined

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

  workspaceFolder = params.workspaceFolders?.[0].uri.replace('file://', '')

  const extensionPath = params.initializationOptions.extensionPath as string

  logger.info('[onInitialize] Setting yocto doc path and parsing doc files')
  bitBakeDocScanner.setDocPathAndParse(extensionPath)

  const parser = await generateParser()
  analyzer.initialize(parser)

  bitBakeProjectScannerClient.onChange.on('scanReady', () => {
    logger.debug('Analyzing the current document again...')
    analyzer.analyze({ document: currentActiveTextDocument, uri: currentActiveTextDocument.uri })
  })

  return {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      completionProvider: {
        resolveProvider: true,
        triggerCharacters: [':', '[']
      },
      definitionProvider: true,
      referencesProvider: true,
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

connection.onDidChangeConfiguration((change) => {
  logger.level = change.settings.bitbake.loggingLevel
  parseOnSave = change.settings.bitbake.parseOnSave
  const bitbakeFolder = expandSettingPath(change.settings.bitbake.pathToBitbakeFolder, { workspaceFolder })
  if (bitbakeFolder !== undefined) {
    pokyFolder = path.join(bitbakeFolder, '..') // We assume BitBake is into Poky
  }
})

connection.onCompletion(onCompletionHandler)

connection.onCompletionResolve((item: CompletionItem): CompletionItem => {
  logger.debug(`[onCompletionResolve]: ${JSON.stringify(item)}`)
  return item
})

connection.onDefinition(onDefinitionHandler)
// We only provide definitions, references like "${SRC_URI}" are not handled by this extension
connection.onReferences(onDefinitionHandler)

connection.onHover(onHoverHandler)

connection.onRequest(
  RequestMethod.EmbeddedLanguageTypeOnPosition,
  async ({ uriString, position }: RequestParams['EmbeddedLanguageTypeOnPosition']): RequestResult['EmbeddedLanguageTypeOnPosition'] => {
    return getEmbeddedLanguageTypeOnPosition(uriString, position)
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

connection.onNotification(RequestMethod.ProcessRecipeScanResults, (param: RequestParams['ProcessRecipeScanResults']) => {
  logger.debug(`[onNotification] <ProcessRecipeScanResults> uri:  ${JSON.stringify(param.uri)} recipe: ${param.chosenRecipe}`)
  analyzer.processRecipeScanResults(param.scanResults, param.uri, param.chosenRecipe)
})

connection.listen()

const analyzeDocument = async (event: TextDocumentChangeEvent<TextDocument>): Promise<void> => {
  const textDocument = event.document
  const previousVersion = analyzer.getAnalyzedDocument(textDocument.uri)?.version ?? -1
  if (textDocument.getText().length > 0 && previousVersion < textDocument.version) {
    const diagnostics = analyzer.analyze({ document: textDocument, uri: textDocument.uri })
    const embeddedLanguageDocs: NotificationParams['EmbeddedLanguageDocs'] | undefined = generateEmbeddedLanguageDocs(event.document, pokyFolder)
    if (embeddedLanguageDocs !== undefined) {
      void connection.sendNotification(NotificationMethod.EmbeddedLanguageDocs, embeddedLanguageDocs)
    }
    void connection.sendDiagnostics({ uri: textDocument.uri, diagnostics })
  }

  currentActiveTextDocument = textDocument

  // Other language extensions might also associate .conf files with their langauge modes
  if (textDocument.uri.endsWith('.conf')) {
    // get decoded urls in case of running on Windows
    const filePath = decodeURIComponent(new URL(textDocument.uri).pathname)
    logger.debug(`[Verify Configuration File Association] file uri: ${filePath}`)
    await connection.sendRequest('bitbake/verifyConfigurationFileAssociation', { filePath })
  }
}

documents.onDidOpen(analyzeDocument)

documents.onDidChangeContent(analyzeDocument)

documents.onDidSave(async (event) => {
  logger.info(`[onDidSave] Document saved: ${event.document.uri}`)
  if (parseOnSave) {
    const exts = ['.bb', '.bbappend', '.inc']
    const uri = event.document.uri

    if (exts.includes(path.extname(uri))) {
      const foundRecipe = bitBakeProjectScannerClient.bitbakeScanResult._recipes.find((recipe) => recipe.name === extractRecipeName(uri))
      if (foundRecipe !== undefined) {
        logger.debug(`[onDidSave] Running 'bitbake -e' against the saved recipe: ${foundRecipe.name}`)
        // Note that it pends only one scan at a time. See client/src/driver/BitbakeRecipeScanner.ts.
        // Saving more than 2 files at the same time could cause the server to miss some of the scans.
        void connection.sendRequest('bitbake/scanRecipe', { uri })
        return
      }
    }
    // saving other files or no recipe is resolved
    void connection.sendRequest('bitbake/parseAllRecipes')
  }
})

documents.listen(connection)
