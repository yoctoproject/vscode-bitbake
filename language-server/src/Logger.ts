/* --------------------------------------------------------------------------------------------
 * Copyright (c) Eugen Wiens. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
'use strict';

import {
    RemoteConsole
} from 'vscode-languageserver';



export class Logger {
    private static instance: Logger;
    private _logLevel: string = "off";
    private _remoteConsole: RemoteConsole;

    private constructor() {
        // do something construct...
    }

    static getInstance() {
        if (!Logger.instance) {
            Logger.instance = new Logger();
            // ... any one time initialization goes here ...
        }
        return Logger.instance;
    }

    set logLevel(logLevel: string) {
        this._logLevel = logLevel;
    this._remoteConsole.log(`new logging level: ${logLevel}`)
    }

    set remoteConsole(remoteConsole: RemoteConsole) {
        this._remoteConsole = remoteConsole;
    }

    private isLogginActive(): boolean {
        let loggingActive: boolean = true;

        if (this._logLevel == 'off') {
            loggingActive = false;
        }

        return loggingActive;
    }

    error(message: string) {
        if (this.isLogginActive() == true) {
            this._remoteConsole.error(message);
        }
    }

    debug(message: string) {
        if (this.isLogginActive() == true) {
            if (this._logLevel == 'verbose') {
                this._remoteConsole.info(message);
            }
        }
    }

    info(message: string) {
        if (this.isLogginActive() == true) {
            this._remoteConsole.log(message);
        }
    }
}