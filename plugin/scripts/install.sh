#!/usr/bin/env bash
#
# install.sh — Install KolShek plugin for a specific agentic tool.
#
# Reads generated files from plugin/integrations/ and copies them to the
# appropriate config directory. Run plugin/scripts/convert.sh first if
# integrations/ is missing or stale.
#
# Usage:
#   ./plugin/scripts/install.sh --tool <name> [--help]
#
# Tools:
#   claude-code  — Install plugin to ~/.claude/plugins/kolshek/ (native)
#   cursor       — Copy rules to .cursor/rules/ in current directory
#   gemini-cli   — Install extension to ~/.gemini/extensions/kolshek/
#   antigravity  — Copy skills to ~/.gemini/antigravity/skills/
#   opencode     — Copy agents to .opencode/agent/ in current directory
#   aider        — Copy CONVENTIONS.md to current directory
#   windsurf     — Copy .windsurfrules to current directory

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
INTEGRATIONS="$PLUGIN_DIR/integrations"

usage() {
  sed -n '3,20p' "$0" | sed 's/^# \{0,1\}//'
  exit 0
}

check_integrations() {
  if [[ ! -d "$INTEGRATIONS" ]]; then
    error "integrations/ not found. Run ./plugin/scripts/convert.sh first."
    exit 1
  fi
}

install_claude_code() {
  # Claude Code: copy the entire plugin directory as-is
  local dest="${HOME}/.claude/plugins/kolshek"
  mkdir -p "$dest"
  # Copy canonical plugin files (not integrations)
  cp -r "$PLUGIN_DIR/.claude-plugin" "$dest/" 2>/dev/null || true
  cp -r "$PLUGIN_DIR/agents" "$dest/" 2>/dev/null || true
  cp -r "$PLUGIN_DIR/skills" "$dest/" 2>/dev/null || true
  cp -r "$PLUGIN_DIR/hooks" "$dest/" 2>/dev/null || true
  cp -r "$PLUGIN_DIR/scripts" "$dest/" 2>/dev/null || true
  cp "$PLUGIN_DIR/CONTEXT.md" "$dest/" 2>/dev/null || true
  info "Claude Code: plugin installed -> $dest"
  echo "  Add to ~/.claude/settings.json: \"pluginDirs\": [\"$dest\"]"
}

install_cursor() {
  local src="$INTEGRATIONS/cursor/rules"
  local dest="${PWD}/.cursor/rules"
  [[ -d "$src" ]] || { error "Run convert.sh first."; exit 1; }
  mkdir -p "$dest"
  local count=0
  for f in "$src"/*.mdc; do
    [[ -f "$f" ]] || continue
    cp "$f" "$dest/"
    (( count++ )) || true
  done
  info "Cursor: $count rules -> $dest"
  warn "Project-scoped. Run from your project root."
}

install_gemini_cli() {
  local src="$INTEGRATIONS/gemini-cli"
  local dest="${HOME}/.gemini/extensions/kolshek"
  [[ -d "$src" ]] || { error "Run convert.sh first."; exit 1; }
  mkdir -p "$dest/skills"
  cp "$src/gemini-extension.json" "$dest/"
  local count=0
  for d in "$src"/skills/*/; do
    [[ -f "$d/SKILL.md" ]] || continue
    local name
    name="$(basename "$d")"
    mkdir -p "$dest/skills/$name"
    cp "$d/SKILL.md" "$dest/skills/$name/"
    (( count++ )) || true
  done
  info "Gemini CLI: $count skills -> $dest"
}

install_antigravity() {
  local src="$INTEGRATIONS/antigravity"
  local dest="${HOME}/.gemini/antigravity/skills"
  [[ -d "$src" ]] || { error "Run convert.sh first."; exit 1; }
  mkdir -p "$dest"
  local count=0
  for d in "$src"/*/; do
    [[ -f "$d/SKILL.md" ]] || continue
    local name
    name="$(basename "$d")"
    mkdir -p "$dest/$name"
    cp "$d/SKILL.md" "$dest/$name/"
    (( count++ )) || true
  done
  info "Antigravity: $count skills -> $dest"
}

install_opencode() {
  local src="$INTEGRATIONS/opencode/agent"
  local dest="${PWD}/.opencode/agent"
  [[ -d "$src" ]] || { error "Run convert.sh first."; exit 1; }
  mkdir -p "$dest"
  local count=0
  for f in "$src"/*.md; do
    [[ -f "$f" ]] || continue
    cp "$f" "$dest/"
    (( count++ )) || true
  done
  info "OpenCode: $count agents -> $dest"
  warn "Project-scoped. Run from your project root."
}

install_aider() {
  local src="$INTEGRATIONS/aider/CONVENTIONS.md"
  local dest="${PWD}/CONVENTIONS.md"
  [[ -f "$src" ]] || { error "Run convert.sh first."; exit 1; }
  if [[ -f "$dest" ]]; then
    warn "CONVENTIONS.md already exists at $dest — remove to reinstall."
    return 0
  fi
  cp "$src" "$dest"
  info "Aider: CONVENTIONS.md -> $dest"
  warn "Project-scoped. Run from your project root."
}

install_windsurf() {
  local src="$INTEGRATIONS/windsurf/.windsurfrules"
  local dest="${PWD}/.windsurfrules"
  [[ -f "$src" ]] || { error "Run convert.sh first."; exit 1; }
  if [[ -f "$dest" ]]; then
    warn ".windsurfrules already exists at $dest — remove to reinstall."
    return 0
  fi
  cp "$src" "$dest"
  info "Windsurf: .windsurfrules -> $dest"
  warn "Project-scoped. Run from your project root."
}

main() {
  local tool=""

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --tool) tool="${2:?'--tool requires a value'}"; shift 2 ;;
      --help|-h) usage ;;
      *) error "Unknown option: $1"; usage ;;
    esac
  done

  if [[ -z "$tool" ]]; then
    error "Missing --tool. Options: claude-code, cursor, gemini-cli, antigravity, opencode, aider, windsurf"
    exit 1
  fi

  check_integrations

  header "KolShek -- Installing for $tool"

  case "$tool" in
    claude-code) install_claude_code ;;
    cursor)      install_cursor      ;;
    gemini-cli)  install_gemini_cli  ;;
    antigravity) install_antigravity ;;
    opencode)    install_opencode    ;;
    aider)       install_aider       ;;
    windsurf)    install_windsurf    ;;
    *) error "Unknown tool '$tool'."; exit 1 ;;
  esac

  echo ""
  info "Done!"
}

main "$@"
