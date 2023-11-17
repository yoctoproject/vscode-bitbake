/* --------------------------------------------------------------------------------------------
 * Copyright (c) Eugen Wiens. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import type {
  TextDocumentPositionParams, Definition
} from 'vscode-languageserver'

import {
  DefinitionProvider
} from './DefinitionProvider'

import { logger } from './lib/src/utils/OutputLogger'
import { type DirectiveStatementKeyword } from './lib/src/types/directiveKeywords'

/**
 * ContextHandler
 */
export class ContextHandler {
  private readonly _definitionProvider: DefinitionProvider

  constructor () {
    this._definitionProvider = new DefinitionProvider()
  }

  get definitionProvider (): DefinitionProvider {
    return this._definitionProvider
  }

  getDefinition (textDocumentPositionParams: TextDocumentPositionParams, documentAsText: string[]): Definition {
    let definition: Definition = []

    const currentLine: string = documentAsText[textDocumentPositionParams.position.line]
    const symbol: string = this.extractSymbolFromLine(textDocumentPositionParams, currentLine)

    definition = this._definitionProvider.createDefinitionForSymbol(symbol)
    return definition
  }

  getDefinitionForDirectives (directiveStatementKeyword: DirectiveStatementKeyword, textDocumentPositionParams: TextDocumentPositionParams, documentAsText: string[]): Definition {
    let definition: Definition = []

    const currentLine: string = documentAsText[textDocumentPositionParams.position.line]
    const symbol: string = this.extractSymbolFromLine(textDocumentPositionParams, currentLine)

    const words: string[] = currentLine.split(' ')

    if (words.length >= 2) {
      if (words[0] === directiveStatementKeyword) {
        logger.debug(`getDefinitionForKeyWord: ${JSON.stringify(words)}`)
        if (words.length === 2) {
          definition = this._definitionProvider.createDefinitionForKeyword(directiveStatementKeyword, words[1])
        } else {
          definition = this._definitionProvider.createDefinitionForKeyword(directiveStatementKeyword, words[1], symbol)
        }
      }
    }
    return definition
  }

  private extractSymbolFromLine (textDocumentPositionParams: TextDocumentPositionParams, currentLine: string): string {
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
}

const contextHandler = new ContextHandler()
export default contextHandler
