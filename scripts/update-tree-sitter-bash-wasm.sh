#!/usr/bin/env bash
set -e

. "$(dirname "$0")/update-tree-sitter-wasm.sh"

repo_name=tree-sitter-bash
repo_owner=tree-sitter

update-tree-sitter-wasm $repo_name $repo_owner
