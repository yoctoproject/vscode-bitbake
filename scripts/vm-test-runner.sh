#!/bin/bash
# vm-test-runner.sh
# This script runs INSIDE the VM.
# Upload and execute via: scp + ssh

set -euo pipefail

BROKEN_DBUS="unix:path=/run/user/1001/bus"

echo "[VM] =========================================="
echo "[VM] Integration Test Setup & Execution"
echo "[VM] Start time: $(date)"
echo "[VM] =========================================="
echo ""

# Step 1: Check/mount 9p project
echo "[VM] Step 1: Checking 9p project mount..."
if mountpoint -q /mnt/project 2>/dev/null; then
    echo "[VM]   ✓ /mnt/project already mounted"
else
    echo "[VM]   Mounting /mnt/project via 9p..."
    sudo mkdir -p /mnt/project
    sudo mount -a 2>/dev/null || sudo mount -t 9p -o trans=virtio,version=9p2000.L project /mnt/project
    mountpoint -q /mnt/project && echo "[VM]   ✓ Mounted" || { echo "[VM]   ✗ Mount failed"; exit 1; }
fi

[ -f /mnt/project/package.json ] || { echo "[VM]   ✗ package.json not found"; exit 1; }

# Step 2: Install Node.js if not present
echo "[VM] Step 2: Checking Node.js..."
if ! command -v node >/dev/null 2>&1; then
    echo "[VM]   Installing Node.js 20 via NodeSource..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash - >/dev/null 2>&1
    sudo apt-get install -y nodejs >/dev/null 2>&1
    echo "[VM]   ✓ Installed: $(node --version)"
else
    echo "[VM]   ✓ Already present: $(node --version)"
fi

# Step 3: Install all required dependencies
echo "[VM] Step 3: Installing dependencies..."
sudo apt-get update -qq >/dev/null 2>&1
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y \
    xvfb dbus-x11 dbus \
    python3 python3-pip python3-git python3-jinja2 python3-pexpect python3-subunit \
    chrpath diffstat lz4 \
    libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libgbm1 \
    libgtk-3-0 libnss3 libsecret-1-0 libxss1 libxrandr2 \
    libx11-xcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 \
    libxfixes3 libxi6 libxrender1 libxtst6 libasound2 \
    libpango-1.0-0 libcairo2 libglib2.0-0 libdbus-1-3 \
    docker.io \
    >/dev/null 2>&1
echo "[VM]   ✓ Dependencies installed"

echo "[VM] Step 3b: Enabling Docker..."
sudo systemctl enable --now docker >/dev/null 2>&1
sudo usermod -aG docker ubuntu >/dev/null 2>&1 || true
echo "[VM]   ✓ Docker ready: $(sudo docker --version)"

# Step 4: Verify test artifacts
echo "[VM] Step 4: Verifying test artifacts..."
[ -f /mnt/project/integration-tests/out/runTest.js ] || { echo "[VM]   ✗ runTest.js not found"; exit 1; }
echo "[VM]   ✓ Test runner found"

# Step 5: Run integration tests
echo "[VM] Step 5: Running integration tests..."
echo "[VM]   Node.js: $(node --version)"
echo "[VM]   npm: $(npm --version)"
echo "[VM]   DBUS_SESSION_BUS_ADDRESS=${BROKEN_DBUS} (intentionally broken, matching CI)"
echo "[VM] =========================================="
echo ""

export HOME=/home/ubuntu
export DISPLAY=:99
export DBUS_SESSION_BUS_ADDRESS="${BROKEN_DBUS}"
export ELECTRON_DISABLE_SANDBOX=1

cd /mnt/project

xvfb-run --auto-servernum node ./integration-tests/out/runTest.js 2>&1

echo ""
echo "[VM] =========================================="
echo "[VM] Tests finished at $(date)"
echo "[VM] =========================================="
