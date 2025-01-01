#!/bin/bash

# Tag: yocto-5.1.1
COMMIT=7e081bd98fdc5435e850d1df79a5e0f1e30293d0

set -e

mkdir -p resources/poky
cd resources/poky
git clone https://github.com/yoctoproject/poky.git .
git fetch origin
git checkout $COMMIT
