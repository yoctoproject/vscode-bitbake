#!/bin/bash

# Tag: v3.27.0
SPDX_LICENSES_COMMIT=60e0de29cbcf3e83bf9d5e299972a1969516d918

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
