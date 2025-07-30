#!/bin/bash

# Tag: yocto-5.2.2
COMMIT=41038342a471b4a8884548568ad147a1704253a3

set -e

mkdir -p resources/poky
cd resources/poky
git clone https://github.com/yoctoproject/poky.git .
git fetch origin
git checkout $COMMIT
