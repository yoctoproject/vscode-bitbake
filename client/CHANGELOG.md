# 2.0.1 - 2023.11.30
 - Fixed extension logo for white themes

# 2.0.0 - 2023.11.17
 - Fixed highlighting errors
 - Added more diagnostics to the Problems view
 - Added documentation on hover for Yocto variables, flags and functions
 - Added embedded languages features for python and shell scripts
   - Improved syntax highlighting
   - Code completion
   - Hover documentation
 - Added code completion for Yocto variables, keywords, overrides, classes, functions, include files
 - Added BitBake build tasks
 - Added BitBake build commands
 - Added a BitBake parsing status bar
 - Added a BitBake tree view for navigating and building recipes
 - Check BitBake settings sanity and prompt the user

# 1.1.2 - 2019.03.13
fixed deployment problems

# 1.1.1 - 2019.03.13
Security updates of dependent packages

# 1.1.0 - 2018.08.15

## Enhancements:
[issue 25](https://github.com/EugenWiens/vscode-bitbake/issues/25) Add settings parameter to disable the automatic creating an calling of executeBitBakeCmd.sh

## Fixed Bugs:
[issue 24](https://github.com/EugenWiens/vscode-bitbake/issues/24) When opining a file with out a workspace the plugin generate the execute...sh file
[issue 26](https://github.com/EugenWiens/vscode-bitbake/issues/26) required update packages to newest version #26

# 1.0.2 - 2018.04.11

## Fixed Bugs:
[issue 23](https://github.com/EugenWiens/vscode-bitbake/issues/23) moved `executeBitBakeCmd.sh` script to the working folder. e.g. `vscode-bitbake-build` if the setting for the working path is not changed

# 1.0.1 - 2018.03.06
fixed typo in changelog for the [issue 19](https://github.com/EugenWiens/vscode-bitbake/issues/19)

# 1.0.0 - 2018.03.06

## Enhancements:
- [issue 19](https://github.com/EugenWiens/vscode-bitbake/issues/19) Add diagnostic messages on parsing errors

# 0.0.13 - 2018.02.10

## Fixed Bugs:
- [issue 16](https://github.com/EugenWiens/vscode-bitbake/issues/16) ERROR: Only one copy of bitbake should be run against a build directory
- [issue 22](https://github.com/EugenWiens/vscode-bitbake/issues/22) parsing is broken with vscode > 1.18 and yocto "roco"

## Enhancements:
- [issue 21](https://github.com/EugenWiens/vscode-bitbake/pull/21) Add command to set MACHINE Variable

# 0.0.12 - 2017.08.15

## Enhancements:
- [issue 20](https://github.com/EugenWiens/vscode-bitbake/pull/20) Integrate the pull request: Rewording and cleanup of documentation

# 0.0.11 - 2017.08.08

## Enhancements:
- [issue 18](https://github.com/EugenWiens/vscode-bitbake/issues/18) Add symbols to auto completion, found by scanning the current recipe

# 0.0.10 - 2017.08.06

## Fixed Bugs:
- [issue 15](https://github.com/EugenWiens/vscode-bitbake/issues/15) Error in recipes causes the plugin to crash and no longer work
- [issue 17](https://github.com/EugenWiens/vscode-bitbake/issues/17) When using require / include, the auto completion adds include files with absolute path

# 0.0.9 - 2017.08.01

## Fixed Bugs:
- [issue 12](https://github.com/EugenWiens/vscode-bitbake/issues/12) Reduce the output
- Small bug fixes

# 0.0.8 - 2017.07.23
- Created version after rebased changes in files: README.md, LICENSE

# 0.0.7 - 2017.07.23

## Fixed Bugs:
- [issue 13](https://github.com/EugenWiens/vscode-bitbake/issues/13) Symbol SRC_URI[md5sum] is not detected

# 0.0.6 - 2017.07.03

## Enhancements:
- [issue 10](https://github.com/EugenWiens/vscode-bitbake/issues/10) Add context-dependent variables to the suggestion
- [issue 11](https://github.com/EugenWiens/vscode-bitbake/issues/11) Add setting to examine more deeply

# 0.0.5 - 2017.05.28

## Enhancements:
- [issue 2](https://github.com/EugenWiens/vscode-bitbake/issues/2) Add go to definition feature

# 0.0.4 - 2017.05.14

## Fixed Bugs:
- [issue 1](https://github.com/EugenWiens/vscode-bitbake/issues/1) The project is parsed only once

## Enhancements:
- [issue 4](https://github.com/EugenWiens/vscode-bitbake/issues/4) No icon is shown in the extension overview within Visual Studio Code
- [issue 5](https://github.com/EugenWiens/vscode-bitbake/issues/5) .conf files are not managed by vscode-bitbake plugin
- [issue 6](https://github.com/EugenWiens/vscode-bitbake/issues/6) Clean up server output
- [issue 7](https://github.com/EugenWiens/vscode-bitbake/issues/7) Add possibility to scan the project manually

# 0.0.3 - 2017.05.14

## Fixed Bugs:
- [issue 3](https://github.com/EugenWiens/vscode-bitbake/issues/3) Suggestion does not work properly

# 0.0.2 - 2017.05.13
- Moved the files CHANGELOG.md and README.md to the correct location

# 0.0.1 - 2017.05.13
- Initial release
