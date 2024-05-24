#!/bin/bash

# Tag: yocto-5.0.1
COMMIT=4b07a5316ed4b858863dfdb7cab63859d46d1810

set -e

mkdir -p resources/poky
cd resources/poky
git clone https://github.com/yoctoproject/poky.git .
git fetch origin
git checkout $COMMIT

