# BitBake recipe language support plugin for Visual Studio Code

[![vscode-bitbake CI/CD](https://github.com/yoctoproject/vscode-bitbake/actions/workflows/main.yml/badge.svg?branch=main)](https://github.com/yoctoproject/vscode-bitbake/actions/workflows/main.yml?query=branch%3Amain)

**For a description of the extension itself, please see the [README](./README.md)**.

**It is also possible to use some features of the language server on other editors (Vim, ...). Follow [the server's README](./server/README.md)**.

The changelog for the extension can be found [here](./CHANGELOG.md).

## Installing from [VS Code Extension Marketplace](https://marketplace.visualstudio.com/VSCode)

To install this extension from the VS Code Extension Marketplace, please follow [this guide](https://marketplace.visualstudio.com/items?itemName=yocto-project.yocto-bitbake).
For more information regarding the Extension Marketplace, please see the [official documentation](https://code.visualstudio.com/docs/editor/extension-gallery).

## Manual installation

Manual installation takes place in two steps. The code must be installed via `npm` and subsequently built within Visual Studio Code. Before performing these steps, please ensure you have cloned this repository.

### Commands

To install the dependencies:
``` sh
npm install
```
To compile the typescript files:
``` sh
npm run compile
```
To clean up the project (This deletes node_modules):
``` sh
npm run clean
```
For more commands, refer to the `script` section in the root `package.json`.

## Debugging
Press `F5` or navigate to the debug section on the left of the VS Code and select the client or server to to launch the debug client.

## Testing

BitBake and Yocto docs are required for some features to work. They need to be fetched before testing and development:
``` sh
npm run fetch:docs
```
Similar for the command that fetches poky, it needs to be run before running the integration tests:
``` sh
npm run fetch:poky
```
A wrapper npm script allows running several kinds of tests. To run all tests, use:
``` sh
npm test
```
All the tests mentionned are run in our GitHub CI.

### Linter tests

One can check coding style using
``` sh
npm run lint
```
Install the recommended extensions to automatically fix linting errors when possible.

### Unit tests

Unit tests are powered by Jest. They allow mocking the behavior of VSCode
and other external libraries. They can individually be run with:
```sh
npm run jest
```
Unit tests are defined in the `__tests__` folders.

If you have installed the recommended extensions, you'll find launch and debug
tasks for the unit tests in the debug section of VSCode.

### Grammar tests

See [the individual grammar tests README](client/test/grammars/README.md).

### Integration tests

These tests allow running the BitBake extension in a live VSCode environment.
See [the individual integration tests README](integration-tests/README.md).

## Tree-sitter
This extension uses tree-sitter to parse the documents. The `.wasm` file used for creating the parser is generated from latest release at [here](https://github.com/amaanq/tree-sitter-bitbake).

For more information about the tree-sitter and its CLI, Check out the offical [site](https://tree-sitter.github.io/tree-sitter/) and [npm page](https://www.npmjs.com/package/tree-sitter-cli)

## Publishing

Publishing is automated via GitHub Actions and reserved to project maintainers. To publish a new version:
 - Update all the `package.json` files with the new version number `X.Y.Z`.
 - Document new changes in the `client/CHANGELOG.md` file.
 - Make sure the `VSCE_PAT` secret is valid in the [GitHub repository settings](https://github.com/yoctoproject/vscode-bitbake/settings/secrets/actions).
 - Make sure the `NODE_AUTH_TOKEN` secret is valid in the [GitHub repository settings](https://github.com/yoctoproject/vscode-bitbake/settings/secrets/actions).
 - Update the main branch with the latest staging branch.
 - Create a [new release on GitHub](https://github.com/yoctoproject/vscode-bitbake/releases/new) with a tag in the format `vX.Y.Z`.
 - Admin approval is required to run the GitHub Action.

The release will be published to the VS Code Marketplace automatically by the GitHub Action. Admin approval is required to run the GitHub Action, and the `VSCE_PAT` must be updated to match a valid token for the `yocto-project` Azure DevOps publisher. See:
 - https://code.visualstudio.com/api/working-with-extensions/publishing-extension
 - https://code.visualstudio.com/api/working-with-extensions/continuous-integration
The `NODE_AUTH_TOKEN` secret is used to push the language server package to the npm registry. The token must be linked to account with push permission on:
 - https://www.npmjs.com/package/language-server-bitbake
The `VSX_PAT` secret is used for VS Codium / Open-VSX. Instructions:
 - https://open-vsx.org/extension/yocto-project/yocto-bitbake

## Contributing

Development of this extension happens on [GitHub](https://github.com/yoctoproject/vscode-bitbake).
Issues and pull requests are welcome.

## Acknowledgements

* Syntax derived from https://github.com/mholo65/vscode-bitbake, which is licensed under the [MIT License](https://github.com/mholo65/vscode-bitbake/blob/master/LICENSE).
