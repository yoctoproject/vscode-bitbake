#!/bin/bash

set -e

mkdir -p resources/poky
cd resources/poky
git clone https://github.com/yoctoproject/poky.git .
git fetch --tags
TMP_TAG=$(git tag | grep "yocto-" | tail -n 1) # There is a tag: yocto_1.5_M5.rc8 which will take the tail, thus adding a hyphen
LASTEST_RELEASE=$(git show $TMP_TAG | grep commit | sed "s/^commit //")
git fetch origin
git checkout $LASTEST_RELEASE

