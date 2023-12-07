#!/usr/bin/bash

docker build --tag=vscode-bitbake-test './docker-image'

# We need to mount the whole repository and not just project-folder because
# of the poky symlink
docker run --rm \
    -p2222:22 \
    -v "$(realpath ../..)":"$(realpath ../..)" \
    --workdir "$(realpath .)" \
    -it vscode-bitbake-test
