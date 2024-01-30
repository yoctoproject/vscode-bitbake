/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import type * as LSP from 'vscode-languageserver/node'
import { logger } from '../lib/src/utils/OutputLogger'
import { analyzer } from '../tree-sitter/analyzer'

export function onReferencesHandler (referenceParams: LSP.ReferenceParams): LSP.Location[] | null {
  const { textDocument: { uri }, position } = referenceParams

  const wordPosition = {
    line: position.line,
    character: Math.max(position.character - 1, 0)
  }

  const word = analyzer.wordAtPointFromTextPosition({
    ...referenceParams,
    position: wordPosition
  })

  if (word === null) {
    return null
  }

  logger.debug(`[onReferences] Position: Line ${position.line} Character ${position.character}`)
  logger.debug(`[onReferences] Word: ${word}`)

  // TODO: this following part is the same the one in onDefinition, we should refactor it
  const references: LSP.Location[] = []
  const canProvideGoToDefinitionForSymbol = analyzer.isIdentifierOfVariableAssignment(referenceParams) ||
      (analyzer.isVariableExpansion(uri, position.line, position.character) && analyzer.isIdentifier(referenceParams))
      // Variables in declartion and variable expansion syntax
  if (canProvideGoToDefinitionForSymbol) {
    analyzer.getExtraSymbolsForUri(uri).forEach((globalDeclaration) => {
      if (globalDeclaration[word] !== undefined) {
        globalDeclaration[word].forEach((symbol) => {
          references.push({
            uri: symbol.location.uri,
            range: symbol.location.range
          })
        })
      }
    })

    const ownSymbol = analyzer.getAnalyzedDocument(uri)?.globalDeclarations[word]
    if (ownSymbol !== undefined) {
      ownSymbol.forEach((symbol) => {
        references.push({
          uri: symbol.location.uri,
          range: symbol.location.range
        })
      })
    }

    return references
  }
  return null
}
