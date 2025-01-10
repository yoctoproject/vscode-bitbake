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
    document.querySelector('#depType').addEventListener('click', (event) => {
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
        // TODO remove empty final line, especially when asking for an inexistent package
        switch (message.type) {
            case 'results':
                {
                    if(message.depType === '-w') {
                        renderWhy(message, vscode);
                    } else {
                        renderDependencies(message, vscode);
                    }
                    break;
                }
        }
    });
}());

function renderDependencies(message, vscode) {
    const resultsDiv = document.querySelector('#results');
    resultsDiv.innerHTML = '';

    const packages = message.value.split(' ');
    packages.forEach(pkg => {
        addPackageLine(resultsDiv, pkg, '•', vscode);
    });
}

function renderWhy(message, vscode) {
    const resultsDiv = document.querySelector('#results');
    resultsDiv.innerHTML = '';

    const dependencyChains = message.value.split('\n');
    for(let i = 0; i < dependencyChains.length; i++) {
        const chain = dependencyChains[i];
        const chainDiv = document.createElement('div');
        chainDiv.className = 'dependencyChain';
        resultsDiv.appendChild(chainDiv);
        renderDependencyChain(chain, chainDiv, vscode);
    }
}

function renderDependencyChain(chain, element, vscode) {
    // Use the unicode box drawing characters to draw the lines
    // https://www.compart.com/en/unicode/block/U+2500
    const packages = chain.split(' -> ');
    for(let i = 0; i < packages.length; i++) {
        const pkg = packages[i];
        let icon = '┃';
        if(i === 0) { icon = '┳'; }
        if(i === packages.length - 1) { icon = '┻'; }
        addPackageLine(element, pkg, icon, vscode);
    }
}

function addPackageLine(element, name, graphIcon, vscode) {
    const div = document.createElement('div');
    div.className = 'packageLine';
    div.innerHTML = `<span class="graphIcon">${graphIcon}</span> ${name}`;
    element.appendChild(div);
    div.addEventListener('click', () => {
        vscode.postMessage({ type: 'openRecipe', value: name });
    });
}

function addIconLine(element, icon) {
    const div = document.createElement('div');
    div.className = 'iconLine';
    div.innerHTML = `<span class="icon">${icon}</span>`;
    element.appendChild(div);
}
