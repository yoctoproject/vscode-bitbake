/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { logger } from '../lib/src/utils/OutputLogger'
import { type TextDocumentPositionParams, type Definition, Location, Range } from 'vscode-languageserver/node'
import { analyzer } from '../tree-sitter/analyzer'
import { type DirectiveStatementKeyword } from '../lib/src/types/directiveKeywords'
import { definitionProvider } from '../DefinitionProvider'
import { bitBakeProjectScannerClient } from '../BitbakeProjectScannerClient'
import path, { type ParsedPath } from 'path'
import { type ElementInfo } from '../lib/src/types/BitbakeScanResult'

export function onDefinitionHandler (textDocumentPositionParams: TextDocumentPositionParams): Definition | null {
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
  if (directiveStatementKeyword !== undefined) {
    logger.debug(`[onDefinition] Found directive: ${directiveStatementKeyword}`)
    const definition = getDefinitionForDirectives(directiveStatementKeyword, textDocumentPositionParams, documentAsText)
    logger.debug(`[onDefinition] definition item: ${JSON.stringify(definition)}`)
    return definition
  }

  if (word !== null) {
    const definitions: Definition = []
    const canProvideGoToDefinitionForSymbol = analyzer.isIdentifierOfVariableAssignment(textDocumentPositionParams) ||
    (analyzer.isVariableExpansion(documentUri, position.line, position.character) && analyzer.isIdentifier(textDocumentPositionParams))
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
    }

    return definitions
  }

  return getDefinition(textDocumentPositionParams, documentAsText)
}

function getDefinitionForDirectives (directiveStatementKeyword: DirectiveStatementKeyword, textDocumentPositionParams: TextDocumentPositionParams, documentAsText: string[]): Definition {
  let definition: Definition = []
  const currentLine: string = documentAsText[textDocumentPositionParams.position.line]
  const symbol: string = extractSymbolFromLine(textDocumentPositionParams, currentLine)

  const words: string[] = currentLine.split(' ')

  if (words.length >= 2) {
    if (words[0] === directiveStatementKeyword) {
      logger.debug(`getDefinitionForKeyWord: ${JSON.stringify(words)}`)
      if (words.length === 2) {
        definition = createDefinitionForKeyword(directiveStatementKeyword, words[1])
      } else {
        definition = createDefinitionForKeyword(directiveStatementKeyword, words[1], symbol)
      }
    }
  }
  return definition
}

function createDefinitionForKeyword (keyword: string, restOfLine: string, selectedSympbol?: string): Definition {
  let definition: Definition = []
  restOfLine = restOfLine.trim()

  switch (keyword) {
    case 'inherit':
      {
        let searchString: string
        if (selectedSympbol === undefined) {
          searchString = restOfLine
        } else {
          searchString = selectedSympbol
        }

        const elementInfos = bitBakeProjectScannerClient.bitbakeScanResult._classes.filter((obj): boolean => {
          return obj.name === searchString
        })
        definition = createDefinitionForElementInfo(elementInfos)
      }
      break

    case 'require':
    case 'include':
      {
        const includeFile = path.parse(restOfLine)
        let elementInfos = bitBakeProjectScannerClient.bitbakeScanResult._includes.filter((obj): boolean => {
          return obj.name === includeFile.name
        })

        if (elementInfos.length === 0) {
          elementInfos = bitBakeProjectScannerClient.bitbakeScanResult._recipes.filter((obj): boolean => {
            return obj.name === includeFile.name
          })
        }
        definition = createDefinitionForElementInfo(elementInfos)
      }
      break

    default:
  }

  return definition
}

function createDefinitionForElementInfo (elementInfos: ElementInfo[]): Definition {
  const definition: Definition = []

  for (const elementInfo of elementInfos) {
    logger.debug(`definition ${JSON.stringify(elementInfo)}`)
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

function getDefinition (textDocumentPositionParams: TextDocumentPositionParams, documentAsText: string[]): Definition {
  let definition: Definition = []

  const currentLine = documentAsText[textDocumentPositionParams.position.line]
  const symbol = extractSymbolFromLine(textDocumentPositionParams, currentLine)

  definition = definitionProvider.createDefinitionForSymbol(symbol)
  return definition
}

function extractSymbolFromLine (textDocumentPositionParams: TextDocumentPositionParams, currentLine: string): string {
  logger.debug(`getDefinitionForSymbol ${currentLine}`)
  const linePosition: number = textDocumentPositionParams.position.character
  let symbolEndPosition: number = currentLine.length
  let symbolStartPosition: number = 0
  const rightBorderCharacter: string[] = [' ', '=', '/', '$', '+', '}', '\'', '\'', ']', '[']
  const leftBorderCharacter: string[] = [' ', '=', '/', '+', '{', '\'', '\'', '[', ']']

  for (const character of rightBorderCharacter) {
    let temp: number = currentLine.indexOf(character, linePosition)
    if (temp === -1) {
      temp = currentLine.length
    }
    symbolEndPosition = Math.min(symbolEndPosition, temp)
  }

  const symbolRightTrimed = currentLine.substring(0, symbolEndPosition)
  logger.debug(`symbolRightTrimed ${symbolRightTrimed}`)

  for (const character of leftBorderCharacter) {
    let temp: number = symbolRightTrimed.lastIndexOf(character, linePosition)
    if (temp === -1) {
      temp = 0
    }
    symbolStartPosition = Math.max(symbolStartPosition, temp)
  }

  let symbol: string = symbolRightTrimed.substring(symbolStartPosition)

  for (const character of leftBorderCharacter.concat('-')) {
    if (symbol.startsWith(character)) {
      symbol = symbol.substring(1)
      break
    }
  }

  logger.debug(`symbol ${symbol}`)

  return symbol
}
