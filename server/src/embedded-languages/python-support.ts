/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { type TextDocument } from 'vscode-languageserver-textdocument'
import { type SyntaxNode } from 'web-tree-sitter'

import { analyzer } from '../tree-sitter/analyzer'
import * as TreeSitterUtils from '../tree-sitter/utils'

import { embeddedLanguageDocsManager } from './documents-manager'
import { type EmbeddedLanguageDoc, insertTextIntoEmbeddedLanguageDoc, initEmbeddedLanguageDoc } from './utils'

export const imports = [
  'import bb, bb.build, bb.compress.zstd, bb.data, bb.data_smart, bb.event, bb.fetch2, bb.parse, bb.persist_data, bb.process, bb.progress, bb.runqueue, bb.siggen, bb.utils',
  'import oe.data, oe.path, oe.utils, oe.types, oe.package, oe.packagegroup, oe.sstatesig, oe.lsb, oe.cachedpath, oe.license, oe.qa, oe.reproducible, oe.rust, oe.buildcfgoe',
  'd = bb.data_smart.DataSmart()',
  'e = bb.event.Event()',
  'e.data = d',
  'import os',
  ''
].join('\n')

export const generatePythonEmbeddedLanguageDoc = async (textDocument: TextDocument): Promise<void> => {
  const analyzedDocument = analyzer.getAnalyzedDocument(textDocument.uri)
  if (analyzedDocument === undefined) {
    return
  }
  const embeddedLanguageDoc = initEmbeddedLanguageDoc(textDocument, 'python')
  TreeSitterUtils.forEach(analyzedDocument.tree.rootNode, (node) => {
    switch (node.type) {
      case 'python_function_definition':
        handlePythonFunctionDefinition(node, embeddedLanguageDoc)
        return false
      case 'anonymous_python_function':
        handleAnonymousPythonFunction(node, embeddedLanguageDoc)
        return false
      case 'inline_python':
        handleInlinePythonNode(node, embeddedLanguageDoc)
        return false
      default:
        return true
    }
  })
  insertTextIntoEmbeddedLanguageDoc(embeddedLanguageDoc, 0, 0, imports)
  await embeddedLanguageDocsManager.saveEmbeddedLanguageDoc(embeddedLanguageDoc)
}

const handlePythonFunctionDefinition = (node: SyntaxNode, embeddedLanguageDoc: EmbeddedLanguageDoc): void => {
  insertTextIntoEmbeddedLanguageDoc(embeddedLanguageDoc, node.startIndex, node.endIndex, node.text)
  node.children.forEach((child) => {
    if (child.type === 'block') {
      handleBlockNode(child, embeddedLanguageDoc)
    }
  })
}

const handleAnonymousPythonFunction = (node: SyntaxNode, embeddedLanguageDoc: EmbeddedLanguageDoc): void => {
  insertTextIntoEmbeddedLanguageDoc(embeddedLanguageDoc, node.startIndex, node.endIndex, node.text)
  node.children.forEach((child) => {
    switch (child.type) {
      case 'python':
        insertTextIntoEmbeddedLanguageDoc(embeddedLanguageDoc, child.startIndex, child.endIndex, 'def')
        if (child.nextSibling?.type === '(') {
          // if there is no identfier, we add a dummy one
          insertTextIntoEmbeddedLanguageDoc(embeddedLanguageDoc, child.endIndex, child.endIndex, ' _ ')
        }
        break
      case 'identifier':
        break
      case 'override':
        handleOverrideNode(child, embeddedLanguageDoc)
        break
      case '{':
        insertTextIntoEmbeddedLanguageDoc(embeddedLanguageDoc, child.startIndex, child.endIndex, ':')
        break
      case '}':
        insertTextIntoEmbeddedLanguageDoc(embeddedLanguageDoc, child.startIndex, child.endIndex, ' ')
        break
      case 'block':
        handleBlockNode(child, embeddedLanguageDoc)
        break
      default:
        break
    }
  })
}

const handleInlinePythonNode = (inlinePythonNode: SyntaxNode, embeddedLanguageDoc: EmbeddedLanguageDoc): void => {
  const openingNode = inlinePythonNode.child(0)
  const pythonContentNode = inlinePythonNode.child(1)
  const closingNode = inlinePythonNode.child(2)
  if (openingNode?.type !== '${@') {
    return
  }
  if (pythonContentNode === null) {
    return
  }
  if (closingNode?.type !== '}') {
    return
  }
  // We put the inline_python content on a new line
  insertTextIntoEmbeddedLanguageDoc(embeddedLanguageDoc, openingNode.startIndex, openingNode.endIndex, '  \n')
  insertTextIntoEmbeddedLanguageDoc(embeddedLanguageDoc, pythonContentNode.startIndex, pythonContentNode.startIndex, '\n') // prevent trailing spaces
  insertTextIntoEmbeddedLanguageDoc(embeddedLanguageDoc, pythonContentNode.startIndex, pythonContentNode.endIndex, pythonContentNode.text)
  insertTextIntoEmbeddedLanguageDoc(embeddedLanguageDoc, closingNode.startIndex, closingNode.endIndex, '\n')
  handleBlockNode(pythonContentNode, embeddedLanguageDoc)
}

const handleBlockNode = (blockNode: SyntaxNode, embeddedLanguageDoc: EmbeddedLanguageDoc): void => {
  if (blockNode.text === '') {
    insertTextIntoEmbeddedLanguageDoc(embeddedLanguageDoc, blockNode.startIndex, blockNode.endIndex, '\n  pass')
  }
}

const handleOverrideNode = (overrideNode: SyntaxNode, embeddedLanguageDoc: EmbeddedLanguageDoc): void => {
  // Remove it
  insertTextIntoEmbeddedLanguageDoc(embeddedLanguageDoc, overrideNode.startIndex, overrideNode.endIndex, ' '.repeat(overrideNode.text.length))
}
