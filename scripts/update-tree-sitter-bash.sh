#!/usr/bin/env bash
set -e

. "$(dirname "$0")/update-tree-sitter.sh"

repo_name=tree-sitter-bash
repo_owner=tree-sitter

update-tree-sitter $repo_name $repo_owner
