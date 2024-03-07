#!/bin/bash

# Tag: yocto-4.3.3
COMMIT=d3b27346c3a4a7ef7ec517e9d339d22bda74349d

set -e

mkdir -p resources/poky
cd resources/poky
git clone https://github.com/yoctoproject/poky.git .
git fetch origin
git checkout $COMMIT

