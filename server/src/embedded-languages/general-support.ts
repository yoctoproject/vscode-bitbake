/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { type TextDocument } from 'vscode-languageserver-textdocument'
import { type Position } from 'vscode-languageserver'

import { generateBashEmbeddedLanguageDoc } from './bash-support'
import { generatePythonEmbeddedLanguageDoc } from './python-support'
import { embeddedLanguageDocsManager } from './documents-manager'
import { isInsideBashRegion, isInsidePythonRegion } from './utils'

export const generateEmbeddedLanguageDocs = async (textDocument: TextDocument): Promise<void> => {
  await Promise.all([
    generateBashEmbeddedLanguageDoc(textDocument),
    generatePythonEmbeddedLanguageDoc(textDocument)
  ])
}

export const getEmbeddedLanguageDocInfosOnPosition = (uriString: string, position: Position): { uri: string, lineOffset: number } | undefined => {
  if (isInsideBashRegion(uriString, position)) {
    const documentInfos = embeddedLanguageDocsManager.getEmbeddedLanguageDocInfos(uriString, 'bash')
    return documentInfos
  }
  if (isInsidePythonRegion(uriString, position)) {
    const documentInfos = embeddedLanguageDocsManager.getEmbeddedLanguageDocInfos(uriString, 'python')
    return documentInfos
  }
  return undefined
}
