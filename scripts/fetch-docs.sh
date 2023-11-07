#!/bin/bash
set -e

mkdir -p resources/docs 
#  Bitbake docs
git clone --depth 1 --filter=blob:none --sparse https://github.com/openembedded/bitbake.git 
cd bitbake 
git sparse-checkout set doc/bitbake-user-manual/ 
git fetch origin
git checkout 595176d6be95a9c4718d3a40499d1eb576b535f5
cd doc/bitbake-user-manual/ 
mv bitbake-user-manual-metadata.rst bitbake-user-manual-ref-variables.rst  ../../../resources/docs 
cd ../../../ 
rm -rf bitbake

# Yocto docs
git clone --depth 1 --filter=blob:none --sparse https://git.yoctoproject.org/yocto-docs 
cd yocto-docs 
git sparse-checkout set documentation/ref-manual 
git fetch origin
git checkout 897d5017eae6b3af2d5d489fc4e0915d9ce21458
cd documentation/ref-manual 
mv tasks.rst ../../../resources/docs 
cd ../../../ 
rm -rf yocto-docs

# This line is added to let the last task in tasks.rst get matched by the regex in doc scanner
echo "\n.. _ref-dummy-end-for-matching-do-validate-branches:" >> resources/docs/tasks.rst