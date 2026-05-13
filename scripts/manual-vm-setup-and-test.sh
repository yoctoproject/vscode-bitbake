#!/usr/bin/env bash
# manual-vm-setup-and-test.sh
#
# Autonomously runs integration tests inside the VM via SSH + SCP.
# Uploads vm-test-runner.sh to the VM and executes it there.
#
# Prerequisites:
#   - VM must be running (started by run-headless-vm-tests.sh)
#   - npm run compile must have been run on the host
#   - sshpass must be installed: sudo apt install sshpass
#
# Usage:
#   bash scripts/manual-vm-setup-and-test.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

VM_HOST="localhost"
VM_PORT="${VM_PORT:-2222}"
VM_USER="ubuntu"
RESULTS_FILE="$PROJECT_DIR/vm-test-results.log"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info()    { echo -e "${GREEN}[HOST]${NC} $*"; }
warning() { echo -e "${YELLOW}[HOST]${NC} $*"; }
error()   { echo -e "${RED}[HOST]${NC} $*" >&2; exit 1; }

run_ssh_cmd() {
    sshpass -p ubuntu ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
        "$VM_USER@$VM_HOST" -p "$VM_PORT" "$1"
}
run_scp() {
    sshpass -p ubuntu scp -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
        -P "$VM_PORT" "$1" "$VM_USER@$VM_HOST:$2"
}

check_host_prerequisites() {
    [[ -f "$PROJECT_DIR/integration-tests/out/runTest.js" ]] || \
        error "integration-tests/out/runTest.js not found. Run 'npm run compile' first."
    command -v sshpass >/dev/null 2>&1 || \
        error "sshpass not installed. Run: sudo apt install sshpass"
    info "✓ Prerequisites OK"
}

main() {
    echo ""
    echo "=========================================="
    echo " Autonomous VM Integration Test Runner"
    echo "=========================================="
    echo ""

    check_host_prerequisites

    info "Uploading vm-test-runner.sh to VM..."
    run_scp "$SCRIPT_DIR/vm-test-runner.sh" "/tmp/vm-test-runner.sh"
    run_ssh_cmd "chmod +x /tmp/vm-test-runner.sh"
    info "✓ Script uploaded"

    info "Starting tests (this will take ~25-30 minutes)..."
    info "Results → $RESULTS_FILE"
    echo ""

    > "$RESULTS_FILE"

    run_ssh_cmd "bash /tmp/vm-test-runner.sh" 2>&1 | tee -a "$RESULTS_FILE"
    local exit_code=${PIPESTATUS[0]}

    echo ""
    echo "=========================================="
    echo " Results Summary"
    echo "=========================================="
    echo "Exit code: $exit_code"
    echo "Results file: $RESULTS_FILE"
    echo ""
    echo "Last 100 lines:"
    echo "---"
    tail -100 "$RESULTS_FILE"
    echo "---"
    echo ""

    if (( exit_code == 0 )); then
        info "✓ Tests completed — check above for pass/fail counts"
    else
        warning "⚠ Exit code $exit_code — check above for failure details"
    fi

    return $exit_code
}

main "$@"
