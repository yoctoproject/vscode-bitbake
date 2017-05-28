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
    BitBakeProjectScanner,
    ElementInfo,
    PathInfo
} from "./BitBakeProjectScanner";

import {
    BasicKeywordMap
} from './BasicKeywordMap';

export class CompletionProvider {

    private _classCompletionItemKind: CompletionItemKind = CompletionItemKind.Class;
    private _includeCompletionItemKind: CompletionItemKind = CompletionItemKind.Interface;
    private _recipesCompletionItemKind: CompletionItemKind = CompletionItemKind.Method;
    private _projectScanner: BitBakeProjectScanner;

    constructor(projectScanner: BitBakeProjectScanner) {
        this._projectScanner = projectScanner;

    }

    getInsertStringForTheElement(item: CompletionItem): string {
        let insertString: string = item.label;

        if (item.kind === this._includeCompletionItemKind) {
            let path: PathInfo = item.data.path;
            let pathToRemove: string = this._projectScanner.projectPath + '/' + item.data.layerInfo.name + '/';
            let pathAsString: string = path.dir.replace(pathToRemove, '');
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
        }

        return typeAsString;
    }
}