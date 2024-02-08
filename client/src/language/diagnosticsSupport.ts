/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as vscode from 'vscode'

import { getOriginalDocRange } from './utils'
import { embeddedLanguageDocsManager } from './EmbeddedLanguageDocsManager'
import { type EmbeddedLanguageType } from '../lib/src/types/embedded-languages'
import { commonDirectoriesVariables } from '../lib/src/availableVariables'

const diagnosticCollections = {
  bash: vscode.languages.createDiagnosticCollection('bitbake-bash'),
  python: vscode.languages.createDiagnosticCollection('bitbake-python')
}

export const updateDiagnostics = async (uri: vscode.Uri): Promise<void> => {
  if (!uri.path.endsWith('.py') && !uri.path.endsWith('.sh')) {
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
  await Promise.all([
    setEmbeddedLanguageDocDiagnostics(originalTextDocument, 'bash'),
    setEmbeddedLanguageDocDiagnostics(originalTextDocument, 'python')
  ])
}

const setEmbeddedLanguageDocDiagnostics = async (
  originalTextDocument: vscode.TextDocument,
  embeddedLanguageType: EmbeddedLanguageType
): Promise<void> => {
  const embeddedLanguageDocInfos = embeddedLanguageDocsManager.getEmbeddedLanguageDocInfos(
    originalTextDocument.uri,
    embeddedLanguageType
  )
  if (embeddedLanguageDocInfos?.uri === undefined) {
    return
  }
  const embeddedLanguageDoc = await vscode.workspace.openTextDocument(embeddedLanguageDocInfos.uri.fsPath)
  const dirtyDiagnostics = vscode.languages.getDiagnostics(embeddedLanguageDocInfos.uri)
  const cleanDiagnostics: vscode.Diagnostic[] = []
  dirtyDiagnostics.forEach((diagnostic) => {
    if (checkIsIgnoredShellcheckSc2154(diagnostic)) {
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
      range: newRange
    }
    cleanDiagnostics.push(newDiagnostic)
  })
  const diagnosticCollection = diagnosticCollections[embeddedLanguageType]
  diagnosticCollection.set(originalTextDocument.uri, cleanDiagnostics)
}

const checkIsIgnoredShellcheckSc2154 = (diagnostic: vscode.Diagnostic): boolean => {
  if (diagnostic.source !== 'shellcheck' && diagnostic.code !== 'SC2154') {
    return false
  }
  const message = diagnostic.message
  const match = message.match(/^(?<variableName>\w+) is referenced but not assigned\.$/)
  const variableName = match?.groups?.variableName
  if (variableName === undefined) {
    return false
  }
  return commonDirectoriesVariables.has(variableName)
}
