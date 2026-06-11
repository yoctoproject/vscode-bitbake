#!/bin/bash -ex

# Update the fetch-poky.sh script
FILE="scripts/fetch-poky.sh"

latest_yocto_release_ref() {
    git ls-remote --tags "$1" 'refs/tags/yocto-*^{}' \
        | awk '$2 ~ /^refs\/tags\/yocto-[0-9]+(\.[0-9]+)*\^\{\}$/ { print $0 }' \
        | sort -V -k2 \
        | tail -n 1
}

update_yocto_ref() {
    local url="$1"
    local tag_variable="$2"
    local commit_variable="$3"

    local latest_ref
    latest_ref=$(latest_yocto_release_ref "$url")

    if [ -z "$latest_ref" ]; then
        echo "Could not find Yocto release tags for $url" >&2
        exit 1
    fi

    local latest_commit
    latest_commit=$(echo "$latest_ref" | awk '{print $1}')

    local latest_tag
    latest_tag=$(echo "$latest_ref" | awk '{print $2}' | sed -e "s/refs\\/tags\\///" -e "s/\^{}//")

    sed -i "$FILE" \
        -e "s/^\(${tag_variable}=\).*/\1$latest_tag/" \
        -e "s/^\(${commit_variable}=\).*/\1$latest_commit/"
}

update_yocto_ref https://git.openembedded.org/bitbake BITBAKE_TAG BITBAKE_COMMIT
update_yocto_ref https://git.openembedded.org/openembedded-core OE_CORE_TAG OE_CORE_COMMIT
update_yocto_ref https://git.yoctoproject.org/meta-yocto META_YOCTO_TAG META_YOCTO_COMMIT

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

