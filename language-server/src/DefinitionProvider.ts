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
    BitBakeProjectScanner,
    ElementInfo,
    PathInfo
} from "./BitBakeProjectScanner";

const path = require('path');


export class DefinitionProvider {
    private _projectScanner: BitBakeProjectScanner;

    constructor(projectScanner: BitBakeProjectScanner) {
        this._projectScanner = projectScanner;
    }

    createDefinitionForKeyword(keyword: string, restOfLine: string): Definition {
        let definition: Definition = null;

        switch (keyword) {
            case 'inherit':
                {
                    let elementInfos: ElementInfo[] = this._projectScanner.classes.filter((obj: ElementInfo): boolean => {
                        return obj.name === restOfLine;
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
                    definition = this.createDefinitionForElementInfo(elementInfos);
                }
                break;

            default:
        }

        return definition;
    }

    createDefinitionForSymbol(symbol: string): Definition {
        let definitions: Definition = null;

        let recipe: ElementInfo = this._projectScanner.recipes.find((obj: ElementInfo): boolean => {
            return obj.name === symbol;
        });

        if (recipe !== undefined) {
            let definitionsList: PathInfo[] = new Array < PathInfo > (recipe.path);

            if ((recipe.appends !== undefined) && (recipe.appends.length > 0) {
                definitionsList = definitionsList.concat(recipe.appends);
            }
            definitions = this.createDefinitionLocationForPathInfoList(definitionsList);
        }

        return definitions;
    }

    private createDefinitionForElementInfo(elementInfos: ElementInfo[]): Definition {
        let definition: Definition = null;

        if ((elementInfos !== undefined) && (elementInfos.length > 0)) {
            if (elementInfos.length > 1) {
                definition = new Array < Location > ();

                for (let elementInfo of elementInfos) {
                    console.log(`definition ${JSON.stringify(elementInfo)}`);
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
                    console.log(`definition ${JSON.stringify(pathInfo)}`);
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
}