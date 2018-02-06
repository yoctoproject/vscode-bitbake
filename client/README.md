# BitBake recipe language support in Visual Studio Code

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

*CTRL and click* may be used to open the file associated with a class, inc-file, recipe or variable. If more than one definition exists, a list of definitions is provided.

The go to definition feature currently behaves as follows:

| Definition | Target(s) |
| --- | --- |
| class or inc-file | file |
| recipe | recipe definition and all bbappends |
| symbol | all symbols within the include hierarchy |
