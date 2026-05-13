#!/usr/bin/env bash
# run-headless-vm-tests.sh
#
# Boots a QEMU/KVM Ubuntu 22.04 VM that mounts this project directory via
# 9p virtio and runs the vscode-bitbake integration tests in a fully headless
# environment — no desktop session, and a deliberately broken
# DBUS_SESSION_BUS_ADDRESS — matching the exact conditions of the CI runner.
#
# The VM stays running after the tests finish so you can SSH in to investigate:
#   ssh ubuntu@localhost -p 2222   (password: ubuntu)
#
# Usage:
#   # On the host, compile first (the VM runs these .js files directly):
#   npm run compile
#
#   # Then launch the VM:
#   bash scripts/run-headless-vm-tests.sh
#
# Prerequisites (apt):
#   qemu-system-x86_64  qemu-kvm  qemu-utils
#   cloud-image-utils      (provides cloud-localds)  — OR —
#   xorriso                (fallback ISO builder, usually already installed)  — OR —
#   genisoimage / mkisofs  (alternative fallback)
#
# The script caches the Ubuntu cloud image in scripts/vm-cache/ to avoid
# re-downloading on subsequent runs.  That directory is .gitignored.
#
# Environment variables you can override:
#   VM_MEM    — RAM in MB   (default: 8192)
#   VM_CPUS   — vCPU count  (default: 4)
#   VM_PORT   — SSH host port (default: 2222)
#   DISK_SIZE — overlay disk size (default: 12G)

set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
CACHE_DIR="$SCRIPT_DIR/vm-cache"
RUN_DIR="$CACHE_DIR/run"  # ephemeral per-run files (disk overlay, cloud-init ISO)

UBUNTU_VERSION="22.04"
UBUNTU_CODENAME="jammy"
IMAGE_URL="https://cloud-images.ubuntu.com/${UBUNTU_CODENAME}/current/${UBUNTU_CODENAME}-server-cloudimg-amd64.img"
BASE_IMAGE="$CACHE_DIR/${UBUNTU_CODENAME}-server-cloudimg-amd64.img"
OVERLAY_IMAGE="$RUN_DIR/vm-disk.qcow2"
CLOUD_INIT_ISO="$RUN_DIR/cloud-init.iso"

VM_MEM="${VM_MEM:-8192}"
VM_CPUS="${VM_CPUS:-4}"
VM_PORT="${VM_PORT:-2222}"
DISK_SIZE="${DISK_SIZE:-12G}"

# The deliberately broken DBUS address — exactly as hardcoded in CI.
# CI runner user has UID 13010; /run/user/1001/bus belongs to a different user
# and will not exist.  Inside the VM, ubuntu user is UID 1000, so
# /run/user/1001/bus similarly does not exist → same broken state as CI.
BROKEN_DBUS="unix:path=/run/user/1001/bus"

RESULTS_FILE="$PROJECT_DIR/vm-test-results.log"

# ---------------------------------------------------------------------------
# Colours
# ---------------------------------------------------------------------------
RED='\033[0;31m'; YELLOW='\033[1;33m'; GREEN='\033[0;32m'; NC='\033[0m'
info()    { echo -e "${GREEN}[VM]${NC} $*"; }
warning() { echo -e "${YELLOW}[VM]${NC} $*"; }
error()   { echo -e "${RED}[VM]${NC} $*" >&2; exit 1; }

