/* --------------------------------------------------------------------------------------------
 * Copyright (c) Eugen Wiens. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import {
  type CompletionItem,
  CompletionItemKind
} from 'vscode-languageserver'

import {
  type BitBakeProjectScanner
} from './BitBakeProjectScanner'

import {
  type PathInfo,
  type ElementInfo
} from './lib/src/types/BitbakeScanResult'

import {
  type SymbolScanner,
  type SymbolContent
} from './SymbolScanner'

export class CompletionProvider {
  private readonly _classCompletionItemKind: CompletionItemKind = CompletionItemKind.Class
  private readonly _includeCompletionItemKind: CompletionItemKind = CompletionItemKind.Interface
  private readonly _recipesCompletionItemKind: CompletionItemKind = CompletionItemKind.Method
  private readonly _symbolComletionItemKind: CompletionItemKind = CompletionItemKind.Variable
  private readonly _projectScanner: BitBakeProjectScanner
  private _symbolScanner: SymbolScanner | null = null

  constructor (projectScanner: BitBakeProjectScanner) {
    this._projectScanner = projectScanner
  }

  get symbolScanner (): SymbolScanner | null {
    return this._symbolScanner
  }

  set symbolScanner (symbolScanner: SymbolScanner | null) {
    this._symbolScanner = symbolScanner
  }

  getInsertStringForTheElement (item: CompletionItem): string {
    let insertString: string = item.label

    if (item.kind === this._includeCompletionItemKind) {
      const path: PathInfo = item.data.path
      let pathAsString: string = path.dir.replace(item.data.layerInfo.path, '')

      if (pathAsString.startsWith('/')) {
        pathAsString = pathAsString.slice(1)
      }

      insertString = pathAsString + '/' + item.data.path.base
    }

    return insertString
  }

  createCompletionItemForDirectiveStatementKeyword (keyword: string): CompletionItem[] {
    let completionItem: CompletionItem[] = []

    switch (keyword) {
      case 'inherit':
        completionItem = [
          ...this.convertElementInfoListToCompletionItemList(
            this._projectScanner.classes,
            this._classCompletionItemKind
          )]
        break

      case 'require':
      case 'include':
        completionItem = [
          ...this.convertElementInfoListToCompletionItemList(
            this._projectScanner.includes,
            this._includeCompletionItemKind
          )
        ]
        break
      default:
        break
    }

    return completionItem
  }

  createCompletionItemForRecipesAndSymbols (): CompletionItem[] {
    let completionItem: CompletionItem[] = []
    completionItem = [
      ...this.convertElementInfoListToCompletionItemList(
        this._projectScanner.recipes,
        this._recipesCompletionItemKind
      ),
      ...this.convertSymbolContentListToCompletionItemList(
        this._symbolScanner?.symbols ?? [],
        this._symbolComletionItemKind
      )
    ]

    return completionItem
  }

  private convertElementInfoListToCompletionItemList (elementInfoList: ElementInfo[], completionType: CompletionItemKind): CompletionItem[] {
    const completionItems: CompletionItem[] = new Array < CompletionItem >()

    for (const element of elementInfoList) {
      const completionItem: CompletionItem = {
        label: element.name,
        detail: this.getTypeAsString(completionType),
        documentation: element.extraInfo,
        data: element,
        kind: completionType
      }

      completionItems.push(completionItem)
    }

    return completionItems
  }

  private convertSymbolContentListToCompletionItemList (symbolContentList: SymbolContent[], completionType: CompletionItemKind): CompletionItem[] {
    const completionItems: CompletionItem[] = new Array < CompletionItem >()

    for (const element of symbolContentList) {
      const completionItem: CompletionItem = {
        label: element.symbolName,
        detail: this.getTypeAsString(completionType),
        documentation: '',
        data: element,
        kind: completionType
      }

      completionItems.push(completionItem)
    }

    return completionItems
  }

  private getTypeAsString (completionType: CompletionItemKind): string {
    let typeAsString: string = ''

    switch (completionType) {
      case this._classCompletionItemKind:
        typeAsString = 'class'
        break

      case this._includeCompletionItemKind:
        typeAsString = 'inc'
        break

      case this._recipesCompletionItemKind:
        typeAsString = 'recipe'
        break

      case this._symbolComletionItemKind:
        typeAsString = 'symbol'
        break
    }

    return typeAsString
  }
}
