/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { type TextDocument } from 'vscode-languageserver-textdocument'
import { type Position } from 'vscode-languageserver'

import { generateBashEmbeddedLanguageDoc } from './bash-support'
import { generatePythonEmbeddedLanguageDoc } from './python-support'
import { isInsideBashRegion, isInsidePythonRegion } from './utils'
import { type EmbeddedLanguageDoc, type EmbeddedLanguageType } from '../lib/src/types/embedded-languages'
import { analyzer } from '../tree-sitter/analyzer'

export const generateEmbeddedLanguageDocs = (textDocument: TextDocument): EmbeddedLanguageDoc[] | undefined => {
  const analyzedDocument = analyzer.getAnalyzedDocument(textDocument.uri)
  if (analyzedDocument === undefined) {
    return
  }
  return [
    generateBashEmbeddedLanguageDoc(analyzedDocument),
    generatePythonEmbeddedLanguageDoc(analyzedDocument)
  ]
}

export const getEmbeddedLanguageTypeOnPosition = (uriString: string, position: Position): EmbeddedLanguageType | undefined => {
  if (isInsideBashRegion(uriString, position)) {
    return 'bash'
  }
  if (isInsidePythonRegion(uriString, position)) {
    return 'python'
  }
  return undefined
}
