#!/usr/bin/env bash
# KolShek session start hook — checks configuration status and injects context.
# Non-blocking: always exits 0.

# Resolve platform-correct config dir via env-paths
CONFIG_DIR=$(bun -e "import envPaths from 'env-paths'; console.log(envPaths('kolshek').config)" 2>&1)
if [ $? -ne 0 ] || [ -z "$CONFIG_DIR" ]; then
  CONFIG_DIR=""
fi

# Check if kolshek CLI is available
if ! _kolshek_path=$(command -v kolshek 2>&1); then
  echo "KolShek CLI is not installed. Run /kolshek:init to get started."
  exit 0
fi

# Check providers — test exit code and whether data array is empty
providers_output=$(kolshek providers list --json 2>&1)
providers_exit=$?

if [ $providers_exit -ne 0 ]; then
  echo "KolShek is installed but not configured. Run /kolshek:init to get started."
  exit 0
fi

if echo "$providers_output" | grep -q '"data":\[\]'; then
  echo "KolShek is installed but no providers configured. Run /kolshek:init to get started."
  exit 0
fi

# Check for unauthenticated providers
if echo "$providers_output" | grep -q '"authenticated":false'; then
  echo "KolShek: some providers need re-authentication. Run 'kolshek providers auth <id>' to fix."
fi

# Check for config files
config_files=""
if [ -n "$CONFIG_DIR" ] && [ -f "$CONFIG_DIR/budget.toml" ]; then
  config_files="${config_files} budget"
fi

# Check schedule status
schedule_output=$(kolshek schedule status --json 2>&1)
has_schedule=""
if echo "$schedule_output" | grep -q '"registered":true'; then
  has_schedule="yes"
fi

# Build status message
status_msg="KolShek: ready"
[ -n "$config_files" ] && status_msg="${status_msg}, configured:${config_files}"
[ -n "$has_schedule" ] && status_msg="${status_msg}, auto-fetch: on"
[ -z "$config_files" ] && status_msg="${status_msg}. Run /kolshek:analyze to set budget targets."

echo "$status_msg"
exit 0
