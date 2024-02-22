/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

/**
 * Inspired by bash-language-server under MIT
 * Reference: https://github.com/bash-lsp/bash-language-server/blob/8c42218c77a9451b308839f9a754abde901323d5/server/src/util/tree-sitter.ts
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

export function isInlinePython (n: SyntaxNode): boolean {
  return n.type === 'inline_python'
}

export function isPythonDefinition (n: SyntaxNode): boolean {
  return n.type === 'anonymous_python_function' || n.type === 'python_function_definition'
}

export function isShellDefinition (n: SyntaxNode): boolean {
  return n.type === 'function_definition'
}

export function isVariableReference (n: SyntaxNode): boolean {
  switch (n.type) {
    case 'identifier':
      return n?.parent?.type === 'variable_assignment' || n?.parent?.type === 'variable_expansion'
    default:
      return false
  }
}

/**
 * Check if the node is an override other than `append`, `prepend` or `remove`
 */
export function isOverride (n: SyntaxNode): boolean {
  /**
   * Example:
   * FOO:append:override1:${PN}:${PN}-foo () {}
   *
   * Tree node:
   *    (function_definition [0, 0] - [0, 42]
          (identifier [0, 0] - [0, 3])
          (override [0, 3] - [0, 36]
            (identifier [0, 11] - [0, 20])
            (variable_expansion [0, 21] - [0, 26]
              (identifier [0, 23] - [0, 25]))
            (concatenation [0, 27] - [0, 36]
              (variable_expansion [0, 27] - [0, 32]
                (identifier [0, 29] - [0, 31]))
              (identifier [0, 32] - [0, 36])))))
   */
  const parentType = n?.parent?.type
  switch (n.type) {
    case 'identifier':
      return parentType === 'override' || parentType === 'concatenation'
    default:
      return false
  }
}

export function isBitbakeOperator (n: SyntaxNode): boolean {
  switch (n.type) {
    case 'append':
    case 'prepend':
    case 'remove':
      return true
    default:
      return false
  }
}

export function isFunctionIdentifier (n: SyntaxNode): boolean {
  switch (n.type) {
    case 'identifier':
      return n?.parent?.type === 'function_definition' ||
      n?.parent?.type === 'anonymous_python_function'
    case 'python_identifier':
      return n?.parent?.type === 'python_function_definition'
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
