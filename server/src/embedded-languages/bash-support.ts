/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { type TextDocument } from 'vscode-languageserver-textdocument'
import { replaceTextForSpaces } from './utils'

import { analyzer } from '../tree-sitter/analyzer'
import { type EmbeddedDocumentInfos } from './utils'
import { embeddedDocumentsManager } from './documents-manager'

export const generateBashEmbeddedDocument = (textDocument: TextDocument): void => {
  const bashRegions = analyzer.getBashRegions(textDocument.uri)
  const documentAsText = textDocument.getText().split(/\r?\n/g)
  const embeddedDocumentAsText = replaceTextForSpaces(documentAsText)
  bashRegions.forEach((region) => {
    const { start, end } = region.location.range
    for (let i = start.line; i <= end.line; i++) {
      embeddedDocumentAsText[i] = documentAsText[i]
    }
  })

  const content = embeddedDocumentAsText.join('\n')
  const partialInfos: Omit<EmbeddedDocumentInfos, 'uri'> = {
    language: 'bash',
    lineOffset: 0
  }
  embeddedDocumentsManager.saveEmbeddedDocument(textDocument.uri, content, partialInfos)
}
