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

ln -s openembedded-core/oe-init-build-env "$YOCTO_DIR/oe-init-build-env"
ln -s openembedded-core/meta "$YOCTO_DIR/meta"
ln -s openembedded-core/scripts "$YOCTO_DIR/scripts"
ln -s meta-yocto/meta-poky "$YOCTO_DIR/meta-poky"
ln -s meta-yocto/meta-yocto-bsp "$YOCTO_DIR/meta-yocto-bsp"

TEMPLATE_DIR="$YOCTO_DIR/meta-poky/conf/templates/vscode-bitbake"
mkdir -p "$TEMPLATE_DIR"
cp -R "$YOCTO_DIR/meta/conf/templates/default/." "$TEMPLATE_DIR/"

cat > "$TEMPLATE_DIR/bblayers.conf.sample" <<'BBLAYERS_EOF'
# LAYER_CONF_VERSION is increased each time build/conf/bblayers.conf
# changes incompatibly
LCONF_VERSION = "7"

BBPATH = "${TOPDIR}"
BBFILES ?= ""

BBLAYERS ?= " \
  ##OEROOT##/meta \
  ##OEROOT##/meta-poky \
  ##OEROOT##/meta-yocto-bsp \
  "
BBLAYERS_EOF

cat >> "$TEMPLATE_DIR/local.conf.sample" <<'LOCALCONF_EOF'

#
# Keep the vscode-bitbake integration workspace aligned with the Yocto Project
# reference distro assumptions exercised by the scanner tests.
#
DISTRO ?= "poky"
LOCALCONF_EOF

cat > "$YOCTO_DIR/.templateconf" <<'TEMPLATECONF_EOF'
# Template settings
TEMPLATECONF=${TEMPLATECONF:-meta-poky/conf/templates/vscode-bitbake}
TEMPLATECONF_EOF
