/* --------------------------------------------------------------------------------------------
 * Copyright (c) Eugen Wiens. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import type {
  TextDocumentPositionParams,
  CompletionItem, Definition
} from 'vscode-languageserver'

import type {
  BitBakeProjectScanner
} from './BitBakeProjectScanner'

import {
  DefinitionProvider
} from './DefinitionProvider'

import {
  CompletionProvider
} from './CompletionProvider'

import type {
  SymbolScanner
} from './SymbolScanner'

import { logger } from './lib/src/utils/OutputLogger'
import bitBakeProjectScanner from './BitBakeProjectScanner'

/**
 * ContextHandler
 */
export class ContextHandler {
  private readonly _projectScanner: BitBakeProjectScanner
  private readonly _definitionProvider: DefinitionProvider
  private readonly _completionProvider: CompletionProvider

  constructor (projectScanner: BitBakeProjectScanner) {
    this._projectScanner = projectScanner
    this._definitionProvider = new DefinitionProvider(this._projectScanner)
    this._completionProvider = new CompletionProvider(this._projectScanner)
  }

  getDefinition (textDocumentPositionParams: TextDocumentPositionParams, documentAsText: string[]): Definition {
    let definition: Definition = []

    const currentLine: string = documentAsText[textDocumentPositionParams.position.line]
    const symbol: string = this.extractSymbolFromLine(textDocumentPositionParams, currentLine)

    definition = this._definitionProvider.createDefinitionForSymbol(symbol)
    return definition
  }

  getDefinitionForDirectives (directiveStatementKeyword: string, textDocumentPositionParams: TextDocumentPositionParams, documentAsText: string[]): Definition {
    let definition: Definition = []

    const currentLine: string = documentAsText[textDocumentPositionParams.position.line]
    const symbol: string = this.extractSymbolFromLine(textDocumentPositionParams, currentLine)

    definition = this.getDefinitionForKeyWord(directiveStatementKeyword, currentLine, symbol)
    return definition
  }

  get definitionProvider (): DefinitionProvider {
    return this._definitionProvider
  }

  // eslint-disable-next-line accessor-pairs -- adding a setter would be pointless and weird
  set symbolScanner (symbolScanner: SymbolScanner | null) {
    this._completionProvider.symbolScanner = symbolScanner
    this._definitionProvider.symbolScanner = symbolScanner
  }

  private getDefinitionForKeyWord (keyWord: string, currentLine: string, selectedSympbol?: string): Definition {
    let definition: Definition = []
    const words: string[] = currentLine.split(' ')

    if (words.length >= 2) {
      if (words[0] === keyWord) {
        logger.debug(`getDefinitionForKeyWord: ${JSON.stringify(words)}`)
        if (words.length === 2) {
          definition = this._definitionProvider.createDefinitionForKeyword(keyWord, words[1])
        } else {
          definition = this._definitionProvider.createDefinitionForKeyword(keyWord, words[1], selectedSympbol)
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

  getCompletionItemForDirectiveStatementKeyword (keyword: string): CompletionItem[] {
    return this._completionProvider.createCompletionItemForDirectiveStatementKeyword(keyword)
  }

  getCompletionItemForRecipesAndSymbols (): CompletionItem[] {
    return this._completionProvider.createCompletionItemForRecipesAndSymbols()
  }

  getInsertStringForTheElement (item: CompletionItem): string {
    return this._completionProvider.getInsertStringForTheElement(item)
  }
}

const contextHandler = new ContextHandler(bitBakeProjectScanner)
export default contextHandler
