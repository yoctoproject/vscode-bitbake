/* --------------------------------------------------------------------------------------------
 * Copyright (c) Eugen Wiens. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.Diagnstic
 * ------------------------------------------------------------------------------------------ */
'use strict';

const execa = require('execa');
const find = require('find');
const path = require('path');
const url = require('url')

var logger = require('winston');

import {
    IConnection
} from 'vscode-languageserver';

import {
    ElementInfo,
    LayerInfo,
    PathInfo
} from "./ElementInfo";

type ScannStatus = {
    scanIsRunning: boolean,
    scanIsPending: boolean
}

/**
 * BitBakeProjectScanner
 */
export class BitBakeProjectScanner {

    private _classFileExtension: string = 'bbclass';
    private _includeFileExtension: string = 'inc';
    private _recipesFileExtension: string = 'bb';
    private _configFileExtension: string = 'conf';

    private _projectPath: string;
    private _layers: LayerInfo[] = new Array < LayerInfo > ();
    private _classes: ElementInfo[] = new Array < ElementInfo > ();
    private _includes: ElementInfo[] = new Array < ElementInfo > ();
    private _recipes: ElementInfo[] = new Array < ElementInfo > ();
    private _deepExamine: boolean = false;
    private _connection: IConnection = null;

    private _scanStatus: ScannStatus = {
        scanIsRunning: false,
        scanIsPending: false
    };

    constructor(connection: IConnection) {
        this._connection = connection;
    }

    setprojectPath(projectPath: string) {
        this._projectPath = projectPath;
    }

    get projectPath(): string {
        return this._projectPath;
    }

    get layers(): LayerInfo[] {
        return this._layers;
    }

    get classes(): ElementInfo[] {
        return this._classes;
    }

    get includes(): ElementInfo[] {
        return this._includes;
    }

    get recipes(): ElementInfo[] {
        return this._recipes;
    }

    set deepExamine(deepExamine: boolean) {
        this._deepExamine = deepExamine;
    }

    rescanProject() {
        logger.info(`request rescanProject ${this._projectPath}`);

        if (this._scanStatus.scanIsRunning === false) {
            this._scanStatus.scanIsRunning = true;
            logger.info('start rescanProject');

            try {
                this.parseAllRecipes();
                this.scanAvailableLayers();
                this.scanForClasses();
                this.scanForIncludeFiles();
                this.scanForRecipes();
                this.scanRecipesAppends();

                logger.info('scan ready');
                this.printScanStatistic();
            } catch (error) {
                logger.error(`scanning of project is abborted error: ${error}`)
            }

            this._scanStatus.scanIsRunning = false;

            if (this._scanStatus.scanIsPending === true) {
                this._scanStatus.scanIsPending = false;
                this.rescanProject();
            }
        } else {
            logger.info('scan is already running, set the pending flag');
            this._scanStatus.scanIsPending = true;
        }
    }

    private printScanStatistic() {
        logger.info(`Scan results for path: ${this._projectPath}`);
        logger.info('******************************************************************');
        logger.info(`Layer:     ${this._layers.length}`);
        logger.info(`Recipes:   ${this._recipes.length}`);
        logger.info(`Inc-Files: ${this._includes.length}`);
        logger.info(`bbclass:   ${this._classes.length}`);
    }

    private scanForClasses() {
        this._classes = this.searchFiles(this._classFileExtension);
    }

    private scanForIncludeFiles() {
        this._includes = this.searchFiles(this._includeFileExtension);
    }

    private scanAvailableLayers() {
        this._layers = new Array < LayerInfo > ();

        let output: string = this.executeCommandInBitBakeEnvironment('bitbake-layers show-layers');

        if (output.length > 0) {
            try {
                let tempStr: string[] = output.split('\n');
                tempStr = tempStr.slice(2);

                for (let element of tempStr) {
                    let tempElement: string[] = element.split(/\s+/);
                    let layerElement = {
                        name: tempElement[0],
                        path: tempElement[1],
                        priority: parseInt(tempElement[2])
                    };

                    this._layers.push(layerElement);
                }
            } catch (error) {
                logger.error(`can not scan available layers error: ${error}`);
                throw error;
            }
        }
    }

    private searchFiles(pattern: string): ElementInfo[] {
        let elements: ElementInfo[] = new Array < ElementInfo > ();

        for (let layer of this._layers) {
            try {
                let files = find.fileSync(new RegExp(`.${pattern}$`), layer.path);
                for (let file of files) {
                    let pathObj: PathInfo = path.parse(file);

                    let element: ElementInfo = {
                        name: pathObj.name,
                        path: pathObj,
                        extraInfo: `layer: ${layer.name}`,
                        layerInfo: layer,
                    };

                    elements.push(element);
                }

            } catch (error) {
                logger.error(`find error: pattern: ${pattern} layer.path: ${layer.path} error: ${JSON.stringify(error)}`);
                throw error;
            }

        }

        return elements;
    }

    private searchFileInPath(pattern: RegExp | string, searchPath: string): PathInfo {
        let filePathInfo: PathInfo;
        let files = find.fileSync(pattern, searchPath);

        if ((files === undefined) || (files.length === 0)) {
            logger.debug(`no file found for pattern: ${pattern} searchPath: ${searchPath}`);
        } else if (files.length > 1) {
            logger.error(`More then one file found! file(${pattern}) in path(${searchPath}) files: ${files}`);
        } else {
            filePathInfo = path.parse(files[0]);
        }

        return filePathInfo;
    }


