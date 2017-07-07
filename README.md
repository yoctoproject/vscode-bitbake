# This Visual Studio Code Pluggin is based on [Example - Language Server](https://code.visualstudio.com/docs/extensions/example-language-server)

For the discription of the extension it self, see [README.md](./extension/README.md). The Change Log for the extension you can find here [CHANGELOG.md](./extension/CHANGELOG.md).

## installing from [VS Code Extension Marketplace](https://marketplace.visualstudio.com/VSCode)
To install this extension from VS Code Marketplace please follow this guide https://marketplace.visualstudio.com/items?itemName=EugenWiens.bitbake. For more informations regarding Extension Marketplace please see following documentation  https://code.visualstudio.com/docs/editor/extension-gallery. 

## build
### npm install
Clone the repository and then do:
For the extension:
``` 
cd extension
npm install
```

For the language-server
```
cd language-server
npm install
```

### building the *language-server*
The language-server must be built. Start *Visual Studio Code* and press *STRG+B* after the build step the *language-server* is copied to the extension. After you have build the *language-server* you can build and start the extension.
