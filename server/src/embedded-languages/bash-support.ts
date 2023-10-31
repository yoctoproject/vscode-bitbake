/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { type TextDocument } from 'vscode-languageserver-textdocument'
import { replaceTextForSpaces } from './utils'

import { analyzer } from '../tree-sitter/analyzer'
import { type EmbeddedLanguageDocInfos } from './utils'
import { embeddedLanguageDocsManager } from './documents-manager'

export const generateBashEmbeddedLanguageDoc = async (textDocument: TextDocument): Promise<void> => {
  const bashRegions = analyzer.getBashRegions(textDocument.uri)
  const documentAsText = textDocument.getText().split(/\r?\n/g)
  const embeddedLanguageDocAsText = replaceTextForSpaces(documentAsText)
  bashRegions.forEach((region) => {
    const { start, end } = region.location.range
    for (let i = start.line; i <= end.line; i++) {
      embeddedLanguageDocAsText[i] = documentAsText[i]
    }
  })

  const content = embeddedLanguageDocAsText.join('\n')
  const partialInfos: Omit<EmbeddedLanguageDocInfos, 'uri'> = {
    language: 'bash',
    lineOffset: 0
  }
  await embeddedLanguageDocsManager.saveEmbeddedLanguageDoc(textDocument.uri, content, partialInfos)
}