    scanForRecipes() {
        this._recipes = new Array < ElementInfo > ();

        let output: string = this.executeCommandInBitBakeEnvironment('bitbake-layers show-recipes');

        if (output.length > 0) {
            let outerReg: RegExp = /(.+)\:\n((?:\s+\S+\s+\S+(?:\s+\(skipped\))?\n)+)/g;
            let innerReg: RegExp = /\s+(\S+)\s+(\S+(?:\s+\(skipped\))?)\n/g;
            let match: RegExpExecArray;

            while ((match = outerReg.exec(output)) !== null) {
                if (match.index === outerReg.lastIndex) {
                    outerReg.lastIndex++;
                }

                let matchInner: RegExpExecArray;
                let extraInfoString: string[] = new Array < string > ();
                let layerName: string;
                let version: string;

                while ((matchInner = innerReg.exec(match[2])) !== null) {
                    if (matchInner.index === innerReg.lastIndex) {
                        innerReg.lastIndex++;
                    }

                    if (extraInfoString.length === 0) {
                        layerName = matchInner[1];
                        version = matchInner[2];
                    }

                    extraInfoString.push(`layer: ${matchInner[1]}`);
                    extraInfoString.push(`version: ${matchInner[2]} `);
                }

                let layer: LayerInfo = this._layers.find((obj: LayerInfo): boolean => {
                    return obj.name === layerName;
                });

                let element: ElementInfo = {
                    name: match[1],
                    extraInfo: extraInfoString.join('\n'),
                    layerInfo: layer,
                    version: version
                };

                this._recipes.push(element);
            }
        }

        this.scanForRecipesPath();
    }

    private scanForRecipesPath() {

        let tmpFiles = this.searchFiles(this._recipesFileExtension);

        for (let file of tmpFiles) {
            let recipeName: string = file.name.split(/[_]/g)[0];

            let element: ElementInfo = this._recipes.find((obj: ElementInfo): boolean => {
                return obj.name === recipeName;
            });

            if (element !== undefined) {
                element.path = file.path;
            }
        }

        if (this._deepExamine === true) {
            let recipesWithOutPath: ElementInfo[] = this._recipes.filter((obj: ElementInfo): boolean => {
                return obj.path === undefined;
            });

            logger.info(`${recipesWithOutPath.length} recipes must be examined more deeply.`);

            for (let recipeWithOutPath of recipesWithOutPath) {
                let output: string = this.executeCommandInBitBakeEnvironment(`bitbake-layers show-recipes -f ${recipeWithOutPath.name}`);
                let regExp: RegExp = /(\s.*\.bb)/g;
                let match: RegExpExecArray;

                while ((match = regExp.exec(output)) !== null) {
                    if (match.index === regExp.lastIndex) {
                        regExp.lastIndex++;
                    }

                    recipeWithOutPath.path = path.parse(match[0].trim());
                }
            }
        }
    }

    private scanRecipesAppends() {
        let output: string = this.executeCommandInBitBakeEnvironment('bitbake-layers show-appends');

        if (output.length > 0) {
            let outerReg: RegExp = new RegExp(`(\\S.*\\.bb)\\:(?:\\s*\\/\\S*.bbappend)+`, 'g');
            let match: RegExpExecArray;

            while ((match = outerReg.exec(output)) !== null) {
                if (match.index === outerReg.lastIndex) {
                    outerReg.lastIndex++;
                }
                let matchInner: RegExpExecArray;
                let extraInfoString: string[] = new Array < string > ();
                let fullRecipeNameAsArray: string[] = match[1].split('_');

                if (fullRecipeNameAsArray.length > 0) {
                    let recipeName: string = fullRecipeNameAsArray[0];

                    let recipe: ElementInfo = this.recipes.find((obj: ElementInfo): boolean => {
                        return obj.name === recipeName;
                    });

                    if (recipe !== undefined) {
                        let innerReg: RegExp = /(\S*\.bbappend)/g;

                        while ((matchInner = innerReg.exec(match[0])) !== null) {
                            if (matchInner.index === innerReg.lastIndex) {
                                innerReg.lastIndex++;
                            }

                            if (recipe.appends === undefined) {
                                recipe.appends = new Array < PathInfo > ();
                            }

                            recipe.appends.push(path.parse(matchInner[0]));
                        };
                    }
                }
            }
        }
    }

    private parseAllRecipes() {
        logger.debug('parseAllRecipes');
        this.executeCommandInBitBakeEnvironment('bitbake -p');
    }


    private executeCommandInBitBakeEnvironment(command: string): string {
        let str: string = `. ./oe-init-build-env vsc > /dev/null ; ${command}`;

        return this.executeCommand(str);
    }

    private executeCommand(command: string): string {
        let stdOutput: string;

        if (this._projectPath !== null) {
            try {
                logger.debug(`execute command: ${command}`)
                let returnObject = execa.shellSync(command);

                if (returnObject.status === 0) {
                    stdOutput = returnObject.stdout;
                } else {
                    logger.error('error on executing command: ' + command);
                }
            } catch (error) {
                logger.error(`can not execute command: ${command} error: ${error}`);
                throw error;
            }
        }

        return stdOutput;
    }
}