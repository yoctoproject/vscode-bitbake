/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as vscode from 'vscode'

import { getOriginalDocRange } from './utils'
import { embeddedLanguageDocsManager } from './EmbeddedLanguageDocsManager'
import { type EmbeddedLanguageType } from '../lib/src/types/embedded-languages'
import { requestsManager } from '../language/RequestManager'
import path from 'path'
import { extractRecipeName } from '../lib/src/utils/files'
import { logger } from '../lib/src/utils/OutputLogger'

const diagnosticCollections = {
  bash: vscode.languages.createDiagnosticCollection('bitbake-bash'),
  python: vscode.languages.createDiagnosticCollection('bitbake-python')
}

// Create diagnostics for an "original document" from the diagnostics of its "embedded language documents"
// This is intended to be called when the diagnostics of the "embedded language documents" are updated
export const handleEmbeddedLanguageDocumentDiagnostics = async (uri: vscode.Uri): Promise<void> => {
  logger.debug(`[handleEmbeddedLanguageDocumentDiagnostics] for uri: ${uri.toString()}`)
  const embeddedLanguageType = getEmbeddedLanguageType(uri)
  if (embeddedLanguageType === undefined) {
    return
  }
  const originalUri = embeddedLanguageDocsManager.getOriginalUri(uri)
  if (originalUri === undefined) {
    return
  }
  const originalTextDocument = vscode.workspace.textDocuments.find((textDocument) => textDocument.uri.toString() === originalUri.toString())
  if (originalTextDocument === undefined) {
    // The original TextDocument is probably closed. Thus the user would not see the diagnostics anyway.
    // We don't attempt to reopen it. We were previously doing so, and it was causing trouble. Here what we assume was going on:
    // At first everything looked fine, but it became an issue when too many files had been opened (around thirty).
    // The oldest files were being "garbage collected", then immediately reopened, which would cause the next oldest files to be "garbage collected", and so on.
    // The whole thing would create lot of flickering in the diagnostics, and make the extension slow.
    return
  }

  const embeddedLanguageDocInfos = embeddedLanguageDocsManager.getEmbeddedLanguageDocInfos(
    originalTextDocument.uri,
    embeddedLanguageType
  )
  if (embeddedLanguageDocInfos === undefined) {
    return
  }
  const embeddedLanguageDoc = await vscode.workspace.openTextDocument(embeddedLanguageDocInfos.uri.fsPath)
  const dirtyDiagnostics = vscode.languages.getDiagnostics(embeddedLanguageDocInfos.uri)
  const cleanDiagnostics: vscode.Diagnostic[] = []
  const diagnosticCollection = diagnosticCollections[embeddedLanguageType]
  await Promise.all(dirtyDiagnostics.map(async (diagnostic) => {
    if (await checkIsIgnoredShellcheckSc2154(diagnostic, originalUri)) {
      return
    }
    if (diagnostic.range === undefined) {
      cleanDiagnostics.push(diagnostic)
    }
    const newRange = getOriginalDocRange(
      originalTextDocument,
      embeddedLanguageDoc,
      embeddedLanguageDocInfos.characterIndexes,
      diagnostic.range
    )
    if (newRange === undefined) {
      return
    }
    const newDiagnostic = {
      ...diagnostic,
      range: newRange,
      source: `${diagnostic.source}, ${diagnosticCollection.name}`
    }
    cleanDiagnostics.push(newDiagnostic)
  }))
  diagnosticCollection.set(originalTextDocument.uri, cleanDiagnostics)
}

// Review diagnostics that already exist for the documents of a recipe
// This is intended to be called when a new scan finished, so diagnostics can be updated with the available information.
export const reviewRecipeDiagnostics = async (recipeName: string): Promise<void> => {
  logger.debug(`[reviewRecipeDiagnostics] for recipe: ${recipeName}`)
  const allDiagnostics = vscode.languages.getDiagnostics()
  await Promise.all(allDiagnostics.map(async ([uri, diagnostics]): Promise<void> => {
    const embeddedLanguageType = getEmbeddedLanguageType(uri)
    if (embeddedLanguageType !== undefined) {
      // We update only diagnostics of original documents
      return
    }
    if (extractRecipeName(uri.fsPath) !== recipeName) {
      return
    }
    const newBashDiagnostics: vscode.Diagnostic[] = []
    await Promise.all(diagnostics.map(async (diagnostic): Promise<void> => {
      if (diagnostic.source?.includes(diagnosticCollections.bash.name) === true) {
        if (await checkIsIgnoredShellcheckSc2154(diagnostic, uri)) {
          return
        }
        newBashDiagnostics.push(diagnostic)
      }
    }))
    diagnosticCollections.bash.set(uri, newBashDiagnostics)
  }))
}

const getEmbeddedLanguageType = (uri: vscode.Uri): EmbeddedLanguageType | undefined => {
  const fileExtension = path.extname(uri.fsPath)
  if (fileExtension === '.py') {
    return 'python'
  }
  if (fileExtension === '.sh') {
    return 'bash'
  }
  return undefined
}

const checkIsIgnoredShellcheckSc2154 = async (diagnostic: vscode.Diagnostic, originalUri: vscode.Uri): Promise<boolean> => {
  if (diagnostic.source?.includes('shellcheck') !== true && diagnostic.code !== 'SC2154') {
    return false
  }
  const message = diagnostic.message
  const match = message.match(/^(?<variableName>\w+) is referenced but not assigned\.$/)
  const variableName = match?.groups?.variableName
  if (variableName === undefined) {
    return false
  }
  const recipeName = extractRecipeName(originalUri.fsPath)
  const isSymbolDefinedInRecipe = await requestsManager.checkIsSymbolDefinedInRecipe(recipeName, variableName)
  return isSymbolDefinedInRecipe === true
}
