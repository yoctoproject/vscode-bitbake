/* --------------------------------------------------------------------------------------------
 * Copyright (c) Eugen Wiens. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import fs from 'fs'

import type {
  Definition,
  Location
} from 'vscode-languageserver'

import type {
  DefinitionProvider
} from './DefinitionProvider'

import { logger } from './lib/src/utils/OutputLogger'
import { DIRECTIVE_STATEMENT_KEYWORDS } from './lib/src/types/directiveKeywords'

interface FileContent {
  filePath: string
  fileContent: string[]
}

export interface SymbolContent {
  symbolName: string
  startPosition: number
  endPostion: number
  filePath?: string
  lineNumber?: number
}

export class SymbolScanner {
  private readonly _fileContent: FileContent[] = new Array < FileContent >()
  private readonly _definitionProvider: DefinitionProvider
  private readonly _symbolsDefinition: SymbolContent[] = new Array < SymbolContent >()

  constructor (fileUrlAsString: string, definitionProvider: DefinitionProvider) {
    logger.debug(`scan for symbols file: ${fileUrlAsString}`)

    this._definitionProvider = definitionProvider

    this.extendsFile(this.convertUriStringToFilePath(fileUrlAsString))
    this.scanForSymbols()
  }

  get symbols (): SymbolContent[] {
    return this._symbolsDefinition
  }

  private extendsFile (filePath: string): void {
    logger.debug(`extendsFile file: ${filePath}`)

    try {
      const data: Buffer = fs.readFileSync(filePath)
      const file: string[] = data.toString().split(/\r?\n/g)

      this._fileContent.push({
        filePath,
        fileContent: file
      })

      for (const line of file) {
        const words = line.split(' ')

        if (new Set(DIRECTIVE_STATEMENT_KEYWORDS).has(words[0])) {
          logger.debug(`Directive statement keyword found: ${words[0]}`)
          this.handleKeyword(words[0], line)
        }
      }
    } catch (error) {
      if (error instanceof Error) { // Check if error is an instance of the native JavaScript Error class
        logger.error(`Error reading file at ${filePath}: ${error.message}`)
      } else if (typeof error === 'string') {
        logger.error(`Error reading file at ${filePath}: ${error}`)
      } else {
        logger.error(`An unknown error occurred while reading the file at ${filePath}`)
      }
    }
  }

  private handleKeyword (keyword: string, line: string): void {
    const restOfLine: string[] = line.split(keyword).filter(String)

    if (restOfLine.length === 1) {
      const listOfSymbols: string[] = restOfLine[0].split(' ').filter(String)
      let definition: Definition = new Array < Location >()

      if (listOfSymbols.length === 1) {
        definition = definition.concat(this._definitionProvider.createDefinitionForKeyword(keyword, restOfLine[0]))
      } else if (listOfSymbols.length > 1) {
        for (const symbol of listOfSymbols) {
          definition = definition.concat(this._definitionProvider.createDefinitionForKeyword(keyword, restOfLine[0], symbol))
        }
      }

      for (const location of definition) {
        if (location !== null) {
          this.extendsFile(this.convertUriStringToFilePath(location.uri))
        }
      }
    }
  }

  private convertUriStringToFilePath (fileUrlAsString: string): string {
    const fileUrl = new URL(fileUrlAsString)
    // Use decodeURIComponent to properly decode each part of the URL
    // This correctly decodes url in Windows such as %3A -> :
    let filePath: string = decodeURIComponent(fileUrl.pathname)

    // For Windows, remove the leading slash if it exists
    if (process.platform === 'win32' && filePath.startsWith('/')) {
      filePath = filePath.substring(1)
    }

    return filePath
  }

  private scanForSymbols (): void {
    for (const file of this._fileContent) {
      for (const line of file.fileContent) {
        const lineIndex: number = file.fileContent.indexOf(line)
        const regex = /^\s*(?:export)?\s*(\w*(?:\[\w*\])?)\s*(?:=|:=|\+=|=\+|-=|=-|\?=|\?\?=|\.=|=\.)/g
        const symbolContent = this.investigateLine(line, regex)

        if (symbolContent !== undefined) {
          symbolContent.filePath = file.filePath
          symbolContent.lineNumber = lineIndex

          this._symbolsDefinition.push(symbolContent)
        }
      }
    }
  }

  private investigateLine (lineString: string, regex: RegExp): SymbolContent | undefined {
    let m

    while ((m = regex.exec(lineString)) !== null) {
      // This is necessary to avoid infinite loops with zero-width matches
      if (m.index === regex.lastIndex) {
        regex.lastIndex++
      }

      if (m.length === 2) {
        const symbol: string = m[1]
        const filterdSymbolName = this.filterSymbolName(symbol)
        if (filterdSymbolName === undefined) {
          return undefined
        }
        const symbolStartPosition: number = lineString.indexOf(symbol)
        const symbolEndPosition: number = symbolStartPosition + symbol.length

        return {
          symbolName: filterdSymbolName,
          startPosition: symbolStartPosition,
          endPostion: symbolEndPosition
        }
      }
    }

    return undefined
  }

  private filterSymbolName (symbol: string): string | undefined {
    const regex = /^\w*/g
    let m
    let filterdSymbolName: string | undefined

    while ((m = regex.exec(symbol)) !== null) {
      // This is necessary to avoid infinite loops with zero-width matches
      if (m.index === regex.lastIndex) {
        regex.lastIndex++
      }

      filterdSymbolName = m[0]
    }

    return filterdSymbolName
  }
}
