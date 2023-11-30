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
import { type PathInfo, type ElementInfo } from '../lib/src/types/BitbakeScanResult'

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

function getDefinitionForDirectives (directiveStatementKeyword: DirectiveStatementKeyword, symbol: string): Definition {
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

function getDefinition (textDocumentPositionParams: TextDocumentPositionParams, documentAsText: string[]): Definition {
  let definition: Definition = []

  const currentLine = documentAsText[textDocumentPositionParams.position.line]
  const symbol = extractSymbolFromLine(textDocumentPositionParams, currentLine)

  definition = createDefinitionForSymbol(symbol)
  return definition
}

function createDefinitionForSymbol (symbol: string): Definition {
  return createDefinitionForSymbolRecipes(symbol)
}

function createDefinitionForSymbolRecipes (symbol: string): Definition {
  let definitions: Definition = []

  const recipe: ElementInfo | undefined = bitBakeProjectScannerClient.bitbakeScanResult._recipes.find((obj: ElementInfo): boolean => {
    return obj.name === symbol
  })

  if (recipe?.path !== undefined) {
    let definitionsList: PathInfo[] = new Array < PathInfo >(recipe.path)

    if ((recipe.appends !== undefined) && (recipe.appends.length > 0)) {
      definitionsList = definitionsList.concat(recipe.appends)
    }
    definitions = createDefinitionLocationForPathInfoList(definitionsList)
  }

  return definitions
}

function createDefinitionLocationForPathInfoList (pathInfoList: PathInfo[]): Definition {
  let definition: Definition = []

  if ((pathInfoList !== undefined) && (pathInfoList.length > 0)) {
    if (pathInfoList.length > 1) {
      definition = new Array < Location >()

      for (const pathInfo of pathInfoList) {
        logger.debug(`definition ${JSON.stringify(pathInfo)}`)
        const location: Location = createDefinitionLocationForPathInfo(pathInfo)

        definition.push(location)
      }
    } else {
      definition = createDefinitionLocationForPathInfo(pathInfoList[0])
    }
  }

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
