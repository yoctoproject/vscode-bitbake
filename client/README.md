# BitBake recipe language support in Visual Studio Code

## Set BitBake's path
Some features require to know where your BitBake's folder is located. The extension will by default assume it is located at the root of the project in a folder named `bitbake`. If your BitBake folder is located somewhere else, set its path in the settings in order to have full features.

To access BitBake's settings: Files -> Preferences -> Settings [Ctrl+,]. The BitBake's settings are under Extensions.

## Features

### Syntax highlighting

Acknowledgements:

* Syntax derived from https://github.com/mholo65/vscode-bitbake, which is licensed under the [MIT License](https://github.com/mholo65/vscode-bitbake/blob/master/LICENSE).

### Context-based suggestions

*CTRL+SPACE* may be used to provide suggestions. For example, typing `inherit` and pressing *CTRL+SPACE* provides the suggestion `inherit kernel`. Suggestions are context-based, only providing suggestions that apply to your specific layer configuration.

The following suggestions are currently supported:

* Keywords `inherit`, `require`, `include` and `export`
* Context-based suggestions for keywords `inherit`, `require` and `include` (provided by *language-server*)
* Context-based suggestions for all symbols within the include hierarchy

### Go to definition
*This functionnality requires to [provide the BitBake's folder](#set-bitbakes-path)*

*CTRL and click* may be used to open the file associated with a class, inc-file, recipe or variable. If more than one definition exists, a list of definitions is provided.

The go to definition feature currently behaves as follows:

| Definition | Target(s) |
| --- | --- |
| class or inc-file | file |
| recipe | recipe definition and all bbappends |
| symbol | all symbols within the include hierarchy |

### Show definitions of BitBake's defined variables on hover
*This functionnality requires to [provide the BitBake's folder](#set-bitbakes-path)*

Place your cursor over a variable. If it is a BitBake defined variable, then its definition from the documentation will be displayed.