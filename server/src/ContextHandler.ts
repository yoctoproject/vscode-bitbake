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
  BasicKeywordMap
} from './BasicKeywordMap'

import {
  DefinitionProvider
} from './DefinitionProvider'

import {
  CompletionProvider
} from './CompletionProvider'

import type {
  SymbolScanner
} from './SymbolScanner'

import logger from 'winston'
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

    if (documentAsText.length > textDocumentPositionParams.position.line) {
      const keyWord: string = this.getKeyWord(textDocumentPositionParams, documentAsText)
      const currentLine: string = documentAsText[textDocumentPositionParams.position.line]
      const symbol: string = this.extractSymbolFromLine(textDocumentPositionParams, currentLine)

      if ((keyWord !== undefined) && (keyWord !== '')) {
        definition = this.getDefinitionForKeyWord(keyWord, currentLine, symbol)
      } else {
        definition = this._definitionProvider.createDefinitionForSymbol(symbol)
      }
    }
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

  getComletionItems (textDocumentPosition: TextDocumentPositionParams, documentAsText: string[]): CompletionItem[] {
    let completionItem: CompletionItem[] = []

    if (documentAsText.length > textDocumentPosition.position.line) {
      const keyWord: string = this.getKeyWord(textDocumentPosition, documentAsText)

      if ((keyWord === undefined) || (keyWord === '')) {
        completionItem = this._completionProvider.createCompletionItem('*')
      } else {
        completionItem = this._completionProvider.createCompletionItem(keyWord)
      }
    }

    return completionItem
  }

  getInsertStringForTheElement (item: CompletionItem): string {
    return this._completionProvider.getInsertStringForTheElement(item)
  }

  private getKeyWord (textDocumentPosition: TextDocumentPositionParams, documentAsText: string[]): string {
    const currentLine = documentAsText[textDocumentPosition.position.line]
    const lineTillCurrentPosition = currentLine.substring(0, textDocumentPosition.position.character)
    const words: string[] = lineTillCurrentPosition.split(' ')

    const basicKeywordMap: CompletionItem[] = BasicKeywordMap
    let keyword: string = ''

    if (words.length > 1) {
      const basicKey: CompletionItem | undefined = basicKeywordMap.find((obj: CompletionItem): boolean => {
        return obj.label === words[0]
      })

      if (basicKey !== undefined) {
        keyword = basicKey.label
      }
    }

    return keyword
  }
}

const contextHandler = new ContextHandler(bitBakeProjectScanner)
export default contextHandler
