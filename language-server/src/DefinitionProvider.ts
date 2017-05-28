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


    createDefinition(keyword: string, restOfLine: string): Definition {
        let definition: Definition = null;

        switch (keyword) {
            case 'inherit':
                definition = this.createDefinitionForElementInfo(this._projectScanner.classes, restOfLine);
                break;

            case 'require':
            case 'include':
                let includeFile: PathInfo = path.parse(restOfLine);
                definition = this.createDefinitionForElementInfo(this._projectScanner.includes, includeFile.name);
                break;

            default:
        }

        return definition;
    }

    private createDefinitionForElementInfo(elements: ElementInfo[], restOfLine: string): Definition {
        let definition: Definition = null;
        let elementInfos: ElementInfo[] = elements.filter((obj: ElementInfo): boolean => {
            return obj.name === restOfLine;
        });

        if( (elementInfos !== undefined) && (elementInfos.length > 0) ) {
            if (elementInfos.length > 1) {
                definition = new Array < Location > ();

                for (let elementInfo of elementInfos) {
                    console.log(`definition ${JSON.stringify(elementInfo)}`);
                    let location: Location = this.createDefinitionLocationForElement(elementInfo);

                    definition.push(location);
                }
            } else {
                definition = this.createDefinitionLocationForElement(elementInfos[0]);
            }
        }

        return definition;
    }

    private createDefinitionLocationForElement(element: ElementInfo): Location {
        let url: string = 'file://' + element.path.dir + '/' + element.path.base;
        let location: Location = Location.create(url, Range.create(0, 0, 0, 0));

        return location;
    }

}