/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as vscode from 'vscode'

import { getOriginalDocRange } from './utils'
import { embeddedLanguageDocsManager } from './EmbeddedLanguageDocsManager'
import { type EmbeddedLanguageType } from '../lib/src/types/embedded-languages'

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
  const originalTextDocument = await vscode.workspace.openTextDocument(originalUri)
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
    originalTextDocument.uri.toString(),
    embeddedLanguageType
  )
  if (embeddedLanguageDocInfos?.uri === undefined) {
    return
  }
  const embeddedLanguageDoc = await vscode.workspace.openTextDocument(embeddedLanguageDocInfos.uri.fsPath)
  const dirtyDiagnostics = vscode.languages.getDiagnostics(embeddedLanguageDocInfos.uri)
  const cleanDiagnostics: vscode.Diagnostic[] = []
  dirtyDiagnostics.forEach((diagnostic) => {
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
