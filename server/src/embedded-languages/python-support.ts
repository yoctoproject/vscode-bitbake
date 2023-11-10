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

export const generatePythonEmbeddedLanguageDoc = async (textDocument: TextDocument): Promise<void> => {
  const analyzedDocument = analyzer.getAnalyzedDocument(textDocument.uri)
  if (analyzedDocument === undefined) {
    return
  }
  const imports = new Set<string>()
  const embeddedLanguageDoc = initEmbeddedLanguageDoc(textDocument, 'python')
  TreeSitterUtils.forEach(analyzedDocument.tree.rootNode, (node) => {
    switch (node.type) {
      case 'python_function_definition':
        handlePythonFunctionDefinition(node, embeddedLanguageDoc, imports)
        return false
      case 'anonymous_python_function':
        handleAnonymousPythonFunction(node, embeddedLanguageDoc, imports)
        return false
      case 'inline_python':
        handleInlinePythonNode(node, embeddedLanguageDoc, imports)
        return false
      default:
        return true
    }
  })
  if (imports.size !== 0) {
    insertTextIntoEmbeddedLanguageDoc(embeddedLanguageDoc, 0, 0, [...imports].join('\n') + '\n')
  }
  await embeddedLanguageDocsManager.saveEmbeddedLanguageDoc(embeddedLanguageDoc)
}

const handlePythonFunctionDefinition = (node: SyntaxNode, embeddedLanguageDoc: EmbeddedLanguageDoc, imports: Set<string>): void => {
  insertTextIntoEmbeddedLanguageDoc(embeddedLanguageDoc, node.startIndex, node.endIndex, node.text)
  node.children.forEach((child) => {
    if (child.type === 'block') {
      handleBlockNode(child, embeddedLanguageDoc, imports)
    }
  })
}

const handleAnonymousPythonFunction = (node: SyntaxNode, embeddedLanguageDoc: EmbeddedLanguageDoc, imports: Set<string>): void => {
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
        handleBlockNode(child, embeddedLanguageDoc, imports)
        break
      default:
        break
    }
  })
}

const handleInlinePythonNode = (inlinePythonNode: SyntaxNode, embeddedLanguageDoc: EmbeddedLanguageDoc, imports: Set<string>): void => {
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
  handleBlockNode(pythonContentNode, embeddedLanguageDoc, imports)
}

const handleBlockNode = (blockNode: SyntaxNode, embeddedLanguageDoc: EmbeddedLanguageDoc, imports: Set<string>): void => {
  if (blockNode.text === '') {
    insertTextIntoEmbeddedLanguageDoc(embeddedLanguageDoc, blockNode.startIndex, blockNode.endIndex, '\n  pass')
  }
  handleImports(blockNode, imports)
}

const handleImports = (blockNode: SyntaxNode, imports: Set<string>): void => {
  const importBb = (bbNode: SyntaxNode): void => {
    if (bbNode.nextSibling?.type === '.' && bbNode.nextNamedSibling?.type === 'python_identifier') {
      const importName = bbNode.nextNamedSibling.text
      imports.add('import bb')
      imports.add(`from bb import ${importName}`)
      imports.add(`bb.${importName} = ${importName}`)
    }
  }

  const importD = (): void => {
    imports.add('from bb import data_smart')
    imports.add('d = data_smart.DataSmart()')
  }

  const importE = (): void => {
    importD()
    imports.add('from bb import event')
    imports.add('e = event.Event()')
    imports.add('e.data = d')
  }

  const importOs = (): void => {
    imports.add('import os')
  }

  TreeSitterUtils.forEach(blockNode, (child) => {
    if (child.type === 'python_identifier') {
      if (child.text === 'bb') {
        importBb(child)
      } else if (child.text === 'd') {
        importD()
      } else if (child.text === 'e') {
        importE()
      } else if (child.text === 'os') {
        importOs()
      }
    }
    return true
  })
}

const handleOverrideNode = (overrideNode: SyntaxNode, embeddedLanguageDoc: EmbeddedLanguageDoc): void => {
  // Remove it
  insertTextIntoEmbeddedLanguageDoc(embeddedLanguageDoc, overrideNode.startIndex, overrideNode.endIndex, ' '.repeat(overrideNode.text.length))
}
