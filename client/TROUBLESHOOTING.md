# Troubleshooting

## Known Issues

### Problems from Unknown Files Appear in the Problems Tab
*Note Diagnostics are currently deactivated to avoid further issues*
Errors and warnings appear twice in the "PROBLEMS" tab. They first appear for the BitBake files to which they belong, and then again for Bash or Python files with UUID names (ex. 9ad23ed5-9278-41e0-98cd-349750c1e2c0.py). As the first one is expected and desired, the second is not. This issue arises from the way we handle diagnostics (errors and warnings). See [Trade-offs on Diagnostics](TROUBLESHOOTING.md#trade-offs-on-diagnostics).

Unfortunately, the VS Code API does not offer a way to programmatically filter the "PROBLEMS" tab. However, manual filtering is still possible. Typing `!workspaceStorage` or `!workspaceStorage/**/yocto-project.yocto-bitbake/embedded-documents` (if more precision is needed) should filter out all these unwanted problems.

### Tabs from Unknown Files Open and Close Quickly
*Note Diagnostics are currently deactivated to avoid further issues*
While typing, tabs with UUID names (ex. aa2a3ba2-769c-4900-8f5f-31ea16bfbc8f.sh) might occasionally open in the tabs bar and then close shortly thereafter.  This occurs as a result of our method for handling diagnostics (errors and warnings). See [Trade-offs on Diagnostics](TROUBLESHOOTING.md#trade-offs-on-diagnostics).

We haven't found a way to prevent these tabs from opening, but we try to close them as quickly as possible.

### BrokenPipeError on BitBake commands

If you are using a `bitbake.commandWrapper` that relies on docker containers, you may encounter the following error:

```bash
[Errno 32] Broken pipeTraceback (most recent call last):
  File "/home/deribaucourt/Workspace/yocto-vscode/yocto/yocto-build/sources/poky/bitbake/lib/bb/ui/knotty.py", line 647, in main
    ret, error = server.runCommand(["ping"])
[...]
  File "/usr/lib/python3.8/multiprocessing/connection.py", line 368, in _send
    n = write(self._handle, buf)
BrokenPipeError: [Errno 32] Broken pipe

During handling of the above exception, another exception occurred:

Traceback (most recent call last):
  File "/home/deribaucourt/Workspace/yocto-vscode/yocto/yocto-build/sources/poky/bitbake/bin/bitbake", line 36, in <module>
    sys.exit(bitbake_main(BitBakeConfigParameters(sys.argv),
[...]
  File "/usr/lib/python3.8/multiprocessing/connection.py", line 368, in _send
    n = write(self._handle, buf)
BrokenPipeError: [Errno 32] Broken pipe
```

These are due to a limitation of the bitbake server when running through containers in parallel. You'll get this error
when bitbake is started in multiple containers at the same time. To avoid this, wait for other bitbake processes to
finish before starting a new bitbake command. This extension won't allow concurrent commands, but you may have other
bitbake commands running in the background:
 - From a terminal
 - From another VSCode window
 - From another user session

## Trade-offs

### Trade-offs on Diagnostics
*Note Diagnostics are currently deactivated to avoid further issues*
Some functionalities for [embedded Bash and Python code](https://code.visualstudio.com/api/language-extensions/embedded-languages) are provided by other VS Code extensions, such as ms-python.python or timonwong.shellcheck. To achieve this, we extract the Bash and Python content from the BitBake files and create temporary Bash or Python files that can be analyzed by Bash or Python extensions. We adapt the results of these extensions, and present them to the user. It works well for Completion, Definition and Hover. Unfortunately VS Code [does not yet offer such functionality for diagnostics](https://github.com/yoctoproject/vscode-bitbake/pull/18). We still achieve it by some homemade hacky technique that consists of opening the temporary documents in the background, in a way to trigger the generation of diagnostics. It brings a couple of issues, but we hope it is still worth having the diagnostics.

The related issues:
- [Problems from Unknown Files Appear in the Problems Tab](TROUBLESHOOTING.md#problems-from-unknown-files-appear-in-the-problems-tab)
- [Tabs from Unknown Files Open and Close Quickly](TROUBLESHOOTING.md#tabs-from-unknown-files-open-and-close-quickly)
