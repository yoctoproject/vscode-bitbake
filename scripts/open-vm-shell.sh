#!/usr/bin/env bash
# open-vm-shell.sh
#
# Opens an interactive SSH terminal to the running test VM.
# Useful for manual debugging and exploration.
#
# Prerequisites:
#   - The VM must be running (started by run-headless-vm-tests.sh)
#   - SSH should be available at localhost:2222 with password 'ubuntu'
#
# Usage:
#   bash scripts/open-vm-shell.sh
#
# Once inside the VM, you can:
#   - Mount the project: sudo mount -a
#   - Check mount status: mount | grep project
#   - Run tests manually: cd /mnt/project && npm run test:integration
#   - Check test results: tail -f /mnt/project/vm-test-results.log
#   - Exit with: exit

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

VM_HOST="localhost"
VM_PORT="${VM_PORT:-2222}"
VM_USER="ubuntu"

echo "=========================================="
echo "Connecting to test VM via SSH"
echo "=========================================="
echo "Host:     $VM_HOST:$VM_PORT"
echo "User:     $VM_USER"
echo "Password: ubuntu"
echo ""
echo "Inside the VM, useful commands:"
echo "  mount | grep project           # Check 9p mount"
echo "  sudo mount -a                  # Mount project if not auto-mounted"
echo "  tail -f /mnt/project/vm-test-results.log  # Watch test output"
echo "=========================================="
echo ""

# SSH into the VM with password authentication
# Using sshpass if available for passwordless entry, otherwise standard SSH
if command -v sshpass >/dev/null 2>&1; then
    sshpass -p ubuntu ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
        "$VM_USER@$VM_HOST" -p "$VM_PORT"
else
    # Standard SSH — user will be prompted for password
    ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
        "$VM_USER@$VM_HOST" -p "$VM_PORT"
fi
