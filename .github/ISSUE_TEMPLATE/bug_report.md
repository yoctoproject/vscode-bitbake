---
name: Bug report
about: Create a report to help us improve
title: ''
labels: bug
assignees: ''

---

**Describe the bug**
A clear and concise description of what the bug is.

**To Reproduce**
Steps to reproduce the behavior:
1. Go to '...'
2. Click on '....'
3. Scroll down to '....'
4. See error

**Expected behavior**
A clear and concise description of what you expected to happen.

**Screenshots**
If applicable, add screenshots to help explain your problem.

**Desktop (please complete the following information):**
 - OS: [e.g. Ubuntu 24.04]
 - VS Code version [e.g. 1.92.2]
 - Extension version [e.g. 2.7.0]
 - Yocto Version [e.g. scarthgap]
 - Other affected software version when applicable (CMake, SSH, kas, ...)

**Debug logs**
Please provide the list of installed VSCode extensions. You can generate it with the following shell command:
```bash
code --list-extensions --show-versions
```
You may also attach this extension's debug logs:
 1. Change the VSCode setting `bitbake.loggingLevel` to "debug"
 2. Restart VSCode
 3. Reproduce your problem
 4. Go to View->Output
 5. Copy the contents of the drop down menu items "BitBake" and "Bitbake Language Server"

**Additional context**
Add any other context about the problem here.
