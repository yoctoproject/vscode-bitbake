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

export interface BitbakeSymbolInformation extends LSP.SymbolInformation {
  overrides: string[]
  finalValue?: string // Only for variables extracted from the scan results
  commentsAbove?: string[]
}

/**
 * An object that contains the symbol information of all the global declarations.
 * Referenced by the symbol name
 */
export type GlobalDeclarations = Record<string, BitbakeSymbolInformation[]>
export type GlobalSymbolComments = Record<string, Array<{ uri: string, line: number, comments: string[], symbolInfo: BitbakeSymbolInformation }>>
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
  uri,
  getFinalValue = false // Whether to get the final value from the scan results obtained from scan recipe command, which is the only use case as of now
}: {
  tree: Parser.Tree
  uri: string
  getFinalValue?: boolean
}): [GlobalDeclarations, GlobalSymbolComments] {
  const globalDeclarations: GlobalDeclarations = {}
  const symbolComments: GlobalSymbolComments = {}

  TreeSitterUtil.forEach(tree.rootNode, (node) => {
    const followChildren = !GLOBAL_DECLARATION_NODE_TYPES.has(node.type)

    const symbol = getDeclarationSymbolFromNode({ node, uri, getFinalValue })
    if (symbol !== null) {
      const word = symbol.name
      // Note that this can include BITBAKE_VARIABLES (e.g DESCRIPTION = ''), it will be used for completion later. But BITBAKE_VARIABLES are also added as completion from doc scanner. The remove of duplicates will happen there.
      if (globalDeclarations[word] === undefined) {
        globalDeclarations[word] = []
      }

      const commentsAbove: string[] = []
      extractCommentsAbove(node, commentsAbove)
      if (commentsAbove.length > 0) {
        symbol.commentsAbove = commentsAbove
        if (symbolComments[word] === undefined) {
          symbolComments[word] = []
        }
        symbolComments[word].push({ uri, line: node.startPosition.row, comments: commentsAbove, symbolInfo: symbol })
      }

      globalDeclarations[word].push(symbol)
    }

    return followChildren
  })

  return [globalDeclarations, symbolComments]
}

function nodeToSymbolInformation ({
  node,
  uri,
  getFinalValue
}: {
  node: Parser.SyntaxNode
  uri: string
  getFinalValue?: boolean
}): BitbakeSymbolInformation | null {
  const firstNamedChild = node.firstNamedChild
  if (firstNamedChild === null) {
    return null
  }

  const containerName =
    TreeSitterUtil.findParent(node, (p) => GLOBAL_DECLARATION_NODE_TYPES.has(p.type))
      ?.firstNamedChild?.text ?? ''

  const kind = TREE_SITTER_TYPE_TO_LSP_KIND[node.type]

  /**
   * Example:
   * FOO:override1:override2 = "foo"
   *
   * Tree node:
   *    (variable_assignment [0, 0] - [0, 31]
          (identifier [0, 0] - [0, 3])
      ->  (override [0, 3] - [0, 23]
        ->  (identifier [0, 4] - [0, 13])
        ->  (identifier [0, 14] - [0, 23]))
          (literal [0, 26] - [0, 31]
            (string [0, 26] - [0, 31]
          ->  (string_content [0, 27] - [0, 30]))))
   *
   * Note that the append, prepend and remove operators don't have identifiers in the tree
   */
  const overrides: string[] = []
  const overrideChildNode = node.children.find((child) => child.type === 'override')
  if (overrideChildNode !== undefined) {
    overrideChildNode.children.forEach((child) => {
      if (child.type === 'identifier') {
        overrides.push(child.text)
      }
    })
  }

  let symbol: BitbakeSymbolInformation = {
    ...LSP.SymbolInformation.create(
      firstNamedChild.text,
      kind ?? LSP.SymbolKind.Variable,
      TreeSitterUtil.range(firstNamedChild),
      uri,
      containerName
    ),
    overrides
  }

  if (kind === LSP.SymbolKind.Variable && getFinalValue === true) {
    const finalValue = node.children.find((child) => child.type === 'literal')?.firstChild?.firstNamedChild?.text
    if (finalValue !== undefined) {
      symbol = {
        ...symbol,
        finalValue
      }
    }
  }

  return symbol
}

function getDeclarationSymbolFromNode ({
  node,
  uri,
  getFinalValue
}: {
  node: Parser.SyntaxNode
  uri: string
  getFinalValue?: boolean
}): BitbakeSymbolInformation | null {
  if (TreeSitterUtil.isDefinition(node)) {
    // Currently in the tree, all functions start with python keyword have type 'anonymous_python_function', skip when the node is an actual anonymous python function in bitbake that has no identifier
    if (node.type === 'anonymous_python_function' && node.firstNamedChild?.type !== 'identifier') {
      return null
    }
    return nodeToSymbolInformation({ node, uri, getFinalValue })
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
