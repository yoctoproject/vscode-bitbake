# BitBake recipe language support in Visual Studio Code with folowing features

## syntax highlighting
Acknowledgements:
Syntax derived from (https://github.com/mholo65/vscode-bitbake) which is licensed under the MIT License

## context based suggestion
e.g. ```inherit kernel``` after typing *inherit* it is posible to request suggestion with *STRG+SPACE*. Now you get sugges only classes that you can inherit regarding your layer configuration.
The suggestion supports:
1. Keyword *inherit, require, include, export*
2. The language server detect context for the keywords *inherit, require and include*

## go to definitions
It is posible with *STRG and Click* to open the file that is associated with a class, inc-file or recipe.



