#!/bin/bash

set -e

git clone --depth 1 --filter=blob:none --sparse https://github.com/yoctoproject/poky.git
cd poky
git fetch --tags
TMP_TAG=$(git tag | grep "yocto-" | tail -n 1) # There is a tag: yocto_1.5_M5.rc8 which will take the tail, thus adding a hyphen
LASTEST_RELEASE=$(git show $TMP_TAG | grep commit | sed "s/^commit //")
LINK="https://downloads.yoctoproject.org/releases/yocto/$TMP_TAG/poky-$LASTEST_RELEASE.tar.bz2"
cd ..
rm -rf poky

mkdir -p resources/poky
curl -L -o resources/poky.tar.bz2 $LINK 
tar -xvjf resources/poky.tar.bz2 -C resources