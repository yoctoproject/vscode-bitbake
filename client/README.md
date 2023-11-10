# BitBake recipe language support in Visual Studio Code

## Configuration

Some advanced features of this extension will need to locate and run BitBake. It can be configured from VSCode's settings.

To access the settings, you can navigate to **Files -> Preferences -> Settings** (or use the shortcut [**Ctrl+,**]). BitBake's settings are under **Extensions**. More options are available to tweak the extension's behavior.

Here's an example `settings.json` reflecting the default values:
```json
{
    "bitbake.pathToBuildFolder": "${workspaceFolder}/build",
    "bitbake.pathToEnvScript": "${workspaceFolder}/sources/poky/oe-init-build-env",
    "bitbake.pathToBitbakeFolder": "${workspaceFolder}/sources/poky/bitbake",
}
```

## Features

### Syntax highlighting

The extension provides syntax highlighting for BitBake recipes, classes, configuration and inc-files. Syntax highlighting also supports embedded languages inside bitbake recipes including inline Python variable expansion, shell code and Python code.

The BitBake language is automatically detected based on the file extension:
[`.bb`, `.bbappend`, `.bbclass`]. [`.conf`, `.inc`] are also supported but may be used by other tools.

![Syntax Hilighting](doc/highlighting.png)

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

## Contributing

### Reporting issues

User feedback is very welcome on this [extension's repository](https://github.com/yoctoproject/vscode-bitbake). Please report any issues or feature requests you may have with a detailed description of the problem and the steps to reproduce it.

### Contributing code

Contributions are welcome! Please submit your contributions as pull requests on this [extension's repository](https://github.com/yoctoproject/vscode-bitbake)

Instructions to build, test and debug the extension are available in the [root README](../README.md).
