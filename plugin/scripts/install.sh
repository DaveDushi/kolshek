#!/usr/bin/env bash
#
# install.sh — Install KolShek plugin for a specific agentic tool.
#
# Generates tool-specific configs directly from canonical plugin/skills/
# sources. No convert.sh or integrations/ needed.
#
# Usage:
#   ./plugin/scripts/install.sh --tool <name> [--project-dir <path>] [--help]
#
# Tools:
#   claude-code  — Copy plugin to ~/.claude/plugins/kolshek/ (native)
#   opencode     — Generate .opencode/skills/ in project dir
#   codex        — Generate AGENTS.md + .agents/skills/ in project dir
#   openclaw     — Generate .agents/skills/ in project dir

set -euo pipefail

# --- Colours ---
if [[ -t 1 ]]; then
  GREEN=$'\033[0;32m'; YELLOW=$'\033[1;33m'; RED=$'\033[0;31m'
  BOLD=$'\033[1m'; RESET=$'\033[0m'
else
  GREEN=''; YELLOW=''; RED=''; BOLD=''; RESET=''
fi

info()   { printf "${GREEN}[OK]${RESET}  %s\n" "$*"; }
warn()   { printf "${YELLOW}[!!]${RESET}  %s\n" "$*"; }
error()  { printf "${RED}[ERR]${RESET} %s\n" "$*" >&2; }
header() { printf "\n${BOLD}%s${RESET}\n" "$*"; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PROJECT_DIR="${PWD}"

usage() {
  sed -n '3,16p' "$0" | sed 's/^# \{0,1\}//'
  exit 0
}

# Copy a skill directory + inject cli-reference.md into its references/
copy_skill_with_context() {
  local skill_dir="$1" dest_dir="$2"
  cp -r "$skill_dir" "$dest_dir"
  mkdir -p "$dest_dir/references"
  cp "$PLUGIN_DIR/references/cli-reference.md" "$dest_dir/references/"
}

# Extract YAML frontmatter field from a markdown file
get_frontmatter() {
  local file="$1" field="$2"
  sed -n '/^---$/,/^---$/p' "$file" | grep "^${field}:" | sed "s/^${field}:[[:space:]]*//"
}

# --- Claude Code ---
install_claude_code() {
  local marketplace_dir="${HOME}/.claude/plugins/kolshek"
  local plugin_dir="${marketplace_dir}/kolshek"
  mkdir -p "$plugin_dir"

  # Copy plugin files into nested kolshek/ subdirectory
  cp -r "$PLUGIN_DIR/.claude-plugin" "$plugin_dir/" 2>&1 || true
  cp -r "$PLUGIN_DIR/skills" "$plugin_dir/" 2>&1 || true
  cp -r "$PLUGIN_DIR/hooks" "$plugin_dir/" 2>&1 || true
  cp -r "$PLUGIN_DIR/references" "$plugin_dir/" 2>&1 || true
  mkdir -p "$plugin_dir/scripts"
  cp "$PLUGIN_DIR/scripts/check-config.sh" "$plugin_dir/scripts/" 2>&1 || true

  # Write marketplace manifest at marketplace root
  mkdir -p "$marketplace_dir/.claude-plugin"
  cat > "$marketplace_dir/.claude-plugin/marketplace.json" <<'MANIFEST'
{
  "name": "kolshek-local",
  "owner": { "name": "KolShek" },
  "plugins": [
    {
      "name": "kolshek",
      "source": "./kolshek",
      "description": "KolShek — Israeli finance CLI plugin for Claude Code"
    }
  ]
}
MANIFEST

  info "Claude Code: plugin installed -> $marketplace_dir"

  # Auto-register in ~/.claude/settings.json
  local settings_file="${HOME}/.claude/settings.json"
  if command -v jq >/dev/null 2>&1; then
    local tmp_settings
    tmp_settings="$(mktemp)"
    if [ -f "$settings_file" ]; then
      jq --arg dir "$marketplace_dir" '
        .extraKnownMarketplaces["kolshek-local"] = {source: {source: "directory", path: $dir}} |
        .enabledPlugins["kolshek@kolshek-local"] = true
      ' "$settings_file" > "$tmp_settings" && mv "$tmp_settings" "$settings_file"
      info "Registered plugin in $settings_file"
    else
      mkdir -p "$(dirname "$settings_file")"
      jq -n --arg dir "$marketplace_dir" '{
        extraKnownMarketplaces: {"kolshek-local": {source: {source: "directory", path: $dir}}},
        enabledPlugins: {"kolshek@kolshek-local": true}
      }' > "$settings_file"
      info "Created $settings_file with plugin settings"
    fi
  else
    warn "jq not found — add these settings to $settings_file manually:"
    echo '  "extraKnownMarketplaces": {"kolshek-local": {"source": {"source": "directory", "path": "'"$marketplace_dir"'"}}}'
    echo '  "enabledPlugins": {"kolshek@kolshek-local": true}'
  fi
  echo "  Restart Claude Code to activate the plugin."
}

# --- OpenCode ---
install_opencode() {
  local skills_dest="$PROJECT_DIR/.opencode/skills"
  mkdir -p "$skills_dest"

  local count=0
  for d in "$PLUGIN_DIR"/skills/*/; do
    [[ -f "$d/SKILL.md" ]] || continue
    local name
    name="$(basename "$d")"
    copy_skill_with_context "$d" "$skills_dest/kolshek-$name"
    (( count++ )) || true
  done

  info "OpenCode: $count skills -> $PROJECT_DIR/.opencode/"
  warn "Project-scoped. Run from your project root."
}

# --- Codex ---
install_codex() {
  local skills_dest="${HOME}/.codex/skills"
  mkdir -p "$skills_dest"

  local count=0
  for d in "$PLUGIN_DIR"/skills/*/; do
    [[ -f "$d/SKILL.md" ]] || continue
    local name
    name="$(basename "$d")"
    copy_skill_with_context "$d" "$skills_dest/kolshek-$name"
    (( count++ )) || true
  done

  info "Codex: $count skills -> $skills_dest/"
}

# --- OpenClaw ---
install_openclaw() {
  local skills_dest="${HOME}/.openclaw/workspace/skills"
  mkdir -p "$skills_dest"

  local count=0
  for d in "$PLUGIN_DIR"/skills/*/; do
    [[ -f "$d/SKILL.md" ]] || continue
    local name
    name="$(basename "$d")"
    copy_skill_with_context "$d" "$skills_dest/kolshek-$name"
    (( count++ )) || true
  done

  info "OpenClaw: $count skills -> $skills_dest/"
}

# --- Main ---
main() {
  local tool=""

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --tool) tool="${2:?'--tool requires a value'}"; shift 2 ;;
      --project-dir) PROJECT_DIR="${2:?'--project-dir requires a value'}"; shift 2 ;;
      --help|-h) usage ;;
      *) error "Unknown option: $1"; usage ;;
    esac
  done

  if [[ -z "$tool" ]]; then
    error "Missing --tool. Options: claude-code, opencode, codex, openclaw"
    exit 1
  fi

  header "KolShek — Installing for $tool"

  case "$tool" in
    claude-code) install_claude_code ;;
    opencode)    install_opencode    ;;
    codex)       install_codex       ;;
    openclaw)    install_openclaw    ;;
    *) error "Unknown tool '$tool'. Options: claude-code, opencode, codex, openclaw"; exit 1 ;;
  esac

  echo ""
  info "Done!"
}

main "$@"
