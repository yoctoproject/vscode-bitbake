#!/bin/bash

# Tag: yocto-5.0.3
COMMIT=0b37512fb4b231cc106768e2a7328431009b3b70

set -e

mkdir -p resources/poky
cd resources/poky
git clone https://github.com/yoctoproject/poky.git .
git fetch origin
git checkout $COMMIT
