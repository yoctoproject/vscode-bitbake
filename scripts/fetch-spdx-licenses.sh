#!/bin/bash

# Tag: v3.28.0
SPDX_LICENSES_COMMIT=779ef2e5dff6d4af389c53de5e97116ab0bb52e8

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
