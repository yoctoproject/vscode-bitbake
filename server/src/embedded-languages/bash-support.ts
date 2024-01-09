/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { type AnalyzedDocument } from '../tree-sitter/analyzer'
import * as TreeSitterUtils from '../tree-sitter/utils'
import { initEmbeddedLanguageDoc, insertTextIntoEmbeddedLanguageDoc } from './utils'
import { type EmbeddedLanguageDoc } from '../lib/src/types/embedded-languages'
import { type SyntaxNode } from 'web-tree-sitter'
import { logger } from '../lib/src/utils/OutputLogger'

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
      case 'fakeroot':
        handleFakerootNode(child, embeddedLanguageDoc)
        break
      case 'override':
        handleOverrideNode(child, embeddedLanguageDoc)
        break
      case 'inline_python':
        handleInlinePythonNode(child, embeddedLanguageDoc)
        break
      default:
        break
    }
  })
}

const handleInlinePythonNode = (inlinePythonNode: SyntaxNode, embeddedLanguageDoc: EmbeddedLanguageDoc): void => {
  // Example:
  // if [ "${@d.getVar('FOO')}" = "0" ] ;
  // will become
  // if [ "${?               }" = "0" ] ;
  // Replacing the whole inline_python by spaces would create a constant string and might trigger a warning if the spellcheck
  // extension is activated, since the comparison with "0" would always give the same result
  // ${?} is an arbitrary value that is expected not to cause any trouble.
  const trailingSpacesLength = inlinePythonNode.text.length - 4
  if (trailingSpacesLength <= 0) {
    // This is expected to never happen
    logger.error(`[handleInlinePythonNode (Bash)] Invalid string length for node ${inlinePythonNode.toString()}`)
    return
  }
  const replacement = `\${?${' '.repeat(trailingSpacesLength)}}`
  insertTextIntoEmbeddedLanguageDoc(embeddedLanguageDoc, inlinePythonNode.startIndex, inlinePythonNode.endIndex, replacement)
}

const handleFakerootNode = (inlinePythonNode: SyntaxNode, embeddedLanguageDoc: EmbeddedLanguageDoc): void => {
  // Replace it by spaces
  insertTextIntoEmbeddedLanguageDoc(embeddedLanguageDoc, inlinePythonNode.startIndex, inlinePythonNode.endIndex, ' '.repeat(inlinePythonNode.text.length))
}

const handleOverrideNode = (overrideNode: SyntaxNode, embeddedLanguageDoc: EmbeddedLanguageDoc): void => {
  // Replace it by spaces
  insertTextIntoEmbeddedLanguageDoc(embeddedLanguageDoc, overrideNode.startIndex, overrideNode.endIndex, ' '.repeat(overrideNode.text.length))
}
