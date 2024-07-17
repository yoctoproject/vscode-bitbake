/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { type SemanticTokens, SemanticTokensBuilder, type SemanticTokensLegend } from 'vscode-languageserver/node'
import { logger } from './lib/src/utils/OutputLogger'
import { analyzer } from './tree-sitter/analyzer'
import * as TreeSitterUtils from './tree-sitter/utils'
import { type SyntaxNode } from 'web-tree-sitter'

interface ParsedToken {
  line: number
  startCharacter: number
  length: number
  tokenType: string
  tokenModifiers: string[]
}

const tokenTypes = new Map<string, number>()
const tokenModifiers = new Map<string, number>()

// https://code.visualstudio.com/api/language-extensions/semantic-highlight-guide
export const TOKEN_LEGEND = {
  types: {
    function: 'function',
    variable: 'variable',
    parameter: 'parameter',
    class: 'class',
    number: 'number',
    operator: 'operator',
    string: 'string',
    keyword: 'keyword'
  },
  modifiers: {
    declaration: 'declaration',
    deprecated: 'deprecated',
    modification: 'modification',
    readonly: 'readonly'
  }
}

const generateSemanticTokensLegend = (): SemanticTokensLegend => {
  const tokenTypesLegend = [
    ...Object.keys(TOKEN_LEGEND.types)
  ]
  tokenTypesLegend.forEach((tokenType, index) => tokenTypes.set(tokenType, index))

  const tokenModifiersLegend = [
    ...Object.keys(TOKEN_LEGEND.modifiers)
  ]
  tokenModifiersLegend.forEach((tokenModifier, index) => tokenModifiers.set(tokenModifier, index))

  return { tokenTypes: tokenTypesLegend, tokenModifiers: tokenModifiersLegend }
}

export const legend: SemanticTokensLegend = generateSemanticTokensLegend()

// Check node_modules/@types/vscode/index.d.ts for more encoding details
function encodeTokenType (tokenType: string): number {
  if (tokenTypes.has(tokenType)) {
    return Number(tokenTypes.get(tokenType))
  } else if (tokenType === 'notInLegend') {
    return tokenTypes.size + 2
  }
  return 0
}

function encodeTokenModifiers (strTokenModifiers: string[]): number {
  let result = 0
  for (let i = 0; i < strTokenModifiers.length; i++) {
    const tokenModifier = strTokenModifiers[i]
    if (tokenModifiers.has(tokenModifier)) {
      result = result | (1 << Number(tokenModifiers.get(tokenModifier)))
    } else if (tokenModifier === 'notInLegend') {
      result = result | (1 << tokenModifiers.size + 2)
    }
  }
  return result
}

export function getBashParsedTokens (uri: string): ParsedToken[] {
  const resultTokens: ParsedToken[] = []
  const Tree = analyzer.getParsedBashTreeForUri(uri)
  if (Tree === undefined) {
    logger.warn(`[getSemanticTokens] Syntax tree not found for ${uri}`)
    return []
  }

  TreeSitterUtils.forEach(Tree.rootNode, (node: SyntaxNode) => {
    const nodeRange = {
      line: node.startPosition.row,
      startCharacter: node.startPosition.column,
      length: Math.max(node.endPosition.column - node.startPosition.column, 0)
    }

    if (node.type === 'variable_name') {
      resultTokens.push({
        ...nodeRange,
        tokenType: TOKEN_LEGEND.types.variable,
        tokenModifiers: []
      })
    }

    if (node.type === 'command_name') {
      resultTokens.push({
        ...nodeRange,
        tokenType: TOKEN_LEGEND.types.function,
        tokenModifiers: []
      })
    }

    // Traverse every node
    return true
  })

  return resultTokens
}

export function getBitBakeParsedTokens (uri: string): ParsedToken[] {
  const resultTokens: ParsedToken[] = []
  const Tree = analyzer.getParsedBitBakeTreeForUri(uri)
  if (Tree === undefined) {
    logger.warn(`[getSemanticTokens] Syntax tree not found for ${uri}`)
    return []
  }

  TreeSitterUtils.forEach(Tree.rootNode, (node: SyntaxNode) => {
    const nodeRange = {
      line: node.startPosition.row,
      startCharacter: node.startPosition.column,
      length: Math.max(node.endPosition.column - node.startPosition.column, 0)
    }

    if (
      TreeSitterUtils.isVariableReference(node) &&
      // bash variable expansions are handled by getBashParsedTokens
      !analyzer.isInsideBashRegion(node)
    ) {
      resultTokens.push({
        ...nodeRange,
        tokenType: TOKEN_LEGEND.types.variable,
        tokenModifiers: [TOKEN_LEGEND.modifiers.declaration]
      })
    }

    if (TreeSitterUtils.isOverride(node)) {
      resultTokens.push({
        ...nodeRange,
        // This scope is customized in package.json "operator.readonly"
        tokenType: TOKEN_LEGEND.types.operator,
        tokenModifiers: [TOKEN_LEGEND.modifiers.readonly]
      })
    }

    if (TreeSitterUtils.isBitbakeOperator(node)) {
      resultTokens.push({
        ...nodeRange,
        tokenType: TOKEN_LEGEND.types.keyword,
        tokenModifiers: []
      })
    }

    if (TreeSitterUtils.isFunctionIdentifier(node)) {
      resultTokens.push({
        ...nodeRange,
        tokenType: TOKEN_LEGEND.types.function,
        tokenModifiers: [TOKEN_LEGEND.modifiers.declaration]
      })
    }

    // Traverse every node
    return true
  })

  return resultTokens
}

export function getParsedTokens (uri: string): ParsedToken[] {
  return [
    ...getBitBakeParsedTokens(uri),
    ...getBashParsedTokens(uri)
  ].sort((a, b) => {
    // The tokens are encoded relative to each other. It breaks when they are not in order.
    if (a.line === b.line) {
      return a.startCharacter - b.startCharacter
    }
    return a.line - b.line
  })
}

export function getSemanticTokens (uri: string): SemanticTokens {
  const resultTokens: ParsedToken[] = getParsedTokens(uri)
  const builder = new SemanticTokensBuilder()
  resultTokens.forEach(token => {
    builder.push(
      token.line,
      token.startCharacter,
      token.length,
      encodeTokenType(token.tokenType),
      encodeTokenModifiers(token.tokenModifiers)
    )
  })
  return builder.build()
}
