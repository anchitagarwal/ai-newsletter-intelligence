#!/usr/bin/env bash
# Fix Obsidian REST API connectivity from VPS via Tailscale.
#
# Problem: The Obsidian Local REST API plugin binds to 127.0.0.1:27123 only,
# not to the Tailscale interface (100.125.175.107). The VPS cannot reach it.
#
# Fix: Use socat to forward the Tailscale interface to localhost.
# Run this on the Mac. It must stay running while n8n workflows execute.
#
# After running this, update n8n Obsidian HTTP nodes to use port 27124.
#
# Alternative (no socat needed): Check Obsidian Local REST API plugin settings
# for a "Listen on all interfaces" or bind address option — set it to 0.0.0.0.

set -e

echo "Starting socat forward: Tailscale 100.125.175.107:27124 → localhost:27123"
echo "Keep this terminal open while n8n is running."
echo "Update n8n Obsidian nodes to use port 27124."
echo ""
echo "Press Ctrl+C to stop."

socat TCP-LISTEN:27124,bind=0.0.0.0,fork TCP:127.0.0.1:27123
