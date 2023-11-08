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
  environment_variable_assignment: LSP.SymbolKind.Variable,
  function_definition: LSP.SymbolKind.Function,
  python_function_definition: LSP.SymbolKind.Function,
  anonymous_python_function: LSP.SymbolKind.Function,
  variable_assignment: LSP.SymbolKind.Variable
}

/**
 * An object that contains the symbol information of all the global declarations.
 * Referenced by the symbol name
 */
export type GlobalDeclarations = Record<string, LSP.SymbolInformation>

const GLOBAL_DECLARATION_NODE_TYPES = new Set([
  'function_definition',
  'python_function_definition',
  'anonymous_python_function'
])

/**
 * Returns declarations (functions or variables) from a given root node
 * This currently does not include global variables defined inside if statements or functions
 *
 * Will only return one declaration per symbol name.
 *
 */
export function getGlobalDeclarations ({
  tree,
  uri
}: {
  tree: Parser.Tree
  uri: string
}): GlobalDeclarations {
  const globalDeclarations: GlobalDeclarations = {}

  TreeSitterUtil.forEach(tree.rootNode, (node) => {
    const followChildren = !GLOBAL_DECLARATION_NODE_TYPES.has(node.type)

    const symbol = getDeclarationSymbolFromNode({ node, uri })
    if (symbol !== null) {
      const word = symbol.name
      // Note that this can include BITBAKE_VARIABLES (e.g DESCRIPTION = ''), it will be used for completion later. But BITBAKE_VARIABLES are also added as completion from doc scanner. The remove of duplicates will happen there.
      globalDeclarations[word] = symbol
    }

    return followChildren
  })

  return globalDeclarations
}

export interface EmbeddedRegions {
  bash: LSP.SymbolInformation[]
  python: LSP.SymbolInformation[]
}

export const getEmbeddedRegionsFromNode = (tree: Parser.Tree, uri: string): EmbeddedRegions => {
  const pythonRegions: LSP.SymbolInformation[] = []
  const bashRegions: LSP.SymbolInformation[] = []

  TreeSitterUtil.forEach(tree.rootNode, (node) => {
    if (TreeSitterUtil.isShellDefinition(node)) {
      const symbol = nodeToSymbolInformation({ node, uri })
      if (symbol !== null) {
        bashRegions.push(symbol)
      }
      return false
    } else if (TreeSitterUtil.isPythonDefinition(node) || TreeSitterUtil.isInlinePython(node)) {
      const symbol = nodeToSymbolInformation({ node, uri })
      if (symbol !== null) {
        pythonRegions.push(symbol)
      }
      return false
    }
    return true
  })

  return {
    bash: bashRegions,
    python: pythonRegions
  }
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
