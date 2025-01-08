/** --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
//@ts-check

// This script will be run within the webview itself
// It cannot access the main VS Code APIs directly.
(function () {
    const vscode = acquireVsCodeApi();
    const oldState = vscode.getState() || { };

    // HTML Listeners
    document.querySelector('#depType').addEventListener('click', () => {
        vscode.postMessage({ type: 'depType', value: event.target.value });
    });

    document.querySelector('#graphRecipe').addEventListener('input', () => {
        const value = document.querySelector('#graphRecipe').value;
        vscode.postMessage({ type: 'graphRecipe', value });
    });

    document.querySelector('#packageName').addEventListener('input', () => {
        const value = document.querySelector('#packageName').value;
        vscode.postMessage({ type: 'packageName', value });
    });

    document.querySelector('#genDotFile').addEventListener('click', () => {
        vscode.postMessage({ type: 'genDotFile' });
    });

    document.querySelector('#runOeDepends').addEventListener('click', () => {
        vscode.postMessage({ type: 'runOeDepends' });
    });

    // Extension Listeners
    window.addEventListener('message', event => {
        const message = event.data; // The json data that the extension sent
        switch (message.type) {
            case 'results':
                {
                    document.querySelector('#results').textContent = message.value;
                    break;
                }
        }
    });
}());
