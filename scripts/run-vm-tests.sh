#!/usr/bin/env bash
# run-vm-tests.sh
#
# Autonomously runs integration tests inside the VM via SSH.
# Monitors output and captures results to vm-test-results.log on the host.
#
# Prerequisites:
#   - The VM must be running (started by run-headless-vm-tests.sh)
#   - npm run compile must have been completed on the host
#
# Usage:
#   bash scripts/run-vm-tests.sh
#
# Expected run time: ~25-30 minutes
# Results are written to: vm-test-results.log (in project root)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

VM_HOST="localhost"
VM_PORT="${VM_PORT:-2222}"
VM_USER="ubuntu"
RESULTS_FILE="$PROJECT_DIR/vm-test-results.log"

# The deliberately broken DBUS address — matching CI runner conditions
BROKEN_DBUS="unix:path=/run/user/1001/bus"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

info()    { echo -e "${GREEN}[HOST]${NC} $*"; }
warning() { echo -e "${YELLOW}[HOST]${NC} $*"; }
error()   { echo -e "${RED}[HOST]${NC} $*" >&2; exit 1; }

# Verify prerequisites on host
check_host_prerequisites() {
    info "Checking host prerequisites..."

    if [[ ! -f "$PROJECT_DIR/integration-tests/out/runTest.js" ]]; then
        error "integration-tests/out/runTest.js not found. Run 'npm run compile' on the host first."
    fi
    info "✓ Compiled test runner found"

    if ! command -v sshpass >/dev/null 2>&1; then
        warning "sshpass not installed. Tests will require manual password entry."
        warning "Install with: sudo apt install sshpass"
    fi
}

# SSH command with password (non-interactive if sshpass available)
run_ssh_cmd() {
    local cmd="$1"
    if command -v sshpass >/dev/null 2>&1; then
        sshpass -p ubuntu ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
            "$VM_USER@$VM_HOST" -p "$VM_PORT" "$cmd"
    else
        ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
            "$VM_USER@$VM_HOST" -p "$VM_PORT" "$cmd"
    fi
}

# Main test execution
run_tests() {
    info "Connecting to VM at $VM_HOST:$VM_PORT as $VM_USER..."

    # Build the test command to run inside the VM
    local test_cmd='bash -c '"'"'
set -o pipefail
export HOME=/home/ubuntu
export DISPLAY=:99
export DBUS_SESSION_BUS_ADDRESS="'"${BROKEN_DBUS}"'"
export ELECTRON_DISABLE_SANDBOX=1

# Ensure 9p mount is available
if ! mountpoint -q /mnt/project 2>/dev/null; then
    echo "[VM] Mounting /mnt/project via 9p..."
    sudo mount -a 2>/dev/null || true
fi

if [ ! -f /mnt/project/package.json ]; then
    echo "[VM] ERROR: /mnt/project/package.json not found!" >&2
    exit 1
fi

echo "[VM] =========================================="
echo "[VM] Starting integration tests at $(date)"
echo "[VM] Node.js: $(node --version)"
echo "[VM] npm: $(npm --version)"
echo "[VM] DBUS_SESSION_BUS_ADDRESS='"${BROKEN_DBUS}"' (intentionally broken, matching CI)"
echo "[VM] =========================================="

cd /mnt/project

# Run the test command and capture output
xvfb-run --auto-servernum node ./integration-tests/out/runTest.js 2>&1

echo "[VM] Tests finished at $(date)"
echo "[VM] =========================================="
'"'"''

    # Execute the test command via SSH
    info "Running integration tests in VM (this will take ~25-30 minutes)..."
    info "Output is being streamed below and written to $RESULTS_FILE"
    info ""

    # Clear the results file and start fresh
    > "$RESULTS_FILE"

    # Stream output to both stdout and the results file
    run_ssh_cmd "$test_cmd" 2>&1 | tee -a "$RESULTS_FILE"
    local exit_code=${PIPESTATUS[0]}

    return $exit_code
}

# Parse and summarize results
summarize_results() {
    local exit_code=$1

    echo ""
    echo "=========================================="
    echo "Test Results Summary"
    echo "=========================================="

    # Count test outcomes
    local passing=0 failing=0 timeouts=0
    passing=$(grep -c "✓\|passing" "$RESULTS_FILE" || echo 0)
    failing=$(grep -c "✗\|failing" "$RESULTS_FILE" || echo 0)
    timeouts=$(grep -c "timeout\|300000ms" "$RESULTS_FILE" || echo 0)

    echo "Exit code: $exit_code"
    echo "Results file: $RESULTS_FILE"
    echo ""

    # Tail the last 50 lines of results
    echo "Last 50 lines of output:"
    echo "---"
    tail -50 "$RESULTS_FILE"
    echo "---"
    echo ""

    if (( exit_code == 0 )); then
        info "✓ Tests completed successfully (all passed)"
    else
        warning "⚠ Tests completed with failures (see above for details)"
        warning "Timeouts likely indicate the DBUS bug is reproduced (Pylance LS failed to start)"
    fi
}

# Main entry point
main() {
    echo ""
    echo "========================================"
    echo " Autonomous VM Integration Test Runner"
    echo "========================================"
    echo ""

    check_host_prerequisites

    info "Test results will be saved to: $RESULTS_FILE"
    echo ""

    local exit_code=0
    run_tests || exit_code=$?

    summarize_results $exit_code
}

main "$@"
