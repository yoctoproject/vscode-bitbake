# BitBake recipe language support plugin for Visual Studio Code

[![vscode-bitbake CI/CD](https://github.com/savoirfairelinux/vscode-bitbake/actions/workflows/main.yml/badge.svg?branch=master)](https://github.com/savoirfairelinux/vscode-bitbake/actions/workflows/main.yml?query=branch%3Amaster)

**For a description of the extension itself, please see [the client's README](./client/README.md)**.

The changelog for the extension can be found [here](./client/CHANGELOG.md).


## Installing from [VS Code Extension Marketplace](https://marketplace.visualstudio.com/VSCode)

To install this extension from the VS Code Extension Marketplace, please follow [this guide](https://marketplace.visualstudio.com/items?itemName=EugenWiens.bitbake).
For more information regarding the Extension Marketplace, please see the [official documentation](https://code.visualstudio.com/docs/editor/extension-gallery).

## Manual installation

Manual installation takes place in two steps. The code must be installed via `npm` and subsequently built within Visual Studio Code. Before performing these steps, please ensure you have cloned this repository.

### Commands

To install the dependencies:
```
npm install
```
To compile the typescript files:
```
npm run compile
```
To clean up the project (This deletes node_modules):
```
npm run clean
```
For more commands, refer to the `script` section in the root `package.json`.

## Debugging
Press `F5` or navigate to the debug section on the left of the VS Code and select the client or server to to launch the debug client.

## Testing

Bitbake and Yocto docs are required for some features to work, They need to be fetched before testing and development:

 $ npm run fetch:docs

Similar for the command that fetches poky, it needs to be run before running the integration tests:

$ npm run fetch:poky

A wrapper npm script allows running several kinds of tests. To run all tests, use:

 $ npm test

All the tests mentionned are run in our GitHub CI.

### Linter tests

One can check coding style using `npm run lint`.
Install the recommended extensions to automatically fix linting errors when possible.

### Unit tests

Unit tests are powered by Jest. They allow mocking the behavior of VSCode
and other external libraries. They can individually be run with:

 $ npm run jest

Unit tests are defined in the `__tests__` folders.

If you have installed the recommended extensions, you'll find launch and debug
tasks for the unit tests in the debug section of VSCode.

### Grammar tests

See [the individual grammar tests README](client/test/grammars/README.md).

### Integration tests

These tests allow running the bitbake extension in a live VSCode environment.
See [the individual integration tests README](integration-tests/README.md).

## Tree-sitter
This extension uses tree-sitter to parse the documents. The `.wasm` file used for creating the parser is generated from latest release at [here](https://github.com/amaanq/tree-sitter-bitbake).

For more information about the tree-sitter and its CLI, Check out the offical [site](https://tree-sitter.github.io/tree-sitter/) and [npm page](https://www.npmjs.com/package/tree-sitter-cli)

## Contributing

Development of this extension happens on [GitHub](https://github.com/yoctoproject/vscode-bitbake).
Issues and pull requests are welcome.

## Acknowledgements

* Syntax derived from https://github.com/mholo65/vscode-bitbake, which is licensed under the [MIT License](https://github.com/mholo65/vscode-bitbake/blob/master/LICENSE).
