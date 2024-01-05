/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { type AnalyzedDocument } from '../tree-sitter/analyzer'
import * as TreeSitterUtils from '../tree-sitter/utils'
import { initEmbeddedLanguageDoc, insertTextIntoEmbeddedLanguageDoc } from './utils'
import { type EmbeddedLanguageDoc } from '../lib/src/types/embedded-languages'
import { type SyntaxNode } from 'web-tree-sitter'

export const shebang = '#!/bin/sh\n'

export const generateBashEmbeddedLanguageDoc = (analyzedDocument: AnalyzedDocument): EmbeddedLanguageDoc => {
  const embeddedLanguageDoc = initEmbeddedLanguageDoc(analyzedDocument.document, 'bash')
  TreeSitterUtils.forEach(analyzedDocument.tree.rootNode, (node) => {
    switch (node.type) {
      case 'recipe':
        return true
      case 'function_definition':
        handleFunctionDefinitionNode(node, embeddedLanguageDoc)
        return false
      default:
        return false
    }
  })
  insertTextIntoEmbeddedLanguageDoc(embeddedLanguageDoc, 0, 0, shebang)
  return embeddedLanguageDoc
}

const handleFunctionDefinitionNode = (node: SyntaxNode, embeddedLanguageDoc: EmbeddedLanguageDoc): void => {
  insertTextIntoEmbeddedLanguageDoc(embeddedLanguageDoc, node.startIndex, node.endIndex, node.text)
  node.children.forEach((child) => {
    switch (child.type) {
      case 'override':
        handleOverrideNode(child, embeddedLanguageDoc)
        break
      default:
        break
    }
  })
}

const handleOverrideNode = (overrideNode: SyntaxNode, embeddedLanguageDoc: EmbeddedLanguageDoc): void => {
  // Remove it
  insertTextIntoEmbeddedLanguageDoc(embeddedLanguageDoc, overrideNode.startIndex, overrideNode.endIndex, ' '.repeat(overrideNode.text.length))
}
