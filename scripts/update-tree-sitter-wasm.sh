#!/usr/bin/env bash

# Inspired by bash-language-server under MIT license
# Reference: https://github.com/bash-lsp/bash-language-server/blob/8c42218c77a9451b308839f9a754abde901323d5/scripts/upgrade-tree-sitter.sh

set -euox pipefail
cd "$(dirname "$(readlink -f "$0")")/.."

cd server
npm install -D tree-sitter-cli https://github.com/tree-sitter-grammars/tree-sitter-bitbake
npx tree-sitter build-wasm node_modules/tree-sitter-bitbake

curl 'https://api.github.com/repos/tree-sitter-grammars/tree-sitter-bitbake/commits/master' | jq .commit.url > parser.info
echo "tree-sitter-cli $(cat package.json | jq '.devDependencies["tree-sitter-cli"]')" >> parser.info

npm uninstall tree-sitter-cli tree-sitter-bitbake

