/* --------------------------------------------------------------------------------------------
 * Copyright (c) Eugen Wiens. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
'use strict';

const execa = require('execa');
const find = require('find');
const path = require('path')

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

/**
 * BitBakeProjectScanner
 */
export class BitBakeProjectScanner {

    private _projectPath: string;
    private _layers: LayerInfo[] = new Array < LayerInfo > ();
    private _classes: ElementInfo[] = new Array < ElementInfo > ();
    private _includes: ElementInfo[] = new Array < ElementInfo > ();
    private _recipes: ElementInfo[] = new Array < ElementInfo > ();

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

    private executeCommandInBitBakeEnvironment(command: string, callback: (output: string) => void) {
        console.log(`executeCommandInBitBakeEnvironment: ${JSON.stringify(command)}`);
        console.log(`pwd: ${JSON.stringify(execa.shellSync('pwd').stdout)}`);

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
        console.log(`executeCommandInProjectPathWithoutBitBakeEnvironment: ${JSON.stringify(command)}`);
        console.log(`pwd: ${JSON.stringify(execa.shellSync('pwd').stdout)}`);

        if (this._projectPath !== null) {

            execa.shell(command).then(result => {
                callback(result.stdout);
            }).catch(error => {
                console.error(`cannot execute ${command} error: ${error}`);
            });
        }
    }


    rescanProject() {
        console.log(`rescanProject ${this._projectPath}`);

        this.scanAvailableLayers(() => {
            this._classes = this.searchFiles('bbclass');
            this._includes = this.searchFiles('inc');

            this.scanAvailableRecipes(() => {
                console.log('scan ready');
            });
        });
    }

    private scanAvailableLayers(callback: () => void) {
        console.log(`scanAvailableLayers for Path ${this._projectPath}`);
        this.executeCommandInBitBakeEnvironment('bitbake-layers show-layers', output => {
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

            callback();
        });
    }

    private searchFiles(pattern: string): ElementInfo[] {
        console.log(`searchClasses for layers ${this._layers.length}`);
        let elements: ElementInfo[] = new Array < ElementInfo > ();

        for (let layer of this._layers) {
            let files = find.fileSync(new RegExp(`.${pattern}$`), layer.path);
            console.log(`${files.length} elements in layer ${layer.path} for pattern ${pattern} found`);


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

    private scanAvailableRecipes(callback: () => void) {
        console.log('scanAvailableRecipes');
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

            console.log(`${this._recipes.length} recipes found`);
            callback();
        });
    }

    
}