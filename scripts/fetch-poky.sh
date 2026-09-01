#!/bin/bash

BITBAKE_TAG=yocto-6.0.2
BITBAKE_COMMIT=acfe02fa38b5da9e6a36c6cedcf91d4fcbefbfbd

set -e

cd "$(dirname "$(readlink -f "$0")")/.."

RESOURCES_DIR="resources"
BOOTSTRAP_DIR="$RESOURCES_DIR/bitbake"
INTEGRATION_TESTS_DIR="integration-tests"
PROJECT_DIR="$INTEGRATION_TESTS_DIR/project-folder"
SOURCE_OVERRIDES_FILE="integration-tests/fixtures/bitbake-setup/source-overrides.json"
BUILD_CROPS_INIT_ENV="integration-tests/fixtures/bitbake-setup/build-crops-init-build-env"
BUILD_CROPS_BBLAYERS="integration-tests/fixtures/bitbake-setup/build-crops-bblayers.conf"

POKY_CONFIGURATION="poky-wrynose"
POKY_CONFIGURATION_VARIANT="poky"
POKY_DISTRO="distro/poky"
POKY_MACHINE="machine/qemux86-64"

mkdir -p "$RESOURCES_DIR" "$INTEGRATION_TESTS_DIR"

if [ ! -e "$BOOTSTRAP_DIR" ]; then
    git clone --depth 1 --branch "$BITBAKE_TAG" https://git.openembedded.org/bitbake "$BOOTSTRAP_DIR"
elif [ -d "$BOOTSTRAP_DIR/.git" ]; then
    git -C "$BOOTSTRAP_DIR" fetch --depth 1 origin "refs/tags/$BITBAKE_TAG:refs/tags/$BITBAKE_TAG"
else
    echo "$BOOTSTRAP_DIR exists but is not a Git checkout. Run npm run clean before fetching." >&2
    exit 1
fi

git -C "$BOOTSTRAP_DIR" checkout --detach "$BITBAKE_COMMIT"

"$BOOTSTRAP_DIR/bin/bitbake-setup" \
    --setting default top-dir-prefix "$PWD" \
    --setting default top-dir-name "$INTEGRATION_TESTS_DIR" \
    init \
    --non-interactive \
    --source-overrides "$SOURCE_OVERRIDES_FILE" \
    --setup-dir-name "$(basename "$PROJECT_DIR")" \
    "$POKY_CONFIGURATION" \
    "$POKY_CONFIGURATION_VARIANT" \
    "$POKY_DISTRO" \
    "$POKY_MACHINE"

mkdir -p "$PROJECT_DIR/build-crops"
cp -R "$PROJECT_DIR/build/conf" "$PROJECT_DIR/build-crops/conf"
rm -f "$PROJECT_DIR/build-crops/conf/site.conf"
cat > "$PROJECT_DIR/build-crops/conf/site.conf" <<'EOF'
# Container-specific site configuration for the command-wrapper integration test.
DL_DIR ?= "/workdir/integration-tests/.bitbake-setup-downloads"
SSTATE_DIR ?= "/workdir/integration-tests/.sstate-cache"
BB_HASHSERVE_DB_DIR ?= "${SSTATE_DIR}"
EOF
cp "$BUILD_CROPS_INIT_ENV" "$PROJECT_DIR/build-crops/init-build-env"
cp "$BUILD_CROPS_BBLAYERS" "$PROJECT_DIR/build-crops/conf/bblayers.conf"
