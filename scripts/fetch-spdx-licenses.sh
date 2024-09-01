#!/bin/bash

# Tag: v3.25.0
SPDX_LICENSES_COMMIT=fc55e415a435a8608a2e273ee901b6a8a5bdaab1

set -e
cd "$(dirname "$(readlink -f "$0")")/.."

mkdir -p server/resources
git clone --depth 1 --filter=blob:none --sparse https://github.com/spdx/license-list-data.git
cd license-list-data
git sparse-checkout set json
git fetch origin
git checkout $SPDX_LICENSES_COMMIT
mv json/licenses.json  ../server/resources/spdx-licenses.json
cd ..
rm -rf license-list-data
