# Bitbake Language Server Developer README

# Neovim Debug Instructions

Install the Bitbake language server globally as instructed in the
[README.md](./README.md).

To use the `node inspect` CLI debugger to debug the server, place `debugger`
keywords for breakpoints in the code to debug (make sure to recompile the
Typescript back to Javascript after changing any Typescript).

Use the minimal `init.lua` from the [README.md](./README.md) (The `-u` nvim
flag can be used to specify a path different from `~/.config/nvim/init.lua`).

Change the `cmd` field for something like this:
```lua
cmd = {
    'node',
    '--inspect',
    '/path/to/vscode-bitbake/server/out/server.js',
    '--stdio',
},
```
This will make the process expose a web socket on 127.0.0.1:9229 for debugging
(See [node.js debugging](https://nodejs.org/en/learn/getting-started/debugging)).

Add the following line to the `init.lua` to enable Neovim debug logging:
```lua
-- Set debug logging (See :help set_log_level and :help vim.log.levels)
vim.lsp.set_log_level(vim.log.levels.DEBUG)

-- Or for more recent nvim builds:
-- vim.lsp.log.set_level(vim.log.levels.DEBUG)
```
This will enable LSP logs to be sent to `~/.local/state/nvim/lsp.log`. But
in case the default path has changed, the command `:=vim.lsp.get_log_path()` can
be used to get the current LSP log path.

Run the following command to launch Neovim:
```sh
nvim --clean -u init.lua src/__tests__/fixtures/completion.bb
```
`--clean` tells Neovim not to use the configuration at
`~/.config/nvim/init.lua` and `-u` tells Neovim to use the local `init.lua`. A
sample Bitbake recipe is passed to launch the Bitbake language server.

Validate that Neovim correctly connected to the language server with the
following command:
```vim
:checkhealth vim.lsp
```
The server successfully connected if `bitbake` is listed under `vim.lsp: Active
Clients`.

To attach to the running process:
```sh
node inspect 127.0.0.1:9229
```
Which will provide a `gdb`-like debugging experience.
