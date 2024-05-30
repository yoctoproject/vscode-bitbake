/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import type Parser from 'web-tree-sitter'
import { type SyntaxNode } from 'web-tree-sitter'

import * as TreeSitterUtils from '../tree-sitter/utils'

import { insertTextIntoEmbeddedLanguageDoc, initEmbeddedLanguageDoc } from './utils'
import { type TextDocument } from 'vscode-languageserver-textdocument'
import { type EmbeddedLanguageDoc } from '../lib/src/embedded-languages'

export const imports = [
  'import bb, bb.build, bb.compress.zstd, bb.data, bb.data_smart, bb.event, bb.fetch2, bb.parse, bb.persist_data, bb.process, bb.progress, bb.runqueue, bb.siggen, bb.utils',
  'import oe.data, oe.path, oe.utils, oe.types, oe.package, oe.packagegroup, oe.sstatesig, oe.lsb, oe.cachedpath, oe.license, oe.qa, oe.reproducible, oe.rust, oe.buildcfg',
  'd = bb.data_smart.DataSmart()',
  'e = bb.event.Event()',
  'e.data = d',
  'import os'
]

export const generatePythonEmbeddedLanguageDoc = (
  textDocument: TextDocument,
  bitBakeTree: Parser.Tree
): EmbeddedLanguageDoc => {
  const embeddedLanguageDoc = initEmbeddedLanguageDoc(textDocument, 'python')
  TreeSitterUtils.forEach(bitBakeTree.rootNode, (node) => {
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
  insertHeader(embeddedLanguageDoc)
  return embeddedLanguageDoc
}

export const getPythonHeader = (originalUri: string): string => {
  const headers = [
    `# ${originalUri}`,
    ...imports,
    ''
  ].join('\n')
  return headers
}

const insertHeader = (embeddedLanguageDoc: EmbeddedLanguageDoc): void => {
  insertTextIntoEmbeddedLanguageDoc(embeddedLanguageDoc, 0, 0, getPythonHeader(embeddedLanguageDoc.originalUri))
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
      case 'fakeroot':
        handleFakerootNode(child, embeddedLanguageDoc)
        break
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

const handleFakerootNode = (inlinePythonNode: SyntaxNode, embeddedLanguageDoc: EmbeddedLanguageDoc): void => {
  const nextNode = inlinePythonNode.nextSibling
  if (nextNode === null) {
    console.debug('[handleFakerootNode]: nextNode is null')
    return
  }
  // Remove fakeroot with the spaces between it and the next node in order to keep proper indentation
  insertTextIntoEmbeddedLanguageDoc(embeddedLanguageDoc, inlinePythonNode.startIndex, nextNode.startIndex, '')
}

const handleOverrideNode = (overrideNode: SyntaxNode, embeddedLanguageDoc: EmbeddedLanguageDoc): void => {
  // Replace it by space
  insertTextIntoEmbeddedLanguageDoc(embeddedLanguageDoc, overrideNode.startIndex, overrideNode.endIndex, ' '.repeat(overrideNode.text.length))
}
