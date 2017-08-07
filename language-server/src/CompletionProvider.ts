/* --------------------------------------------------------------------------------------------
* Copyright (c) Eugen Wiens. All rights reserved.
* Licensed under the MIT License. See License.txt in the project root for license information.
* ------------------------------------------------------------------------------------------ */
'use strict';

import {
    CompletionItem,
    CompletionItemKind
} from "vscode-languageserver";

import {
    BitBakeProjectScanner
} from "./BitBakeProjectScanner";

import {
    ElementInfo,
    LayerInfo,
    PathInfo
} from "./ElementInfo";

import {
    BasicKeywordMap
} from './BasicKeywordMap';
import { SymbolScanner } from "./SymbolScanner";

export class CompletionProvider {

    private _classCompletionItemKind: CompletionItemKind = CompletionItemKind.Class;
    private _includeCompletionItemKind: CompletionItemKind = CompletionItemKind.Interface;
    private _recipesCompletionItemKind: CompletionItemKind = CompletionItemKind.Method;
    private _symbolComletionItemKind: CompletionItemKind = CompletionItemKind.Variable;
    private _projectScanner: BitBakeProjectScanner;
    private _symbolScanner: SymbolScanner;
    

    constructor(projectScanner: BitBakeProjectScanner) {
        this._projectScanner = projectScanner;

    }

    set symbolScanner(symbolScanner: SymbolScanner) {
        this._symbolScanner = symbolScanner;
    }

    getInsertStringForTheElement(item: CompletionItem): string {
        let insertString: string = item.label;

        if (item.kind === this._includeCompletionItemKind) {
            let path: PathInfo = item.data.path;
            let pathAsString: string = path.dir.replace(item.data.layerInfo.path, '');

            if( pathAsString.startsWith('/') === true ) {
                pathAsString = pathAsString.substr(1);
            }

            insertString = pathAsString + '/' + item.data.path.base;
        }

        return insertString
    }

    createCompletionItem(keyword: string): CompletionItem[] {
        let completionItem: CompletionItem[] = new Array < CompletionItem > ();

        switch (keyword) {
            case 'inherit':
                completionItem = this.convertElementInfoListToCompletionItemList(
                    this._projectScanner.classes,
                    this._classCompletionItemKind
                );
                break;

            case 'require':
            case 'include':
                completionItem = completionItem.concat(
                    this.convertElementInfoListToCompletionItemList(
                        this._projectScanner.includes,
                        this._includeCompletionItemKind
                    )
                );
                break;

            default:
                completionItem = completionItem.concat(
                    this.convertElementInfoListToCompletionItemList(
                        this._projectScanner.classes,
                        this._classCompletionItemKind
                    ),
                    this.convertElementInfoListToCompletionItemList(
                        this._projectScanner.includes,
                        this._includeCompletionItemKind
                    ),
                    this.convertElementInfoListToCompletionItemList(
                        this._projectScanner.recipes,
                        this._recipesCompletionItemKind
                    ),
                    this.convertSymbolContentListToCompletionItemList(
                        this._symbolScanner.symbols,
                        this._symbolComletionItemKind
                    ),
                    BasicKeywordMap
                );

                break;
        }

        return completionItem;
    }

    private convertElementInfoListToCompletionItemList(elementInfoList, completionType: CompletionItemKind): CompletionItem[] {
        let completionItems: CompletionItem[] = new Array < CompletionItem > ();

        for (let element of elementInfoList) {
            let completionItem: CompletionItem = {
                label: element.name,
                detail: this.getTypeAsString(completionType),
                documentation: element.extraInfo,
                data: element,
                kind: completionType
            };

            completionItems.push(completionItem);
        }

        return completionItems;
    }

    private convertSymbolContentListToCompletionItemList(symbolContentList, completionType: CompletionItemKind): CompletionItem[] {
        let completionItems: CompletionItem[] = new Array < CompletionItem > ();

        for (let element of symbolContentList) {
            let completionItem: CompletionItem = {
                label: element.symbolName,
                detail: this.getTypeAsString(completionType),
                documentation: '',
                data: element,
                kind: completionType
            };

            completionItems.push(completionItem);
        }

        return completionItems;
    }

    private getTypeAsString(completionType: CompletionItemKind): string {
        let typeAsString: string = '';

        switch (completionType) {
            case this._classCompletionItemKind:
                typeAsString = 'class';
                break;

            case this._includeCompletionItemKind:
                typeAsString = 'inc';
                break;

            case this._recipesCompletionItemKind:
                typeAsString = 'recipe';
                break;

            case this._symbolComletionItemKind:
                typeAsString = 'symbol';
                break;
        }

        return typeAsString;
    }
}