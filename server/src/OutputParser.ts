/* --------------------------------------------------------------------------------------------
 * Copyright (c) Eugen Wiens. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
'use strict';

var logger = require('winston');

import {
    Connection,
} from "vscode-languageserver";

import {
    ProblemsContainer
} from "./ProblemsContainer";

export class OutputParser {

    _problems: ProblemsContainer[] = [];
    _connection: Connection;

    constructor(connection: Connection) {
        this._connection = connection;
    }

    parse(message: string) {
        const regex: RegExp = /\s(WARNING:|ERROR:)\s(.*)/g;
        let m;
        this.clearAllProblemsAndReport();

        while ((m = regex.exec(message)) !== null) {
            // This is necessary to avoid infinite loops with zero-width matches
            if (m.index === regex.lastIndex) {
                regex.lastIndex++;
            }

            let tempProblemContainer: ProblemsContainer[] = ProblemsContainer.createProblemContainer(m[1], m[2]);

            tempProblemContainer.forEach( (container: ProblemsContainer) => {
                
                let element: ProblemsContainer = this._problems.find( (other:ProblemsContainer) => {
                    if(other.url === container.url) {
                        return true;
                    }
                    else {
                        return false;
                    }
                });

                if( element ) {
                    element.problems = element.problems.concat( container.problems );
                }
                else {
                    this._problems.push(container)
                }
            });

        }
    }

    errorsFound(): boolean {
        let errorFound: boolean = false;
        var BreakException = {};

        try {
            this._problems.forEach((container: ProblemsContainer) => {
                if (container.containsErrors() === true) {
                    errorFound = true;
                    throw BreakException;
                }
            });
        } catch (error) {
            if (error !== BreakException) {
                throw error;
            }
        }

        return errorFound;
    }

    reportProblems() {
        logger.debug(`reportProblems: ${this._problems.length}`);
        this._problems.forEach((container: ProblemsContainer) => {
            logger.debug(`send Diagnostic ${container.toString()}`);
            this._connection.sendDiagnostics(container.getDignosticData());
        });
    }

    clearAllProblemsAndReport() {
        logger.debug(`clearAllProblems: ${this._problems.length}`);
        this._problems.forEach((container: ProblemsContainer) => {
            logger.debug(`send Diagnostic ${container.toString()}`);
            this._connection.sendDiagnostics(container.getClearedDiagnosticData());
        });

        this._problems = [];
    }

}