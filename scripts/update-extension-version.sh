#!/usr/bin/env bash

set -e

DEST="integration-tests/src/utils/version.ts"

# Keep the header
TOTAL_LINES=$(wc -l < $DEST)
LINES_TO_KEEP=$(($TOTAL_LINES - 2))
TMP="tmp.ts"
head -n $LINES_TO_KEEP $DEST > $TMP

git clone --depth 1 --filter=blob:none --sparse https://github.com/bash-lsp/bash-language-server
cd bash-language-server
git fetch --tags
echo "export const bashVersion = '$(git tag --sort=-v:refname | head -n 1 | sed "s/^vscode-client-//")'" >> ../$TMP
cd ..
rm -rf bash-language-server

git clone --depth 1 --filter=blob:none --sparse https://github.com/Microsoft/vscode-python
cd vscode-python
git fetch --tags
echo "export const pythonVersion = '$(git tag --sort=-v:refname | head -n 1 | sed "s/^v//")'" >> ../$TMP
cd ..
rm -rf vscode-python

cp $TMP $DEST
rm $TMP