/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

/**
 * Inspired by bash-language-sever
 * Repo: https://github.com/bash-lsp/bash-language-server
 */
import * as LSP from 'vscode-languageserver/node'
import type { SyntaxNode } from 'web-tree-sitter'

/**
 * Recursively iterate over all nodes in a tree.
 *
 * @param node The node to start iterating from
 * @param callback The callback to call for each node. Return false to stop following children.
 */
export function forEach (node: SyntaxNode, callback: (n: SyntaxNode) => boolean): void {
  const followChildren = callback(node)
  if (followChildren && node.children.length > 0) {
    node.children.forEach((n) => { forEach(n, callback) })
  }
}

export function range (n: SyntaxNode): LSP.Range {
  return LSP.Range.create(
    n.startPosition.row,
    n.startPosition.column,
    n.endPosition.row,
    n.endPosition.column
  )
}

export function isDefinition (n: SyntaxNode): boolean {
  switch (n.type) {
    case 'variable_assignment':
    case 'function_definition': // Shell functions
    case 'anonymous_python_function': // Functions start with keyword python
    case 'python_function_definition': // Functions start with keyword def
      return true
    default:
      return false
  }
}

export function isReference (n: SyntaxNode): boolean {
  switch (n.type) {
    case 'variable_assignment': // Currently, the tree doesn't have a unique type for variable reference neither for function reference
      return true
    default:
      return false
  }
}

/**
 * Find the node's parent that passes the predicate
 */
export function findParent (
  start: SyntaxNode,
  predicate: (n: SyntaxNode) => boolean
): SyntaxNode | null {
  let node = start.parent
  while (node !== null) {
    if (predicate(node)) {
      return node
    }
    node = node.parent
  }
  return null
}
