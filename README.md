# BitBake recipe language support plugin for Visual Studio Code

This Visual Studio Code plugin is based on [Example - Language Server](https://code.visualstudio.com/docs/extensions/example-language-server).

For a description of the extension itself, please see [the extension's README](./extension/README.md). The changelog for the extension may be found [here](./extension/CHANGELOG.md).

## Installing from [VS Code Extension Marketplace](https://marketplace.visualstudio.com/VSCode)

To install this extension from the VS Code Extension Marketplace, please follow [this guide](https://marketplace.visualstudio.com/items?itemName=EugenWiens.bitbake).
For more information regarding the Extension Marketplace, please see the [official documentation](https://code.visualstudio.com/docs/editor/extension-gallery).

## Manual installation

Manual installation takes place in two steps. The code must be installed via `npm` and subsequently built within Visual Studio Code. Before performing these steps, please ensure you have cloned this repository.

### Code installation

To install the extension:
```
cd extension
npm install
```

To install *language-server*:
```
cd language-server
npm install
```

### Building

#### *language-server*

The extension depends on *language-server*, which must be installed and built before the extension itself can be built. Start Visual Studio Code and press *CTRL+B*. After building, the *language-server* is automatically copied to the extension.

#### Extension

After building *language-server*, the extension may be built within Visual Studio Code.
