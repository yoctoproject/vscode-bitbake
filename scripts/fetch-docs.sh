#!/bin/bash

# Tag: yocto-5.0.2
BITBAKE_DOCS_COMMIT=8714a02e13477a9d97858b3642e05f28247454b5
    (cherry picked from commit c56bd9a9280378bc64c6a7fe6d7b70847e0b9e6d)
# Tag: yocto-5.0.2
YOCTO_DOCS_COMMIT=875dfe69e93bf8fee3b8c07818a6ac059f228a13

BITBAKE_DOCS_LIST="bitbake-user-manual-metadata.rst bitbake-user-manual-ref-variables.rst"
YOCTO_DOCS_LIST=" tasks.rst variables.rst"

set -e
cd "$(dirname "$(readlink -f "$0")")/.."

mkdir -p server/resources/docs
#  Bitbake docs
git clone --depth 1 --filter=blob:none --sparse https://github.com/openembedded/bitbake.git
cd bitbake
git sparse-checkout set doc/bitbake-user-manual/
git fetch origin
git checkout $BITBAKE_DOCS_COMMIT
cd doc/bitbake-user-manual/
mv $BITBAKE_DOCS_LIST  ../../../server/resources/docs
cd ../../../
rm -rf bitbake

# Yocto docs
git clone --depth 1 --filter=blob:none --sparse https://git.yoctoproject.org/yocto-docs
cd yocto-docs
git sparse-checkout set documentation/ref-manual
git fetch origin
git checkout $YOCTO_DOCS_COMMIT
cd documentation/ref-manual
mv $YOCTO_DOCS_LIST ../../../server/resources/docs
cd ../../../
rm -rf yocto-docs

# This line is added to let the last task in tasks.rst get matched by the regex in doc scanner
echo "\n.. _ref-dummy-end-for-matching-do-validate-branches:" >> server/resources/docs/tasks.rst
