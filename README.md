# BitBake recipe language support in Visual Studio Code
Feature:
## syntax highlighting
    Acknowledgements:
    Syntax derived from (https://github.com/mholo65/vscode-bitbake) which is licensed under the MIT License
## context based suggestion
  e.g. ```inherit kernel``` after typing *inherit* it is posible to request suggestion with *STRG+SPACE*. Now you get sugges only classes that you can inherit regarding your layer configuration.
  The suggestion supports:
     * Keyword *inherit, require, include, export*
     * The language server detect context for the keywords *inherit, require and include*




