/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

/**
 * Inspired by bash-language-server under MIT
 * Reference: https://github.com/bash-lsp/bash-language-server/blob/8c42218c77a9451b308839f9a754abde901323d5/server/src/util/declarations.ts
 */
import * as LSP from 'vscode-languageserver/node'
import type * as Parser from 'web-tree-sitter'

import * as TreeSitterUtil from './utils'

const TREE_SITTER_TYPE_TO_LSP_KIND: Record<string, LSP.SymbolKind | undefined> = {
  function_definition: LSP.SymbolKind.Function,
  python_function_definition: LSP.SymbolKind.Function,
  anonymous_python_function: LSP.SymbolKind.Function,
  variable_assignment: LSP.SymbolKind.Variable
}

/**
 * An object that contains the symbol information of all the global declarations.
 * Referenced by the symbol name
 */
export type GlobalDeclarations = Record<string, LSP.SymbolInformation[]>
export type GlobalSymbolComments = Record<string, Array<{ uri: string, line: number, comments: string[] }>>
const GLOBAL_DECLARATION_NODE_TYPES = new Set([
  'function_definition',
  'python_function_definition',
  'anonymous_python_function'
])

/**
 * Returns declarations (functions or variables) from a given root node as well as the comments above the declaration
 * This currently does not include global variables defined inside other code blocks (e.g. if statement & functions)
 *
 */
export function getGlobalDeclarationsAndComments ({
  tree,
  uri
}: {
  tree: Parser.Tree
  uri: string
}): [GlobalDeclarations, GlobalSymbolComments] {
  const globalDeclarations: GlobalDeclarations = {}
  const symbolComments: GlobalSymbolComments = {}

  TreeSitterUtil.forEach(tree.rootNode, (node) => {
    const followChildren = !GLOBAL_DECLARATION_NODE_TYPES.has(node.type)

    const symbol = getDeclarationSymbolFromNode({ node, uri })
    if (symbol !== null) {
      const word = symbol.name
      // Note that this can include BITBAKE_VARIABLES (e.g DESCRIPTION = ''), it will be used for completion later. But BITBAKE_VARIABLES are also added as completion from doc scanner. The remove of duplicates will happen there.
      if (globalDeclarations[word] === undefined) {
        globalDeclarations[word] = []
      }
      globalDeclarations[word].push(symbol)

      const commentsAbove: string[] = []
      extractCommentsAbove(node, commentsAbove)
      if (commentsAbove.length > 0) {
        if (symbolComments[word] === undefined) {
          symbolComments[word] = []
        }
        symbolComments[word].push({ uri, line: node.startPosition.row, comments: commentsAbove })
      }
    }

    return followChildren
  })

  return [globalDeclarations, symbolComments]
}

export function nodeToSymbolInformation ({
  node,
  uri
}: {
  node: Parser.SyntaxNode
  uri: string
}): LSP.SymbolInformation | null {
  const firstNamedChild = node.firstNamedChild
  if (firstNamedChild === null) {
    return null
  }

  const containerName =
    TreeSitterUtil.findParent(node, (p) => GLOBAL_DECLARATION_NODE_TYPES.has(p.type))
      ?.firstNamedChild?.text ?? ''

  const kind = TREE_SITTER_TYPE_TO_LSP_KIND[node.type]

  return LSP.SymbolInformation.create(
    firstNamedChild.text,
    kind ?? LSP.SymbolKind.Variable,
    TreeSitterUtil.range(node),
    uri,
    containerName
  )
}

function getDeclarationSymbolFromNode ({
  node,
  uri
}: {
  node: Parser.SyntaxNode
  uri: string
}): LSP.SymbolInformation | null {
  if (TreeSitterUtil.isDefinition(node)) {
    // Currently in the tree, all functions start with python keyword have type 'anonymous_python_function', skip when the node is an actual anonymous python function in bitbake that has no identifier
    if (node.type === 'anonymous_python_function' && node.firstNamedChild?.type !== 'identifier') {
      return null
    }
    return nodeToSymbolInformation({ node, uri })
  }

  return null
}

function extractCommentsAbove (node: Parser.SyntaxNode, comments: string[]): void {
  const previousSibling = node.previousSibling
  if (previousSibling === null) {
    return
  }
  if (previousSibling.type === 'comment' && previousSibling.startPosition.row + 1 === node.startPosition.row) {
    const commentValue = previousSibling.text.trim()
    comments.unshift(commentValue)
    extractCommentsAbove(previousSibling, comments)
  }
}
