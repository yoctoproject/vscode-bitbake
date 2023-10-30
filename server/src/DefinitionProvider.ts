/* --------------------------------------------------------------------------------------------
 * Copyright (c) Eugen Wiens. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import {
  type Definition,
  Location,
  Range
} from 'vscode-languageserver'

import {
  type ElementInfo,
  type PathInfo
} from './ElementInfo'

import {
  type BitBakeProjectScanner
} from './BitBakeProjectScanner'

import {
  type SymbolScanner,
  type SymbolContent
} from './SymbolScanner'

import { logger } from './lib/src/utils/OutputLogger'

import path from 'path'

export class DefinitionProvider {
  private readonly _projectScanner: BitBakeProjectScanner
  private _symbolScanner: SymbolScanner | null = null

  constructor (projectScanner: BitBakeProjectScanner) {
    this._projectScanner = projectScanner
  }

  // eslint-disable-next-line accessor-pairs
  set symbolScanner (symbolScanner: SymbolScanner | null) {
    this._symbolScanner = symbolScanner
  }

  createDefinitionForKeyword (keyword: string, restOfLine: string, selectedSympbol?: string): Definition {
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

          const elementInfos: ElementInfo[] = this._projectScanner.classes.filter((obj: ElementInfo): boolean => {
            return obj.name === searchString
          })
          definition = this.createDefinitionForElementInfo(elementInfos)
        }
        break

      case 'require':
      case 'include':
        {
          const includeFile: PathInfo = path.parse(restOfLine)
          let elementInfos: ElementInfo[] = this._projectScanner.includes.filter((obj: ElementInfo): boolean => {
            return obj.name === includeFile.name
          })

          if (elementInfos.length === 0) {
            elementInfos = this._projectScanner.recipes.filter((obj: ElementInfo): boolean => {
              return obj.name === includeFile.name
            })
          }
          definition = this.createDefinitionForElementInfo(elementInfos)
        }
        break

      default:
    }

    return definition
  }

  createDefinitionForSymbol (symbol: string): Definition {
    let definitions: Definition = this.createDefinitionForSymbolRecipes(symbol)

    if (definitions === null) {
      definitions = this.createDefinitionForSymbolVariables(symbol)
    }

    return definitions
  }

  private createDefinitionForSymbolRecipes (symbol: string): Definition {
    let definitions: Definition = []

    const recipe: ElementInfo | undefined = this._projectScanner.recipes.find((obj: ElementInfo): boolean => {
      return obj.name === symbol
    })

    if (recipe?.path !== undefined) {
      let definitionsList: PathInfo[] = new Array < PathInfo >(recipe.path)

      if ((recipe.appends !== undefined) && (recipe.appends.length > 0)) {
        definitionsList = definitionsList.concat(recipe.appends)
      }
      definitions = this.createDefinitionLocationForPathInfoList(definitionsList)
    }

    return definitions
  }

  private createDefinitionForSymbolVariables (symbol: string): Definition {
    let definitions: Definition = []

    if (this._symbolScanner !== null) {
      const symbols: SymbolContent[] = this._symbolScanner.symbols.filter((obj: SymbolContent): boolean => {
        return obj.symbolName === symbol
      })
      definitions = this.createDefinitionForSymbolContentList(symbols)
    } else {
      logger.debug(`Cannot create definitions for symbol ${symbol}: symbol scanner is null`)
    }

    return definitions
  }

  private createDefinitionForElementInfo (elementInfos: ElementInfo[]): Definition {
    const definition: Definition = []

    for (const elementInfo of elementInfos) {
      logger.debug(`definition ${JSON.stringify(elementInfo)}`)
      if (elementInfo.path !== undefined) {
        const location: Location = this.createDefinitionLocationForPathInfo(elementInfo.path)
        definition.push(location)
      }
    }

    return definition
  }

  private createDefinitionLocationForPathInfoList (pathInfoList: PathInfo[]): Definition {
    let definition: Definition = []

    if ((pathInfoList !== undefined) && (pathInfoList.length > 0)) {
      if (pathInfoList.length > 1) {
        definition = new Array < Location >()

        for (const pathInfo of pathInfoList) {
          logger.debug(`definition ${JSON.stringify(pathInfo)}`)
          const location: Location = this.createDefinitionLocationForPathInfo(pathInfo)

          definition.push(location)
        }
      } else {
        definition = this.createDefinitionLocationForPathInfo(pathInfoList[0])
      }
    }

    return definition
  }

  private createDefinitionLocationForPathInfo (path: PathInfo): Location {
    const url: string = 'file://' + path.dir + '/' + path.base
    const location: Location = Location.create(encodeURI(url), Range.create(0, 0, 0, 0))

    return location
  }

  private createDefinitionForSymbolContentList (symbolContent: SymbolContent[]): Definition {
    const definition: Definition = []

    for (const element of symbolContent) {
      logger.debug(`definition ${JSON.stringify(element)}`)
      const location = this.createDefinitionForSymbolContent(element)
      if (location !== undefined) {
        definition.push(location)
      }
    }

    return definition
  }

  private createDefinitionForSymbolContent (symbolContent: SymbolContent): Location | undefined {
    const url: string = 'file://' + symbolContent.filePath
    if (symbolContent.lineNumber === undefined) {
      return undefined
    }
    const range: Range = Range.create(symbolContent.lineNumber, symbolContent.startPosition,
      symbolContent.lineNumber, symbolContent.endPostion
    )

    return Location.create(encodeURI(url), range)
  }
}
