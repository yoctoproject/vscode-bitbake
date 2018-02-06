/* --------------------------------------------------------------------------------------------
 * Copyright (c) Eugen Wiens. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
'use strict';

import {
    Definition,
    Location,
    Range
} from "vscode-languageserver";

import {
    ElementInfo,
    PathInfo
} from "./ElementInfo";

import {
    BitBakeProjectScanner,
} from "./BitBakeProjectScanner";

import {
    SymbolScanner,
    SymbolContent
} from "./SymbolScanner";

var logger = require('winston');

const path = require('path');


export class DefinitionProvider {
    private _projectScanner: BitBakeProjectScanner = null;
    private _symbolScanner: SymbolScanner = null;

    constructor(projectScanner: BitBakeProjectScanner) {
        this._projectScanner = projectScanner;
    }

    set symbolScanner(symbolScanner: SymbolScanner) {
        this._symbolScanner = symbolScanner;
    }

    createDefinitionForKeyword(keyword: string, restOfLine: string, selectedSympbol ? : string): Definition {
        let definition: Definition = null;
        restOfLine = restOfLine.trim();

        switch (keyword) {
            case 'inherit':
                {
                    let searchString: string;
                    if (selectedSympbol === undefined) {
                        searchString = restOfLine;
                    } else {
                        searchString = selectedSympbol;
                    }

                    let elementInfos: ElementInfo[] = this._projectScanner.classes.filter((obj: ElementInfo): boolean => {
                        return obj.name === searchString;
                    });
                    definition = this.createDefinitionForElementInfo(elementInfos);
                }
                break;

            case 'require':
            case 'include':
                {
                    let includeFile: PathInfo = path.parse(restOfLine);
                    let elementInfos: ElementInfo[] = this._projectScanner.includes.filter((obj: ElementInfo): boolean => {
                        return obj.name === includeFile.name;
                    });

                    if( elementInfos.length == 0 ) {
                        elementInfos = this._projectScanner.recipes.filter((obj: ElementInfo): boolean => {
                            return obj.name === includeFile.name;
                        });
                    }
                    definition = this.createDefinitionForElementInfo(elementInfos);
                }
                break;

            default:
        }

        return definition;
    }

    createDefinitionForSymbol(symbol: string): Definition {
        let definitions: Definition = this.createDefinitionForSymbolRecipes(symbol);

        if (definitions === null) {
            definitions = this.createDefinitionForSymbolVariables(symbol);
        }


        return definitions;
    }

    private createDefinitionForSymbolRecipes(symbol: string): Definition {
        let definitions: Definition = null;

        let recipe: ElementInfo = this._projectScanner.recipes.find((obj: ElementInfo): boolean => {
            return obj.name === symbol;
        });

        if (recipe !== undefined) {
            let definitionsList: PathInfo[] = new Array < PathInfo > (recipe.path);

            if ((recipe.appends !== undefined) && (recipe.appends.length > 0)) {
                definitionsList = definitionsList.concat(recipe.appends);
            }
            definitions = this.createDefinitionLocationForPathInfoList(definitionsList);
        }

        return definitions;
    }

    private createDefinitionForSymbolVariables(symbol: string): Definition {
        let definitions: Definition = null;

        let symbols: SymbolContent[] = this._symbolScanner.symbols.filter((obj: SymbolContent): boolean => {
            return obj.symbolName === symbol;
        });

        definitions = this.createDefinitionForSymbolContentList(symbols);
        
        return definitions;
    }

    private createDefinitionForElementInfo(elementInfos: ElementInfo[]): Definition {
        let definition: Definition = null;

        if ((elementInfos !== undefined) && (elementInfos.length > 0)) {
            if (elementInfos.length > 1) {
                definition = new Array < Location > ();

                for (let elementInfo of elementInfos) {
                    logger.debug(`definition ${JSON.stringify(elementInfo)}`);
                    let location: Location = this.createDefinitionLocationForPathInfo(elementInfo.path);

                    definition.push(location);
                }
            } else {
                definition = this.createDefinitionLocationForPathInfo(elementInfos[0].path);
            }
        }

        return definition;
    }

    private createDefinitionLocationForPathInfoList(pathInfoList: PathInfo[]): Definition {
        let definition: Definition = null;

        if ((pathInfoList !== undefined) && (pathInfoList.length > 0)) {
            if (pathInfoList.length > 1) {
                definition = new Array < Location > ();

                for (let pathInfo of pathInfoList) {
                    logger.debug(`definition ${JSON.stringify(pathInfo)}`);
                    let location: Location = this.createDefinitionLocationForPathInfo(pathInfo);

                    definition.push(location);
                }
            } else {
                definition = this.createDefinitionLocationForPathInfo(pathInfoList[0]);
            }
        }

        return definition;
    }

    private createDefinitionLocationForPathInfo(path: PathInfo): Location {
        let url: string = 'file://' + path.dir + '/' + path.base;
        let location: Location = Location.create(encodeURI(url), Range.create(0, 0, 0, 0));

        return location;
    }

    private createDefinitionForSymbolContentList(symbolContent: SymbolContent[]): Definition {
        let definition: Definition = null;

        if ((symbolContent !== undefined) && (symbolContent.length > 0)) {
            if (symbolContent.length > 1) {
                definition = new Array < Location > ();

                for (let element of symbolContent) {
                    logger.debug(`definition ${JSON.stringify(element)}`);
                    let location: Location = this.createDefinitionForSymbolContent(element);

                    definition.push(location);
                }
            } else {
                definition = this.createDefinitionForSymbolContent(symbolContent[0]);
            }
        }

        return definition;
    }

    private createDefinitionForSymbolContent(symbolContent: SymbolContent): Location {
        let url: string = 'file://' + symbolContent.filePath;
        let range: Range = Range.create(symbolContent.lineNumber, symbolContent.startPosition,
                symbolContent.lineNumber, symbolContent.endPostion);

        return Location.create(encodeURI(url), range);
    }
}