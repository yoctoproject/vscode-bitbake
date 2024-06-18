#!/usr/bin/env bash

# Inspired by bash-language-server under MIT license
# Reference: https://github.com/bash-lsp/bash-language-server/blob/8c42218c77a9451b308839f9a754abde901323d5/scripts/upgrade-tree-sitter.sh

set -euox pipefail

update-tree-sitter-wasm() {
    local name=$1
    
    cd "$(dirname "$(readlink -f "$0")")/.."

    cd server
    info_file="$name.info"
    api_url=$(sed -n '1p' "$info_file" | cut -d '"' -f 2)
    owner_repo=$(echo "$api_url" | sed -E 's|https://api.github.com/repos/([^/]+/[^/]+).*|\1|')
    commit_hash=$(echo "$api_url" | sed -E 's|.*/commits/([^/]+)|\1|')
    tarball_url="https://github.com/$owner_repo/tarball/$commit_hash"
    tree_sitter_cli_version=$(sed -n '2p' "$info_file" | cut -d '"' -f 2)
    npm install -D "tree-sitter-cli@$tree_sitter_cli_version" "$tarball_url"
    npx tree-sitter build --wasm "node_modules/$name"
    npm uninstall tree-sitter-cli "$name"
}

update-tree-sitter-wasm "tree-sitter-bash"
update-tree-sitter-wasm "tree-sitter-bitbake"
