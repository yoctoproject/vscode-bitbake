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
  overrides: string[] // Store the literal text of all overrides including the ones that contain ${} which are resolved when needed.
  finalValue?: string // Only for variables extracted from the scan results
  commentsAbove: string[]
}

/**
 * An object that contains the symbol information of all the global declarations.
 * Referenced by the symbol name
 */
export type GlobalDeclarations = Record<string, BitbakeSymbolInformation[]>

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
export function getGlobalDeclarations ({
  bitBakeTree,
  uri,
  getFinalValue = false // Whether to get the final value from the scan results obtained from scan recipe command, which is the only use case as of now
}: {
  bitBakeTree: Parser.Tree
  uri: string
  getFinalValue?: boolean
}): GlobalDeclarations {
  const globalDeclarations: GlobalDeclarations = {}

  TreeSitterUtil.forEach(bitBakeTree.rootNode, (node) => {
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
      symbol.commentsAbove = commentsAbove
      globalDeclarations[word].push(symbol)
    }

    return followChildren
  })

  return globalDeclarations
}

export function nodeToSymbolInformation ({
  node,
  uri,
  getFinalValue,
  isBitBakeVariableExpansion = false
}: {
  node: Parser.SyntaxNode
  uri: string
  getFinalValue?: boolean
  isBitBakeVariableExpansion?: boolean
}): BitbakeSymbolInformation | null {
  let namedNode = node.firstNamedChild

  if (isBitBakeVariableExpansion) {
    namedNode = node
  }

  if (namedNode === null) {
    return null
  }

  const containerName =
    TreeSitterUtil.findParent(node, (p) => GLOBAL_DECLARATION_NODE_TYPES.has(p.type))
      ?.firstNamedChild?.text ?? ''

  const kind = TREE_SITTER_TYPE_TO_LSP_KIND[node.type]

  /**
   * Example:
   * FOO:override1:${PN}:${PN}-foo = "foo"
   *
   * Tree node:
   *    (variable_assignment [0, 0] - [0, 31]
          (identifier [0, 0] - [0, 3])
      ->  (override [0, 3] - [0, 23]
        ->  (identifier [0, 4] - [0, 13])
        ->  (variable_expansion [0, 14] - [0, 19]
              (identifier [0, 16] - [0, 18]))
        ->  (concatenation [0, 20] - [0, 29]
              (variable_expansion [0, 20] - [0, 25]
                (identifier [0, 22] - [0, 24]))
              (identifier [0, 25] - [0, 29])))
   *
   * Note that the append, prepend and remove operators don't have identifiers in the tree
   */
  const overrides: BitbakeSymbolInformation['overrides'] = []
  const overrideChildNode = node.children.find((child) => child.type === 'override')
  if (overrideChildNode !== undefined) {
    overrideChildNode.children.forEach((child) => {
      const validTypes = ['identifier', 'variable_expansion', 'concatenation']
      if (!validTypes.includes(child.type)) {
        return
      }
      overrides.push(child.text)
    })
  }

  let symbol: BitbakeSymbolInformation = {
    ...LSP.SymbolInformation.create(
      namedNode.text,
      kind ?? LSP.SymbolKind.Variable,
      TreeSitterUtil.range(namedNode),
      uri,
      containerName
    ),
    commentsAbove: [],
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
