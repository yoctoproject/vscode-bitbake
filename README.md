# BitBake recipe language support plugin for Visual Studio Code

This Visual Studio Code plugin is based on [Example - Language Server](https://code.visualstudio.com/docs/extensions/example-language-server).

For a description of the extension itself, please see [the client's README](./client/README.md). The changelog for the extension may be found [here](./client/CHANGELOG.md).

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

### Debugging
Press `F5` or navigate to the debug section on the left of the VS Code and select the client or server to to launch the debug client.
