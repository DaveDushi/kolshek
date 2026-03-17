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
  local dest="${HOME}/.claude/plugins/kolshek"
  mkdir -p "$dest"
  cp -r "$PLUGIN_DIR/.claude-plugin" "$dest/" 2>&1 || true
  cp -r "$PLUGIN_DIR/skills" "$dest/" 2>&1 || true
  cp -r "$PLUGIN_DIR/hooks" "$dest/" 2>&1 || true
  cp -r "$PLUGIN_DIR/references" "$dest/" 2>&1 || true
  mkdir -p "$dest/scripts"
  cp "$PLUGIN_DIR/scripts/check-config.sh" "$dest/scripts/" 2>&1 || true
  info "Claude Code: plugin installed -> $dest"
  echo "  Ensure ~/.claude/settings.json has: \"pluginDirs\": [\"$dest\"]"
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
  local skills_dest="$PROJECT_DIR/.agents/skills"
  mkdir -p "$skills_dest"

  local count=0
  local skill_index=""
  for d in "$PLUGIN_DIR"/skills/*/; do
    [[ -f "$d/SKILL.md" ]] || continue
    local name
    name="$(basename "$d")"
    copy_skill_with_context "$d" "$skills_dest/kolshek-$name"
    skill_index="${skill_index}\n- **kolshek-${name}**: $(get_frontmatter "$d/SKILL.md" "description" | head -1)"
    (( count++ )) || true
  done

  cat > "$PROJECT_DIR/AGENTS.md" <<AGENTS_EOF
# KolShek (כל שקל) — Israeli Finance CLI

## Available Skills

Skills are located in \`.agents/skills/kolshek-*/SKILL.md\`. Read a skill file for detailed instructions.

$(echo -e "$skill_index")

## CLI Reference

Read \`.agents/skills/kolshek-init/references/cli-reference.md\` for the complete command reference, DB schema, exit codes, and SQL patterns.
AGENTS_EOF

  info "Codex: $count skills + AGENTS.md -> $PROJECT_DIR/"
  warn "Project-scoped. Run from your project root."
}

# --- OpenClaw ---
install_openclaw() {
  local skills_dest="$PROJECT_DIR/.agents/skills"
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
  warn "Project-scoped. Run from your project root."
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
