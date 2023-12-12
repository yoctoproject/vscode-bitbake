/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { type AnalyzedDocument } from '../tree-sitter/analyzer'
import * as TreeSitterUtils from '../tree-sitter/utils'
import { initEmbeddedLanguageDoc, insertTextIntoEmbeddedLanguageDoc } from './utils'
import { type EmbeddedLanguageDoc } from '../lib/src/types/embedded-languages'

export const shebang = '#!/bin/sh\n'

export const generateBashEmbeddedLanguageDoc = (analyzedDocument: AnalyzedDocument): EmbeddedLanguageDoc => {
  const embeddedLanguageDoc = initEmbeddedLanguageDoc(analyzedDocument.document, 'bash')
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
  insertTextIntoEmbeddedLanguageDoc(embeddedLanguageDoc, 0, 0, shebang)
  return embeddedLanguageDoc
}
