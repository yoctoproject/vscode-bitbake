#!/usr/bin/env bash

# Inspired by bash-language-server under MIT license
# Reference: https://github.com/bash-lsp/bash-language-server/blob/8c42218c77a9451b308839f9a754abde901323d5/scripts/upgrade-tree-sitter.sh

set -euox pipefail

update-tree-sitter-wasm() {
    local repo_name=$1
    local repo_owner=$2
    local info_file="$repo_name.info"

    cd "$(dirname "$(readlink -f "$0")")/.."

    cd server
    curl "https://api.github.com/repos/$repo_owner/$repo_name/commits/master" | jq .commit.url > "$info_file"
    echo "tree-sitter-cli $(npm show tree-sitter-cli version)" >> "$info_file"
}
