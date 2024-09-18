# BitBake recipe language support plugin for Visual Studio Code

[![vscode-bitbake CI/CD](https://github.com/yoctoproject/vscode-bitbake/actions/workflows/main.yml/badge.svg?branch=main)](https://github.com/yoctoproject/vscode-bitbake/actions/workflows/main.yml?query=branch%3Amain)

**For a description of the extension itself, please see the [README](./README.md)**.

**It is also possible to use some features of the language server on other editors (Vim, ...). Follow [the server's README](./server/README.md)**.

The changelog for the extension can be found [here](./CHANGELOG.md).

## Installing from [VS Code Extension Marketplace](https://marketplace.visualstudio.com/VSCode)

To install this extension from the VS Code Extension Marketplace, please follow [this guide](https://marketplace.visualstudio.com/items?itemName=yocto-project.yocto-bitbake).
For more information regarding the Extension Marketplace, please see the [official documentation](https://code.visualstudio.com/docs/editor/extension-gallery).

## Manual installation

Once compiled, the extension can either be launched in VS Code's debug mode or built into a VSIX file and installed.

### Compile

1. Install the dependencies:
``` sh
npm install
npm run fetch:wasm # Download and build Wasm dependencies
npm run fetch:docs # Download Yocto's doc. Required for hints on hover
```
2. Compile the Typescript files:
``` sh
npm run compile
```

### Debug
Press `F5` or navigate to the debug section on the left of the VS Code and select the client or server to to launch the debug client.

### Install
1. Build the VSIX file:
``` sh
npm run package
```
2. Install the VSIX file. See [VS Code's documentation](https://code.visualstudio.com/docs/editor/extension-marketplace#_install-from-a-vsix).

### Clean up
This deletes the Wasm files, the Yocto's doc, Poky, node_modules, and the compiled files:
``` sh
npm run clean
```

## Testing

To run all the tests:
1. See [compilation](#compile) steps.
2. Fetch Poky (required for the integration tests):
``` sh
npm run fetch:poky
```
2. Run all the tests:
``` sh
# Note the integration tests require 'npm run compile' to be executed every time the Typescript files are modified.
npm test
```
All the tests mentionned are run in our GitHub CI.

### Linter tests

One can check coding style using
``` sh
npm run lint
```
Install the recommended extensions to automatically fix linting errors through VSCode.
You will also need to install the `eslint` dependencies globally:
``` sh
npm install -g eslint typescript-eslint
```

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
This extension uses [tree-sitter-bitbake](https://github.com/tree-sitter-grammars/tree-sitter-bitbake) and [tree-sitter-bash](https://github.com/tree-sitter/tree-sitter-bash) to parse the BitBake documents. They are installed with `npm run fetch:wasm`. The versions of tree-sitter-bitbake and tree-sitter-bash are documented in [server/tree-sitter-bitbake.info](server/tree-sitter-bitbake.info) and [server/tree-sitter-bash.info](server/tree-sitter-bash.info) respectively, along with the versions of the tree-sitter-cli that have to be used.

To update the .info files with the latest versions of tree-sitter-bitbake and tree-sitter-bash, it is recommended to use the scripts [scripts/update-tree-sitter-bitbake.sh](scripts/update-tree-sitter-bitbake.sh) and [scripts/update-tree-sitter-bash.sh](scripts/update-tree-sitter-bash.sh). The GitHub workflow [update-tree-sitter-parser-info-file.yml](.github/workflows/update-tree-sitter-parser-info-file.yml) is already responsible for doing it automatically.

After updating the .info files, it is required to call `npm run fetch:wasm` in order to rebuild the Wasm files.

For more information about the tree-sitter and its CLI, Check out the official [site](https://tree-sitter.github.io/tree-sitter/) and [npm page](https://www.npmjs.com/package/tree-sitter-cli)

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
