/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { logger } from '../lib/src/utils/OutputLogger'
import { type TextDocumentPositionParams, type Definition, Location, Range } from 'vscode-languageserver/node'
import { analyzer } from '../tree-sitter/analyzer'
import { type DirectiveStatementKeyword } from '../lib/src/types/directiveKeywords'
import { bitBakeProjectScannerClient } from '../BitbakeProjectScannerClient'
import path, { type ParsedPath } from 'path'
import { type ElementInfo } from '../lib/src/types/BitbakeScanResult'

export function onDefinitionHandler (textDocumentPositionParams: TextDocumentPositionParams): Location[] | null {
  const { textDocument: { uri: documentUri }, position } = textDocumentPositionParams
  logger.debug(`[onDefinition] Position: Line ${position.line} Character ${position.character}`)

  const wordPosition = {
    line: position.line,
    character: Math.max(position.character - 1, 0)
  }

  const word = analyzer.wordAtPointFromTextPosition({
    ...textDocumentPositionParams,
    position: wordPosition
  })

  const documentAsText = analyzer.getDocumentTexts(documentUri)
  if (documentAsText === undefined) {
    logger.debug(`[onDefinition] Document not found for ${documentUri}`)
    return []
  }

  // require, inherit & include directives
  const directiveStatementKeyword = analyzer.getDirectiveStatementKeywordByNodeType(textDocumentPositionParams)
  const directivePath = analyzer.getDirectivePathForPosition(textDocumentPositionParams)
  if (directiveStatementKeyword !== undefined && directivePath !== undefined) {
    logger.debug(`[onDefinition] Found directive: ${directiveStatementKeyword}`)
    const definition = getDefinitionForDirectives(directiveStatementKeyword, directivePath)
    logger.debug(`[onDefinition] definition item: ${JSON.stringify(definition)}`)
    return definition
  }

  if (word !== null) {
    const definitions: Definition = []
    const canProvideGoToDefinitionForSymbol = analyzer.isIdentifierOfVariableAssignment(textDocumentPositionParams) ||
    (analyzer.isVariableExpansion(documentUri, position.line, position.character) && analyzer.isIdentifier(textDocumentPositionParams))
    // Variables in declartion and variable expansion syntax
    if (canProvideGoToDefinitionForSymbol) {
      analyzer.getExtraSymbolsForUri(documentUri).forEach((globalDeclaration) => {
        if (globalDeclaration[word] !== undefined) {
          globalDeclaration[word].forEach((symbol) => {
            definitions.push({
              uri: symbol.location.uri,
              range: symbol.location.range
            })
          })
        }
      })

      const ownSymbol = analyzer.getAnalyzedDocument(documentUri)?.globalDeclarations[word]
      if (ownSymbol !== undefined) {
        ownSymbol.forEach((symbol) => {
          definitions.push({
            uri: symbol.location.uri,
            range: symbol.location.range
          })
        })
      }

      const exactSymbol = analyzer.getGlobalDeclarationSymbols(documentUri).find((symbol) => symbol.name === word && analyzer.positionIsInRange(position.line, position.character, symbol.location.range))

      if (exactSymbol?.history !== undefined) {
        exactSymbol.history.forEach((location) => {
          definitions.push({
            uri: location.uri,
            range: location.range
          })
        })
      }

      return definitions
    }
    // Symbols in string content
    if (analyzer.isStringContent(documentUri, position.line, position.character)) {
      const allSymbolsAtPosition = analyzer.getSymbolsInStringContent(documentUri, position.line, position.character)

      allSymbolsAtPosition.forEach((symbol) => {
        definitions.push({
          uri: symbol.location.uri,
          range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } }
        })
      })
      return definitions
    }
  }

  return []
}

function getDefinitionForDirectives (directiveStatementKeyword: DirectiveStatementKeyword, symbol: string): Location[] {
  let elementInfos: ElementInfo[] = []
  switch (directiveStatementKeyword) {
    case 'inherit':
      elementInfos = bitBakeProjectScannerClient.bitbakeScanResult._classes.filter((bbclass): boolean => {
        return bbclass.name === symbol
      })
      break

    case 'require':
    case 'include':
      {
        const includeFile = path.parse(symbol)
        elementInfos = bitBakeProjectScannerClient.bitbakeScanResult._includes.filter((incFile): boolean => {
          return incFile.name === includeFile.name
        })

        if (elementInfos.length === 0) {
          elementInfos = bitBakeProjectScannerClient.bitbakeScanResult._recipes.filter((recipe): boolean => {
            return recipe.name === includeFile.name
          })
        }
      }
      break

    default:
      return []
  }

  const definition: Definition = []
  for (const elementInfo of elementInfos) {
    if (elementInfo.path !== undefined) {
      const location: Location = createDefinitionLocationForPathInfo(elementInfo.path)
      definition.push(location)
    }
  }
  return definition
}

function createDefinitionLocationForPathInfo (path: ParsedPath): Location {
  const url: string = 'file://' + path.dir + '/' + path.base
  const location: Location = Location.create(encodeURI(url), Range.create(0, 0, 0, 0))

  return location
}
