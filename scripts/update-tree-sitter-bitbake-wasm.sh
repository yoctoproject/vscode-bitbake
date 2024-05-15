#!/usr/bin/env bash

. "$(dirname "$0")/update-tree-sitter-wasm.sh"

repo_name=tree-sitter-bitbake
repo_owner=tree-sitter-grammars

update-tree-sitter-wasm $repo_name $repo_owner
