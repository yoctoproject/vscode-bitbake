/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { logger } from '../lib/src/utils/OutputLogger'
import { type TextDocumentPositionParams, type Definition, Location, Range } from 'vscode-languageserver/node'
import { analyzer } from '../tree-sitter/analyzer'
import { type DirectiveStatementKeyword } from '../lib/src/types/directiveKeywords'
import { bitBakeProjectScannerClient } from '../BitbakeProjectScannerClient'
import { type ParsedPath } from 'path'
import { type ElementInfo } from '../lib/src/types/BitbakeScanResult'
import { type BitbakeSymbolInformation } from '../tree-sitter/declarations'

export function onDefinitionHandler (textDocumentPositionParams: TextDocumentPositionParams): Location[] | null {
  const { textDocument: { uri }, position } = textDocumentPositionParams
  logger.debug(`[onDefinition] Position: Line ${position.line} Character ${position.character}`)

  const wordPosition = {
    line: position.line,
    character: Math.max(position.character - 1, 0)
  }

  const word = analyzer.wordAtPointFromTextPosition({
    ...textDocumentPositionParams,
    position: wordPosition
  })

  const documentAsText = analyzer.getDocumentTexts(uri)
  if (documentAsText === undefined) {
    logger.debug(`[onDefinition] Document not found for ${uri}`)
    return []
  }

  const lastScanResult = analyzer.getLastScanResult(uri)

  const definitions: Definition = []

  // require, inherit & include directives
  const directiveStatementKeyword = analyzer.getDirectiveStatementKeywordByNodeType(textDocumentPositionParams)
  const directivePath = analyzer.getDirectivePathForPosition(textDocumentPositionParams)
  if (directiveStatementKeyword !== undefined && directivePath !== undefined) {
    logger.debug(`[onDefinition] Found directive: ${directiveStatementKeyword}`)
    let resolvedDirectivePath = directivePath
    if (lastScanResult !== undefined) {
      resolvedDirectivePath = analyzer.resolveSymbol(directivePath, lastScanResult.symbols)
    }
    definitions.push(...getDefinitionForDirectives(directiveStatementKeyword, resolvedDirectivePath))
    logger.debug(`[onDefinition] definition item: ${JSON.stringify(definitions)}`)
    return definitions
  }

  if (word !== null) {
    const isVariableSymbol = analyzer.isIdentifierOfVariableAssignment(textDocumentPositionParams) ||
    (analyzer.isVariableExpansion(uri, position.line, position.character) && analyzer.isIdentifier(textDocumentPositionParams))
    // Variables in declartion and variable expansion syntax
    if (isVariableSymbol) {
      const symbolAtPoint = analyzer.findExactSymbolAtPoint(uri, position, word)

      // Only the ones in the declaration syntax, variable expansions are considered as references.
      const allDeclarationSymbols: BitbakeSymbolInformation[] = [
        ...analyzer.getGlobalDeclarationSymbols(uri)
      ]
      analyzer.getIncludeUrisForUri(uri)?.forEach((includeFileUri) => {
        allDeclarationSymbols.push(...analyzer.getGlobalDeclarationSymbols(includeFileUri))
      })

      allDeclarationSymbols.filter(symbol => symbol.name === word && symbol.kind === symbolAtPoint?.kind).forEach((symbol) => {
        definitions.push({
          uri: symbol.location.uri,
          range: symbol.location.range
        })
      })

      if (lastScanResult !== undefined && symbolAtPoint !== undefined) {
        const foundSymbol = analyzer.matchSymbol(symbolAtPoint, lastScanResult.symbols)
        if (foundSymbol !== undefined) {
          const modificationHistory = analyzer.extractModificationHistoryFromComments(foundSymbol)
          modificationHistory.forEach((location) => {
            definitions.push({
              uri: location.uri,
              range: location.range
            })
          })
        }
      }

      return definitions
    }
    // Symbols in string content
    if (analyzer.isStringContent(uri, position.line, position.character)) {
      const allSymbolsAtPosition = analyzer.getSymbolsInStringContent(uri, position.line, position.character)

      allSymbolsAtPosition.forEach((symbol) => {
        definitions.push({
          uri: symbol.location.uri,
          range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } }
        })
      })
      return definitions
    }
    // Overrides
    if (analyzer.isOverride(uri, position.line, position.character)) {
      if (lastScanResult !== undefined) {
        const targetPath = lastScanResult.includeHistory.find((includePath) => {
          return includePath.ext === '.conf' && includePath.name === word
        })

        if (targetPath !== undefined) {
          definitions.push(createDefinitionLocationForPathInfo(targetPath))
          return definitions
        }
      }

      const overrideFile = bitBakeProjectScannerClient.bitbakeScanResult._confFiles.find((confFile) => {
        return confFile.name === word
      })

      if (overrideFile?.path !== undefined) {
        definitions.push(createDefinitionLocationForPathInfo(overrideFile.path))
        return definitions
      }
    }
  }

  return []
}

function getDefinitionForDirectives (directiveStatementKeyword: DirectiveStatementKeyword, directivePath: string): Location[] {
  let elementInfos: ElementInfo[] = []
  switch (directiveStatementKeyword) {
    case 'inherit':
      elementInfos = bitBakeProjectScannerClient.bitbakeScanResult._classes.filter((bbclass): boolean => {
        return bbclass.name === directivePath
      })
      break

    case 'require':
    case 'include':
      elementInfos = analyzer.findFilesInProjectScanner(directivePath)
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
