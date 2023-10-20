# BitBake recipe language support in Visual Studio Code

## Setup the extension
In order to work properly, the extension needs to know your Bitbake's location and build folder. It will make the following assumptions:
- Bitbake's folder is located in `sources/poky/bitbake`, relative to the root of the project.
- Your build folder is located at the root of the project in a folder named `build`

Ideally, the path to an environment script to configure the BitBake project should also be specified. If it is not specified, the extension will try to configure the environment variables by itself.

These can be configured into the VS Code's settings. More options are available.

To access the settings, you can navigate to **Files -> Preferences -> Settings** (or use the shortcut [**Ctrl+,**]). BitBake's settings are under **Extensions**

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

### Bitbake commands

The extension provides commands and shortcuts to run bitbake tasks. These commands are available in the command palette (CTRL+SHIFT+P) and in the editor's context menu. Before using these commands, you must provide the following settings:
- Build folder
- Path to an environment script to configure the BitBake project (optional)
See the section on [setting up the extension](#setup-the-extension) for more information.
