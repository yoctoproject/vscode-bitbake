#!/usr/bin/env bash
set -e

. "$(dirname "$0")/update-tree-sitter.sh"

repo_name=tree-sitter-bitbake
repo_owner=tree-sitter-grammars

update-tree-sitter $repo_name $repo_owner
