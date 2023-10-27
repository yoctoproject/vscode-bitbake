#!/usr/bin/bash

docker build --tag=vscode-bitbake-test './docker-image'

# We need to mount the whole repository and not just project-folder because
# of the poky symlink
docker run --rm \
    -p2222:22 \
    -v "$(realpath ../..)":'/home/yoctouser/vscode-bitbake' \
    --workdir '/home/yoctouser/vscode-bitbake/integration-tests/project-folder' \
    -it vscode-bitbake-test
