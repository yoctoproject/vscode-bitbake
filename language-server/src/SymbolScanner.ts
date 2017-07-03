/* --------------------------------------------------------------------------------------------
 * Copyright (c) Eugen Wiens. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
'use strict';

const url = require('url')
const fs = require('fs');

import {
    BasicKeywordMap
} from "./BasicKeywordMap";

import {
    CompletionItem,
    Definition,
    Location
} from 'vscode-languageserver';

import {
    DefinitionProvider
} from "./DefinitionProvider";

type FileContent = {
    filePath: string,
    fileContent: string[]
};

export type SymbolContent = {
    symbolName: string,
    startPosition: number,
    endPostion: number,
    filePath ? : string,
    lineNumber ? : number
};


export class SymbolScanner {

    private _fileContent: FileContent[] = new Array < FileContent > ();
    private _definitionProvider: DefinitionProvider = null;
    private _symbolsDefinition: SymbolContent[] = new Array < SymbolContent > ();

    constructor(fileUrlAsString: string, definitionProvider: DefinitionProvider) {
        console.log(`scan for symbols file: ${fileUrlAsString}`);

        this._definitionProvider = definitionProvider;

        this.extendsFile(this.convertUriStringToFilePath(fileUrlAsString));
        this.scanForSymbols();

        this._definitionProvider.symbolScanner = this;
    }

    cleanSymbols() {
        this._definitionProvider.symbolScanner = null;
    }

    get symbols(): SymbolContent[] {
        return this._symbolsDefinition;
    }

    private extendsFile(filePath: string) {
        console.log(`extendsFile file: ${filePath}`);

        try {
            let data: Buffer = fs.readFileSync(filePath);
            let file: string[] = data.toString().split(/\r?\n/g);

            this._fileContent.push({
                filePath: filePath,
                fileContent: file
            });

            for (let line of file) {
                let keyword = this.lineContainsKeyword(line);

                if (keyword !== undefined) {
                    console.log(`keyword found: ${keyword}`);
                    this.handleKeyword(keyword, line);
                }
            }

        } catch (error) {
            console.error(`can not open file error: ${error}`)
        }
    }

    private lineContainsKeyword(line: string): string {
        let foundKeyword: string = undefined;
        let keywords: CompletionItem[] = BasicKeywordMap;

        let trimedLine = line.trim();

        for (let keyword of keywords) {
            if (trimedLine.startsWith(keyword.label) === true) {
                foundKeyword = keyword.label;
            }
        }

        return foundKeyword;
    }

    private handleKeyword(keyword: string, line: string) {
        let restOfLine: string[] = line.split(keyword).filter(String);

        if (restOfLine.length === 1) {
            let listOfSymbols: string[] = restOfLine[0].split(' ').filter(String);
            let definition: Definition = new Array < Location > ();

            if (listOfSymbols.length === 1) {
                definition = definition.concat(this._definitionProvider.createDefinitionForKeyword(keyword, restOfLine[0]));
            } else if (listOfSymbols.length > 1) {
                for (let symbol of listOfSymbols) {
                    definition = definition.concat(this._definitionProvider.createDefinitionForKeyword(keyword, restOfLine[0], symbol));
                }
            }

            for (let location of definition) {
                this.extendsFile(this.convertUriStringToFilePath(location.uri));
            }
        }

    }

    private convertUriStringToFilePath(fileUrlAsString: string): string {
        let fileUrl = url.parse(fileUrlAsString);
        let filePath: string = fileUrl.pathname;

        return filePath;
    }

    private scanForSymbols() {
        for (let file of this._fileContent) {
            for (let line of file.fileContent) {
                let lineIndex: number = file.fileContent.indexOf(line);
                let symbolContent: SymbolContent = this.investigateLine(line);

                if (symbolContent !== undefined) {
                    symbolContent.filePath = file.filePath;
                    symbolContent.lineNumber = lineIndex;

                    console.log(`lineNumber: ${lineIndex} symbol: ${JSON.stringify(symbolContent)}`);
                    this._symbolsDefinition.push(symbolContent);
                }
            }
        }
    }

    private investigateLine(lineString: string): SymbolContent {
        let symbolContent: SymbolContent = undefined;
        const regex = /^\s*(?:export)?\s*(\w*(?:\[\w*\])?)\s*(?:=|:=|\+=|=\+|-=|=-|\?=|\?\?=|\.=|=\.)/g;
        let m;

        while ((m = regex.exec(lineString)) !== null) {
            // This is necessary to avoid infinite loops with zero-width matches
            if (m.index === regex.lastIndex) {
                regex.lastIndex++;
            }

            if (m.length === 2) {
                let symbol: string = m[1];
                let symbolStartPosition: number = lineString.indexOf(symbol);
                let symbolEndPosition: number = symbolStartPosition + symbol.length;
                let filterdSymbolName: string = this.filterSymbolName(symbol);

                symbolContent = {
                    symbolName: filterdSymbolName,
                    startPosition: symbolStartPosition,
                    endPostion: symbolEndPosition
                };
            }
        }

        return symbolContent;
    }

    private filterSymbolName(symbol: string): string {
        const regex = /^\w*/g;
        let m;
        let filterdSymbolName: string = undefined;

        while ((m = regex.exec(symbol)) !== null) {
            // This is necessary to avoid infinite loops with zero-width matches
            if (m.index === regex.lastIndex) {
                regex.lastIndex++;
            }

            filterdSymbolName = m[0];
        }

        return filterdSymbolName;
    }
}