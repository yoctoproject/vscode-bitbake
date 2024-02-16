/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as LSP from 'vscode-languageserver/node'
import { logger } from '../lib/src/utils/OutputLogger'
import { analyzer } from '../tree-sitter/analyzer'
import { getAllDefinitionSymbolsForSymbolAtPoint } from './onDefinition'

export function onReferenceHandler (referenceParams: LSP.ReferenceParams): LSP.Location[] | null {
  const { textDocument: { uri }, position, context: { includeDeclaration } } = referenceParams
  logger.debug(`[onReference] includeDeclaration: ${includeDeclaration}`)
  logger.debug(`[onReference] Position: Line ${position.line} Character ${position.character}`)

  const wordPosition = {
    line: position.line,
    character: Math.max(position.character - 1, 0)
  }

  const word = analyzer.wordAtPointFromTextPosition({
    ...referenceParams,
    position: wordPosition
  })

  const references: LSP.Location[] = []

  if (word !== null) {
    const symbolAtPoint = analyzer.findExactSymbolAtPoint(uri, position, word)
    if (symbolAtPoint?.kind === LSP.SymbolKind.Variable || symbolAtPoint?.kind === LSP.SymbolKind.Function) {
      const allReferenceSymbols = [
        ...getAllDefinitionSymbolsForSymbolAtPoint(uri, word, symbolAtPoint),
        ...analyzer.getVariableExpansionSymbols(uri)
      ]

      analyzer.getIncludeUrisForUri(uri).forEach((includeUri) => {
        allReferenceSymbols.push(...analyzer.getVariableExpansionSymbols(includeUri))
      })

      allReferenceSymbols.filter(symbol => symbol.name === word && symbol.kind === symbolAtPoint?.kind).forEach((symbol) => {
        references.push({
          uri: symbol.location.uri,
          range: symbol.location.range
        })
      })

      return references
    }
  }

  return null
}
