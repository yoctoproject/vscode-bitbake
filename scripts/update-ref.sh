#!/bin/bash -ex

# Update the fetch-poky.sh script
FILE="scripts/fetch-poky.sh"
LATEST_REF=$(git ls-remote --tags https://github.com/yoctoproject/poky.git | grep "yocto-" | tail -n 1)
LATEST_COMMIT=$(echo $LATEST_REF | awk '{print $1}')
LATEST_TAG=$(echo $LATEST_REF | awk '{print $2}' |  sed -e "s/refs\\/tags\\///" -e "s/\^.*//")
sed -i $FILE \
    -e "s/^\(# Tag: \).*/\1$LATEST_TAG/" \
    -e "s/^\(COMMIT=\).*/\1$LATEST_COMMIT/"

# Update the version.ts
FILE="integration-tests/src/utils/version.ts"

LATEST_COMMIT=$(git ls-remote --refs --sort=-v:refname https://github.com/bash-lsp/bash-language-server | grep client | head -n 1 | awk '{print $2}' | sed s/refs\\/tags\\/vscode-client-//)
sed -e "s/^\(export const bashVersion =\).*/\1 '$LATEST_COMMIT'/" -i $FILE

LATEST_COMMIT=$(git ls-remote --refs --sort=-v:refname https://github.com/Microsoft/vscode-python | head -n 1 |  awk '{print $2}' | sed s/refs\\/tags\\/v//)
sed -e "s/^\(export const pythonVersion =\).*/\1 '$LATEST_COMMIT'/" -i $FILE

# Update the fetch-docs.sh script
FILE="scripts/fetch-docs.sh"

LATEST_REF=$(git ls-remote --refs --sort=-v:refname https://github.com/openembedded/bitbake.git | head -n 1)
LATEST_COMMIT=$(echo $LATEST_REF | awk '{print $1}')
LATEST_TAG=$(echo $LATEST_REF | awk '{print $2}' | sed s/refs\\/tags\\///)
sed -i $FILE \
    -e "s/^\(# Tag: \).*/\1$LATEST_TAG/" \
    -e "s/^\(BITBAKE_DOCS_COMMIT=\).*/\1$LATEST_COMMIT/" 

LATEST_REF=$(git ls-remote --refs --sort=-v:refname https://git.yoctoproject.org/yocto-docs | head -n 1)
LATEST_COMMIT=$(echo $LATEST_REF | awk '{print $1}')
LATEST_TAG=$(echo $LATEST_REF | awk '{print $2}' | sed s/refs\\/tags\\///)
sed -i $FILE \
    -e "s/^\(# Tag: \).*/\1$LATEST_TAG/" \
    -e "s/^\(YOCTO_DOCS_COMMIT=\).*/\1$LATEST_COMMIT/"

# Update vscodeVersion in runTest.ts
FILE="integration-tests/src/runTest.ts"

LATEST_TAG=$(git ls-remote --tags --sort=-v:refname https://github.com/microsoft/vscode.git | grep "refs/tags/[0-9.]" | head -n 1 | awk '{print $2}' | sed s/refs\\/tags\\///)
sed -e "s/vscodeVersion = '.*'/vscodeVersion = '$LATEST_TAG'/" -i $FILE

# Update the fetch-spdx-licenses.sh script
FILE="scripts/fetch-spdx-licenses.sh"

LATEST_REF=$(git ls-remote --refs --sort=-v:refname https://github.com/spdx/license-list-data.git | head -n 1)
LATEST_COMMIT=$(echo $LATEST_REF | awk '{print $1}')
LATEST_TAG=$(echo $LATEST_REF | awk '{print $2}' | sed s/refs\\/tags\\///)
sed -i $FILE \
    -e "s/^\(# Tag: \).*/\1$LATEST_TAG/" \
    -e "s/^\(SPDX_LICENSES_COMMIT=\).*/\1$LATEST_COMMIT/"

