#!/bin/bash

BITBAKE_TAG=yocto-6.0
BITBAKE_COMMIT=33581c84f3a85008239acbd940501a35de48dc91
OE_CORE_TAG=yocto-6.0
OE_CORE_COMMIT=42fa856a00ac16b2a7a83d7ecfa60a5be192b16c
META_YOCTO_TAG=yocto-6.0
META_YOCTO_COMMIT=904846ae078ee20de073040ebb77c86e19250f56

set -e

cd "$(dirname "$(readlink -f "$0")")/.."

YOCTO_DIR="resources/poky"

clone_repo() {
    local url="$1"
    local tag="$2"
    local commit="$3"
    local destination="$4"

    git clone --depth 1 --branch "$tag" "$url" "$destination"
    git -C "$destination" checkout --detach "$commit"
}

mkdir -p "$YOCTO_DIR"

clone_repo https://git.openembedded.org/bitbake "$BITBAKE_TAG" "$BITBAKE_COMMIT" "$YOCTO_DIR/bitbake"
clone_repo https://git.openembedded.org/openembedded-core "$OE_CORE_TAG" "$OE_CORE_COMMIT" "$YOCTO_DIR/openembedded-core"
clone_repo https://git.yoctoproject.org/meta-yocto "$META_YOCTO_TAG" "$META_YOCTO_COMMIT" "$YOCTO_DIR/meta-yocto"
