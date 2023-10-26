/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { type TextDocument } from 'vscode-languageserver-textdocument'
import { replaceTextForSpaces } from './utils'

import { analyzer } from '../tree-sitter/analyzer'
import { embeddedDocumentsManager } from './documents-manager'
import { type EmbeddedDocumentInfos } from './utils'

export const generatePythonEmbeddedDocument = (textDocument: TextDocument): void => {
  const pythonRegions = analyzer.getPythonRegions(textDocument.uri)
  const documentAsText = textDocument.getText().split(/\r?\n/g)
  const embeddedDocumentAsText = replaceTextForSpaces(documentAsText)
  pythonRegions.forEach((region) => {
    const { start, end } = region.location.range
    const declarationLine = documentAsText[start.line]
      .replace(/^(\s*fakeroot)?\s*python/, 'def')
      .replace(/:(append|prepend|remove)/, (_match, p1) => { return `_${p1}` })
      .replace('{', ':')
    embeddedDocumentAsText[start.line] = declarationLine
    for (let i = start.line + 1; i < end.line; i++) {
      embeddedDocumentAsText[i] = documentAsText[i]
    }
  })
  const content = embeddedDocumentAsText.join('\n')
  const partialInfos: Omit<EmbeddedDocumentInfos, 'uri'> = {
    language: 'python',
    lineOffset: 0
  }
  embeddedDocumentsManager.saveEmbeddedDocument(textDocument.uri, content, partialInfos)
}