# ---------------------------------------------------------------------------
# Phase 1: Prerequisites
# ---------------------------------------------------------------------------
check_prerequisites() {
    info "Checking prerequisites..."

    local missing=()
    command -v qemu-system-x86_64 >/dev/null 2>&1 || missing+=(qemu-system-x86_64)
    command -v qemu-img            >/dev/null 2>&1 || missing+=(qemu-img)

    if [[ ${#missing[@]} -gt 0 ]]; then
        error "Missing tools: ${missing[*]}. Install with: sudo apt install qemu-system-x86 qemu-utils qemu-kvm"
    fi

    # ISO builder: prefer cloud-localds, fall back to xorriso / genisoimage / mkisofs
    if command -v cloud-localds >/dev/null 2>&1; then
        ISO_BUILDER="cloud-localds"
    elif command -v xorriso >/dev/null 2>&1; then
        ISO_BUILDER="xorriso"
    elif command -v genisoimage >/dev/null 2>&1; then
        ISO_BUILDER="genisoimage"
    elif command -v mkisofs >/dev/null 2>&1; then
        ISO_BUILDER="mkisofs"
    else
        error "No ISO builder found. Install one of: cloud-image-utils (cloud-localds), xorriso, or genisoimage"
    fi
    info "ISO builder: $ISO_BUILDER"

    # KVM check
    if [[ -e /dev/kvm ]]; then
        if [[ -r /dev/kvm && -w /dev/kvm ]]; then
            info "KVM available — hardware acceleration enabled."
            KVM_FLAGS="-enable-kvm -cpu host"
        else
            warning "KVM device exists but is not accessible. Try: sudo usermod -aG kvm \$USER"
            warning "Falling back to software emulation (tests will be very slow)."
            KVM_FLAGS=""
        fi
    else
        warning "/dev/kvm not found. Falling back to software emulation (tests will be very slow)."
        KVM_FLAGS=""
    fi

    # 9p support (optional — try to load if not already present)
    if ! lsmod 2>/dev/null | grep -q 9pnet_virtio; then
        info "Loading 9p kernel modules (needed for project mount)..."
        # Use sudo -n to avoid interactive password prompt
        sudo -n modprobe 9pnet_virtio 2>/dev/null || \
            warning "Could not load 9pnet_virtio — VM may handle it automatically or mount will fail."
    fi

    # Check compiled output exists
    if [[ ! -f "$PROJECT_DIR/integration-tests/out/runTest.js" ]]; then
        error "integration-tests/out/runTest.js not found. Run 'npm run compile' on the host first."
    fi

    # Disk space: ~6 GB for base image + overlay
    local free_gb
    free_gb=$(df -BG "$CACHE_DIR" 2>/dev/null | awk 'NR==2{gsub("G",""); print $4}' || echo 20)
    if (( free_gb < 7 )); then
        warning "Only ${free_gb}GB free. You may need ~6GB for the Ubuntu cloud image + overlay."
    fi
}

# ---------------------------------------------------------------------------
# Phase 2: Obtain base image
# ---------------------------------------------------------------------------
prepare_base_image() {
    mkdir -p "$CACHE_DIR"
    if [[ -f "$BASE_IMAGE" ]]; then
        info "Using cached base image: $BASE_IMAGE"
    else
        info "Downloading Ubuntu ${UBUNTU_VERSION} cloud image (~600 MB)..."
        local tmp="${BASE_IMAGE}.tmp"
        curl -L --fail --progress-bar -o "$tmp" "$IMAGE_URL"
        mv "$tmp" "$BASE_IMAGE"
        info "Downloaded: $BASE_IMAGE"
    fi
}

# ---------------------------------------------------------------------------
# Phase 3: Create per-run overlay disk
# ---------------------------------------------------------------------------
prepare_overlay_disk() {
    mkdir -p "$RUN_DIR"
    info "Creating ${DISK_SIZE} qcow2 overlay over base image..."
    # Always fresh overlay so each run starts from a clean OS state
    rm -f "$OVERLAY_IMAGE"
    qemu-img create -f qcow2 -F qcow2 -b "$BASE_IMAGE" "$OVERLAY_IMAGE" "$DISK_SIZE" >/dev/null
    info "Overlay created: $OVERLAY_IMAGE"
}

# ---------------------------------------------------------------------------
# Phase 4: Build cloud-init ISO
# ---------------------------------------------------------------------------
build_cloud_init_iso() {
    info "Building cloud-init ISO..."

    # Inject host SSH public key if available
    local ssh_pub_key=""
    for key_file in "$HOME/.ssh/id_ed25519.pub" "$HOME/.ssh/id_rsa.pub" "$HOME/.ssh/id_ecdsa.pub"; do
        if [[ -f "$key_file" ]]; then
            ssh_pub_key=$(cat "$key_file")
            info "Injecting SSH public key from $key_file"
            break
        fi
    done

    # --- meta-data ---
    cat > "$RUN_DIR/meta-data" <<EOF
instance-id: vscode-bitbake-test-$(date +%s)
local-hostname: vscode-bitbake-test
EOF

    # --- user-data ---
    # Important: DBUS_SESSION_BUS_ADDRESS is intentionally set to a path that
    # does NOT correspond to the actual running user (ubuntu, UID 1000).
    # /run/user/1001/bus will not exist — replicating the exact broken condition
    # present in CI where the runner UID (13010) doesn't match the hardcoded 1001.
    cat > "$RUN_DIR/user-data" <<USERDATA
#cloud-config

# Allow SSH with password (for interactive debugging)
ssh_pwauth: true
chpasswd:
  list: |
    ubuntu:ubuntu
  expire: false

$(if [[ -n "$ssh_pub_key" ]]; then
  echo "# Inject host SSH key for passwordless access"
  echo "write_files:"
  echo "  - path: /home/ubuntu/.ssh/authorized_keys"
  echo "    owner: ubuntu:ubuntu"
  echo "    permissions: '0600'"
  echo "    content: |"
  echo "      $ssh_pub_key"
fi)

# Mount the project directory via 9p virtio
mounts:
  - [ "project", "/mnt/project", "9p", "trans=virtio,version=9p2000.L,rw,nofail,_netdev", "0", "0" ]

# Install all required dependencies
packages:
  - curl
  - git
  - python3
  - python3-pip
  - python3-git
  - python3-jinja2
  - python3-pexpect
  - python3-subunit
  - chrpath
  - diffstat
  - lz4
  - xvfb
  - dbus-x11
  - dbus
  - libatk1.0-0
  - libatk-bridge2.0-0
  - libcups2
  - libdrm2
  - libgbm1
  - libgtk-3-0
  - libnss3
  - libsecret-1-0
  - libxss1
  - libxrandr2
  - libx11-xcb1
  - libxcomposite1
  - libxcursor1
  - libxdamage1
  - libxext6
  - libxfixes3
  - libxi6
  - libxrender1
  - libxtst6
  - libasound2
  - libpango-1.0-0
  - libcairo2
  - libglib2.0-0
  - libdbus-1-3
    - docker.io

package_update: true
package_upgrade: false

runcmd:
  # Ensure SSH dir exists with correct permissions (write_files may run before homedir is ready)
  - mkdir -p /home/ubuntu/.ssh && chown ubuntu:ubuntu /home/ubuntu/.ssh && chmod 700 /home/ubuntu/.ssh
  - "[ -f /home/ubuntu/.ssh/authorized_keys ] && chown ubuntu:ubuntu /home/ubuntu/.ssh/authorized_keys && chmod 600 /home/ubuntu/.ssh/authorized_keys || true"

  # Install Node.js 20 via NodeSource
  - |
    set -e
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs

    # Ensure Docker is usable from the ubuntu account for command-wrapper tests
    - systemctl enable --now docker
    - usermod -aG docker ubuntu

  # Wait for the 9p project mount to be available
  - |
    for i in \$(seq 1 30); do
      if mountpoint -q /mnt/project 2>/dev/null || [ -f /mnt/project/package.json ]; then
        break
      fi
      echo "[VM] Waiting for /mnt/project mount... attempt \$i"
      sleep 2
    done
    if [ ! -f /mnt/project/package.json ]; then
      echo "[VM] ERROR: /mnt/project/package.json not found. 9p mount failed!" | tee -a /mnt/project/vm-test-results.log
      exit 1
    fi
    echo "[VM] Project mounted at /mnt/project"

  # Run integration tests as ubuntu user
  # DBUS_SESSION_BUS_ADDRESS is deliberately set to /run/user/1001/bus which
  # does not exist for the ubuntu user (UID 1000) — replicating the CI failure
  # condition where the hardcoded path doesn't match the actual runner UID.
  - |
    echo "[VM] Starting integration tests at \$(date)" | tee /mnt/project/vm-test-results.log
    echo "[VM] DBUS_SESSION_BUS_ADDRESS=${BROKEN_DBUS} (intentionally broken, matching CI)" | tee -a /mnt/project/vm-test-results.log
    echo "[VM] Node.js: \$(node --version), npm: \$(npm --version)" | tee -a /mnt/project/vm-test-results.log
    echo "---" | tee -a /mnt/project/vm-test-results.log
    sudo -u ubuntu bash -c '
      set -o pipefail
      export HOME=/home/ubuntu
      export DISPLAY=:99
      export DBUS_SESSION_BUS_ADDRESS="${BROKEN_DBUS}"
      export ELECTRON_DISABLE_SANDBOX=1
      cd /mnt/project
      xvfb-run --auto-servernum node ./integration-tests/out/runTest.js 2>&1 | tee -a /mnt/project/vm-test-results.log
      echo "EXIT_CODE:\$?" >> /mnt/project/vm-test-results.log
    ' 2>&1 | tee -a /mnt/project/vm-test-results.log
    echo "[VM] Tests finished at \$(date)" | tee -a /mnt/project/vm-test-results.log
    echo "[VM] Results written to /mnt/project/vm-test-results.log"
    echo "[VM] SSH still available: ssh ubuntu@localhost -p ${VM_PORT}"

final_message: |
  ============================================================
  vscode-bitbake VM test environment is ready.
  SSH access: ssh ubuntu@localhost -p ${VM_PORT}  (password: ubuntu)
  Project:    /mnt/project  (host 9p mount, read-write)
  Results:    /mnt/project/vm-test-results.log
  ============================================================
  Tests are running in the background via cloud-init runcmd.
  Tail results on the host with: tail -f ${RESULTS_FILE}
USERDATA

    # Build the ISO
    case "$ISO_BUILDER" in
        cloud-localds)
            cloud-localds "$CLOUD_INIT_ISO" "$RUN_DIR/user-data" "$RUN_DIR/meta-data"
            ;;
        xorriso)
            xorriso -as mkisofs \
                -output "$CLOUD_INIT_ISO" \
                -volid cidata \
                -joliet -rational-rock \
                "$RUN_DIR/user-data" "$RUN_DIR/meta-data" \
                >/dev/null 2>&1
            ;;
        genisoimage|mkisofs)
            "$ISO_BUILDER" \
                -output "$CLOUD_INIT_ISO" \
                -volid cidata \
                -joliet -rational-rock \
                "$RUN_DIR/user-data" "$RUN_DIR/meta-data" \
                >/dev/null 2>&1
            ;;
    esac
    info "Cloud-init ISO created: $CLOUD_INIT_ISO"
}

