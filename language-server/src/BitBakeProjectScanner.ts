/* --------------------------------------------------------------------------------------------
 * Copyright (c) Eugen Wiens. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
'use strict';

const execa = require('execa');
const find = require('find');
const path = require('path');

export type LayerInfo = {
    name: string,
    path: string,
    priority: number
};


export type PathInfo = {
    root: string,
    dir: string,
    base: string,
    ext: string,
    name: string
};

export type ElementInfo = {
    name: string,
    extraInfo ? : string,
    path ? : PathInfo,
    layerInfo ? : LayerInfo
};

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

    private _scanStatus: ScannStatus = { 
        scanIsRunning: false,
        scanIsPending: false
    };

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

    rescanProject() {
        console.log(`request rescanProject ${this._projectPath}`);

        if( this._scanStatus.scanIsRunning === false ) {
            this._scanStatus.scanIsRunning = true;
            console.log('start rescanProject');

            this.scanAvailableLayers(() => {
                this.scanForClasses();
                this.scanForIncludeFiles();

                this.scanForRecipes(() => {
                    console.log('scan ready');
                    this.printScanStatistic();
                    this._scanStatus.scanIsRunning = false;

                    if( this._scanStatus.scanIsPending === true ) {
                        this._scanStatus.scanIsPending = false;
                        this.rescanProject();
                    }
                });
            });
        }
        else {
            console.log('scan is already running, set the pending flag');
            this._scanStatus.scanIsPending = true;
        }
    }

    private printScanStatistic() {
        console.log(`\nScan results for path: ${this._projectPath}`);
        console.log('******************************************************************');
        console.log(`Layer:     ${this._layers.length}`);
        console.log(`Recipes:   ${this._recipes.length}`);
        console.log(`Inc-Files: ${this._includes.length}`);
        console.log(`bbclass:   ${this._classes.length}`)
        
    }

    private scanForClasses() {
        this._classes = this.searchFiles(this._classFileExtension);
    }

    private scanForIncludeFiles() {
        this._includes = this.searchFiles(this._includeFileExtension);
    }

    private scanAvailableLayers(callback: () => void) {
        this._layers = new Array < LayerInfo > ();

        this.executeCommandInBitBakeEnvironment('bitbake-layers show-layers', output => {
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
                this._scanStatus.scanIsRunning = false;
                this._scanStatus.scanIsPending = false;
                throw error;
            }

            callback();
        });
    }

    private searchFiles(pattern: string): ElementInfo[] {
        let elements: ElementInfo[] = new Array < ElementInfo > ();

        for (let layer of this._layers) {
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
        }

        return elements;
    }

    scanForRecipes(callback: () => void) {
        this._recipes = new Array< ElementInfo> ();
        
        this.executeCommandInBitBakeEnvironment('bitbake-layers show-recipes', output => {
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

                while ((matchInner = innerReg.exec(match[2])) !== null) {
                    if (matchInner.index === innerReg.lastIndex) {
                        innerReg.lastIndex++;
                    }

                    if (extraInfoString.length === 0) {
                        layerName = matchInner[1];
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
                    layerInfo: layer
                };

                this._recipes.push(element);
            }

            callback();
        });
    }

    private executeCommandInBitBakeEnvironment(command: string, callback: (output: string) => void) {

        if (this._projectPath !== null) {
            let str: string = `. ./oe-init-build-env > /dev/null; ${command}`;

            execa.shell(str).then(result => {
                callback(result.stdout);
            }).catch(error => {
                console.error(`cannot execute ${command} error: ${error}`);
            });
        }
    }

    private executeCommandInProjectPathWithoutBitBakeEnvironment(command: string, callback: (output: string) => void) {

        if (this._projectPath !== null) {

            execa.shell(command).then(result => {
                callback(result.stdout);
            }).catch(error => {
                console.error(`cannot execute ${command} error: ${error}`);
            });
        }
    }    
}