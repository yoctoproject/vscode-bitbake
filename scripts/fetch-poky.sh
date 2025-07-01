#!/bin/bash

# Tag: yocto-5.2.1
COMMIT=fd9b605507a20d850a9991316cd190c1d20dc4a6

set -e

mkdir -p resources/poky
cd resources/poky
git clone https://github.com/yoctoproject/poky.git .
git fetch origin
git checkout $COMMIT