# ---------------------------------------------------------------------------
# Phase 5: Launch QEMU
# ---------------------------------------------------------------------------
launch_vm() {
    info "Launching QEMU VM (${VM_MEM}MB RAM, ${VM_CPUS} CPUs)..."
    info "Console is attached below. Press Ctrl-A X to kill QEMU (or let the VM run)."
    info ""
    info "SSH access will be available at:  ssh ubuntu@localhost -p ${VM_PORT}  (password: ubuntu)"
    info "Results file on host:             $RESULTS_FILE"
    info ""
    info "Tail test results with:  tail -f $RESULTS_FILE"
    info ""
    warning "First boot runs cloud-init (installs deps, ~5 min) then auto-runs integration tests (~25 min)."
    warning "Subsequent boots (same overlay) will re-run the tests immediately without reinstalling."
    echo ""

    # shellcheck disable=SC2086
    exec qemu-system-x86_64 \
        $KVM_FLAGS \
        -m "$VM_MEM" \
        -smp "$VM_CPUS" \
        \
        -drive "file=${OVERLAY_IMAGE},format=qcow2,if=virtio" \
        -drive "file=${CLOUD_INIT_ISO},format=raw,readonly=on,if=virtio" \
        \
        -virtfs "local,path=${PROJECT_DIR},mount_tag=project,security_model=mapped-xattr,multidevs=remap" \
        \
        -net nic,model=virtio \
        -net "user,hostfwd=tcp::${VM_PORT}-:22" \
        \
        -nographic \
        -serial mon:stdio
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
main() {
    echo ""
    echo "======================================================="
    echo " vscode-bitbake headless VM integration test runner"
    echo " Replicates CI DBUS_SESSION_BUS_ADDRESS bug"
    echo " Ubuntu ${UBUNTU_VERSION} | KVM | 9p project mount"
    echo "======================================================="
    echo ""

    check_prerequisites
    prepare_base_image
    prepare_overlay_disk
    build_cloud_init_iso
    launch_vm
}

main "$@"
