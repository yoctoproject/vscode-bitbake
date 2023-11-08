/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { type TextDocument } from 'vscode-languageserver-textdocument'

import { analyzer } from '../tree-sitter/analyzer'
import * as TreeSitterUtils from '../tree-sitter/utils'
import { embeddedLanguageDocsManager } from './documents-manager'
import { initEmbeddedLanguageDoc, insertTextIntoEmbeddedLanguageDoc } from './utils'

export const generateBashEmbeddedLanguageDoc = async (textDocument: TextDocument): Promise<void> => {
  const analyzedDocument = analyzer.getAnalyzedDocument(textDocument.uri)
  if (analyzedDocument === undefined) {
    return
  }
  const embeddedLanguageDoc = initEmbeddedLanguageDoc(textDocument, 'bash')
  TreeSitterUtils.forEach(analyzedDocument.tree.rootNode, (node) => {
    switch (node.type) {
      case 'recipe':
        return true
      case 'function_definition':
        insertTextIntoEmbeddedLanguageDoc(embeddedLanguageDoc, node.startIndex, node.endIndex, node.text)
        return false
      default:
        return false
    }
  })
  await embeddedLanguageDocsManager.saveEmbeddedLanguageDoc(embeddedLanguageDoc)
}
