/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import vscode from 'vscode'
import { requestsManager } from './RequestManager'
import { embeddedLanguageDocsManager } from './EmbeddedLanguageDocsManager'
import { getEmbeddedLanguageDocRange, getOriginalDocPosition } from './utils/embeddedLanguagesUtils'
import { logger } from '../lib/src/utils/OutputLogger'
import { type Range } from 'vscode-languageclient'
import { type EmbeddedLanguageType } from '../lib/src/types/embedded-languages'
import { getIndentationOnLine } from './utils/textDocumentUtils'

export class BitbakeCodeActionProvider implements vscode.CodeActionProvider {
  async provideCodeActions (document: vscode.TextDocument, range: vscode.Range | vscode.Selection, context: vscode.CodeActionContext, token: vscode.CancellationToken): Promise<vscode.CodeAction[]> {
    const diagnostics = context.diagnostics
    const actions = await Promise.all(
      diagnostics.map(async (diagnostic) => await buildActionFromDiagnostic(document, diagnostic))
    ).then((results) => results.flat())
    return actions
  }
}

const buildActionFromDiagnostic = async (document: vscode.TextDocument, diagnostic: vscode.Diagnostic): Promise<vscode.CodeAction[]> => {
  const originalRange = diagnostic.range
  const embeddedLanguageType = await requestsManager.getEmbeddedLanguageTypeOnPosition(document.uri.toString(), originalRange.start)
  if (embeddedLanguageType === undefined || embeddedLanguageType === null) {
    // We currently do not provide fixes for the Bitbake language, we only forwards embedded language fixes
    return []
  } else {
    return await buildActionFromEmbeddedLanguageDiagnostic(document, originalRange, embeddedLanguageType)
  }
}

const buildActionFromEmbeddedLanguageDiagnostic = async (
  document: vscode.TextDocument,
  originalRange: vscode.Range,
  embeddedLanguageType: EmbeddedLanguageType
): Promise<vscode.CodeAction[]> => {
  const embeddedLanguageDocInfos = embeddedLanguageDocsManager.getEmbeddedLanguageDocInfos(document.uri, embeddedLanguageType)
  if (embeddedLanguageDocInfos === undefined || embeddedLanguageDocInfos === null) {
    return []
  }
  const embeddedLanguageTextDocument = await vscode.workspace.openTextDocument(embeddedLanguageDocInfos.uri)
  const embeddedRange = getEmbeddedLanguageDocRange(
    document,
    embeddedLanguageTextDocument,
    embeddedLanguageDocInfos.characterIndexes,
    originalRange
  )

  const tempActions = await vscode.commands.executeCommand<vscode.CodeAction[]>(
    'vscode.executeCodeActionProvider',
    embeddedLanguageDocInfos.uri,
    embeddedRange
  )

  const actions: vscode.CodeAction[] = []
  tempActions.forEach((action) => {
    switch (action.command?.command) {
      case 'python.addImport':
        handlePythonAddImport(action, document, embeddedLanguageTextDocument, embeddedLanguageDocInfos.characterIndexes)
        break
      default:
        return
    }
    actions.push(action)
  })

  return actions
}

type PythonAddImportArguments = [
  path: string,
  range: Range,
  targetName: string,
  moduleName: string | null,
]
const handlePythonAddImport = (
  action: vscode.CodeAction,
  originalTextDocument: vscode.TextDocument,
  embeddedLanguageTextDocument: vscode.TextDocument,
  characterIndexes: number[]
): void => {
  if (action.command === undefined) {
    return
  }
  if (action.command?.command !== 'python.addImport') {
    logger.error(`[handlePythonAddImport] Invalid command ${action.command?.command} (should be 'python.addImport')`)
    return
  }
  const [, range, targetName, moduleName] = action.command?.arguments as PythonAddImportArguments
  const originalStartPosition = getOriginalDocPosition(
    originalTextDocument,
    embeddedLanguageTextDocument,
    characterIndexes,
    new vscode.Position(range.start.line, range.start.character)
  )
  if (originalStartPosition === undefined) {
    return
  }
  const indentationOnLine = getIndentationOnLine(originalTextDocument, originalStartPosition.line)
  const moduleSpecification = moduleName !== null ? `from ${moduleName} ` : ''
  const workspaceEdit = new vscode.WorkspaceEdit()
  workspaceEdit.insert(
    originalTextDocument.uri,
    new vscode.Position(originalStartPosition.line, 0),
    `${indentationOnLine}${moduleSpecification}import ${targetName}\n`
  )
  delete action.command
  action.edit = workspaceEdit
}
