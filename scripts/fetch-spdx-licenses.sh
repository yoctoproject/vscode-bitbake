#!/bin/bash

# Tag: v3.26.0
SPDX_LICENSES_COMMIT=558c64b2e0a93fa86aab8a6dcbd84a565846a48e

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
