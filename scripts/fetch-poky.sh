#!/bin/bash

# Tag: yocto-5.0
COMMIT=fb91a49387cfb0c8d48303bb3354325ba2a05587

set -e

mkdir -p resources/poky
cd resources/poky
git clone https://github.com/yoctoproject/poky.git .
git fetch origin
git checkout $COMMIT

