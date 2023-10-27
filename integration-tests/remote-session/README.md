# Remote SSH extension testing

Many Yocto user use powerful remote machines to build their images. They
will connect to the remote machine using SSH and then run the build there.

VSCode has a remote SSH extension that allows you to connect to a remote
machine and run VSCode there. We want to make sure our extension works fine
in this scenario.

The extension is actually run remotely so things work pretty straight forwardly.
See official doc: https://code.visualstudio.com/docs/remote/ssh

This test is unfortunately not automated yet.

## Setup

1. Install the [Remote SSH extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-ssh) in VSCode.
2. Run the docker container simulating the build server with `./start-container.sh`
3. Install the vscode-bitbake .vsix on your local VSCode (remote extension development is not supported by VSCode)
4. Connect to the container using the Remote SSH extension. An example ssh.config file is provided.
5. Install the extension on the remote container: Extensions->Local->Bitbake->Install in SSH
6. Within the remote session, open the workspace in `/home/yoctouser/vscode-bitbake/integration-tests/project-folder`
7. Open recipes, run bitbake commands...
