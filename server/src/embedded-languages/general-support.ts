/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { type TextDocument } from 'vscode-languageserver-textdocument'
import { type Position } from 'vscode-languageserver'

import { generateBashEmbeddedLanguageDoc } from './bash-support'
import { generatePythonEmbeddedLanguageDoc } from './python-support'
import { type EmbeddedLanguageDoc, type EmbeddedLanguageType } from '../lib/src/types/embedded-languages'
import { analyzer } from '../tree-sitter/analyzer'

export const generateEmbeddedLanguageDocs = (textDocument: TextDocument, pokyFolder?: string): EmbeddedLanguageDoc[] | undefined => {
  const analyzedDocument = analyzer.getAnalyzedDocument(textDocument.uri)
  if (analyzedDocument === undefined) {
    return
  }
  return [
    generateBashEmbeddedLanguageDoc(
      analyzedDocument.document,
      analyzedDocument.bitBakeTree,
      false,
      pokyFolder
    ),
    generatePythonEmbeddedLanguageDoc(
      analyzedDocument.document,
      analyzedDocument.bitBakeTree
    )
  ]
}

export const getEmbeddedLanguageTypeOnPosition = (uriString: string, position: Position): EmbeddedLanguageType | undefined => {
  const bitBakeNode = analyzer.bitBakeNodeAtPoint(uriString, position.line, position.character)
  if (bitBakeNode === null) {
    return undefined
  }

  if (analyzer.isInsidePythonRegion(bitBakeNode)) {
    return 'python'
  }
  // isInsidePythonRegion must be tested before isInsideBashRegion because inline_python could be inside a bash region
  // In that case, the position would be first inside a python region, then inside a bash region, but it would be Python code
  if (analyzer.isInsideBashRegion(bitBakeNode)) {
    return 'bash'
  }
  return undefined
}
