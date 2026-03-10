#!/usr/bin/env bash
#
# convert.sh — Convert KolShek Claude Code plugin into formats for other tools.
#
# Reads the canonical plugin from plugin/ and generates tool-specific outputs
# to plugin/integrations/<tool>/.
#
# Usage:
#   ./plugin/scripts/convert.sh [--tool <name>] [--help]
#
# Tools:
#   cursor       — .mdc rule files for .cursor/rules/
#   gemini-cli   — Gemini CLI extension with SKILL.md files
#   antigravity  — Antigravity skills (~/.gemini/antigravity/skills/)
#   opencode     — OpenCode agent files (.opencode/agent/)
#   aider        — Single CONVENTIONS.md
#   windsurf     — Single .windsurfrules
#   all          — All tools (default)
#
# The Claude Code plugin is the canonical source. Other formats are generated
# from it. Run this after editing any plugin files.

set -euo pipefail

# --- Colours ---
if [[ -t 1 ]]; then
  GREEN=$'\033[0;32m'; YELLOW=$'\033[1;33m'; RED=$'\033[0;31m'
  BOLD=$'\033[1m'; DIM=$'\033[2m'; RESET=$'\033[0m'
else
  GREEN=''; YELLOW=''; RED=''; BOLD=''; DIM=''; RESET=''
fi

info()   { printf "${GREEN}[OK]${RESET}  %s\n" "$*"; }
warn()   { printf "${YELLOW}[!!]${RESET}  %s\n" "$*"; }
error()  { printf "${RED}[ERR]${RESET} %s\n" "$*" >&2; }
header() { printf "\n${BOLD}%s${RESET}\n" "$*"; }

# --- Paths ---
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
OUT_DIR="$PLUGIN_DIR/integrations"

# --- Usage ---
usage() {
  sed -n '3,22p' "$0" | sed 's/^# \{0,1\}//'
  exit 0
}

# --- Frontmatter helpers ---

# Extract a single field from YAML frontmatter.
# For multi-line values (using | or >), returns the first indented line.
# Usage: get_field <field> <file>
get_field() {
  local field="$1" file="$2"
  awk -v f="$field" '
    /^---$/ { fm++; next }
    fm == 1 && $0 ~ "^" f ": " {
      sub("^" f ": ", "")
      # If value is a block scalar indicator (| or >), grab next indented line
      if ($0 == "|" || $0 == ">") {
        getline
        sub(/^  /, "")
        print
        exit
      }
      print
      exit
    }
  ' "$file"
}

# Return everything after the frontmatter block.
# Usage: get_body <file>
get_body() {
  awk 'BEGIN{fm=0} /^---$/{fm++; next} fm>=2{print}' "$1"
}

# --- Content transforms ---

# Strip Claude Code-specific tool references from skill/agent body text.
# - "Use the AskUserQuestion tool" → "Ask the user"
# - "allowed-tools: ..." lines are already in frontmatter (stripped separately)
# - References to /kolshek:skill → kolshek:skill (remove slash for non-CC tools)
adapt_body() {
  sed \
    -e 's/Use the AskUserQuestion tool/Ask the user/g' \
    -e 's/Use AskUserQuestion/Ask the user/g' \
    -e 's/AskUserQuestion tool/a prompt/g' \
    -e 's/AskUserQuestion/user prompt/g' \
    -e 's|`/kolshek:|`kolshek:|g' \
    -e 's|/kolshek:|kolshek:|g'
}

# Read CONTEXT.md and format it as an inline reference block.
get_context_block() {
  if [[ -f "$PLUGIN_DIR/CONTEXT.md" ]]; then
    echo ""
    echo "---"
    echo ""
    echo "# Reference: KolShek CLI"
    echo ""
    cat "$PLUGIN_DIR/CONTEXT.md" | tail -n +2  # skip the "# KolShek Agent Briefing" title
  fi
}

# --- Converter: Cursor (.mdc rules) ---
convert_cursor() {
  local outdir="$OUT_DIR/cursor/rules"
  mkdir -p "$outdir"
  local count=0

  # Agent → rule
  for f in "$PLUGIN_DIR"/agents/*.md; do
    [[ -f "$f" ]] || continue
    local name description body slug
    name="$(get_field "name" "$f")"
    description="$(get_field "description" "$f")"
    body="$(get_body "$f" | adapt_body)"
    slug="kolshek-${name}"

    cat > "$outdir/${slug}.mdc" <<HEREDOC
---
description: "KolShek: ${description}"
globs: ""
alwaysApply: false
---
${body}
$(get_context_block)
HEREDOC
    (( count++ )) || true
  done

  # Skills → rules
  for d in "$PLUGIN_DIR"/skills/*/; do
    [[ -f "$d/SKILL.md" ]] || continue
    local name description body slug
    name="$(get_field "name" "$d/SKILL.md")"
    description="$(get_field "description" "$d/SKILL.md")"
    body="$(get_body "$d/SKILL.md" | adapt_body)"
    slug="kolshek-${name}"

    cat > "$outdir/${slug}.mdc" <<HEREDOC
---
description: "KolShek: ${description}"
globs: ""
alwaysApply: false
---
${body}
$(get_context_block)
HEREDOC
    (( count++ )) || true
  done

  info "Cursor: $count rules -> $outdir"
}

# --- Converter: Gemini CLI (extension with skills) ---
convert_gemini_cli() {
  local outdir="$OUT_DIR/gemini-cli"
  mkdir -p "$outdir/skills"
  local count=0

  # Extension manifest
  cat > "$outdir/gemini-extension.json" <<'HEREDOC'
{
  "name": "kolshek",
  "version": "0.1.0",
  "description": "KolShek — Israeli finance CLI integration"
}
HEREDOC

  # Agent → skill
  for f in "$PLUGIN_DIR"/agents/*.md; do
    [[ -f "$f" ]] || continue
    local name description body slug
    name="$(get_field "name" "$f")"
    description="$(get_field "description" "$f")"
    body="$(get_body "$f" | adapt_body)"
    slug="kolshek-${name}"
    mkdir -p "$outdir/skills/$slug"

    cat > "$outdir/skills/$slug/SKILL.md" <<HEREDOC
---
name: ${slug}
description: ${description}
---
${body}
$(get_context_block)
HEREDOC
    (( count++ )) || true
  done

  # Skills → skills
  for d in "$PLUGIN_DIR"/skills/*/; do
    [[ -f "$d/SKILL.md" ]] || continue
    local name description body slug
    name="$(get_field "name" "$d/SKILL.md")"
    description="$(get_field "description" "$d/SKILL.md")"
    body="$(get_body "$d/SKILL.md" | adapt_body)"
    slug="kolshek-${name}"
    mkdir -p "$outdir/skills/$slug"

    cat > "$outdir/skills/$slug/SKILL.md" <<HEREDOC
---
name: ${slug}
description: ${description}
---
${body}
$(get_context_block)
HEREDOC
    (( count++ )) || true
  done

  info "Gemini CLI: $count skills + manifest -> $outdir"
}

# --- Converter: Antigravity (skills in ~/.gemini/antigravity/skills/) ---
convert_antigravity() {
  local outdir="$OUT_DIR/antigravity"
  mkdir -p "$outdir"
  local count=0
  local today
  today="$(date +%Y-%m-%d)"

  # Agent → skill
  for f in "$PLUGIN_DIR"/agents/*.md; do
    [[ -f "$f" ]] || continue
    local name description body slug
    name="$(get_field "name" "$f")"
    description="$(get_field "description" "$f")"
    body="$(get_body "$f" | adapt_body)"
    slug="kolshek-${name}"
    mkdir -p "$outdir/$slug"

    cat > "$outdir/$slug/SKILL.md" <<HEREDOC
---
name: ${slug}
description: ${description}
risk: low
source: community
date_added: '${today}'
---
${body}
$(get_context_block)
HEREDOC
    (( count++ )) || true
  done

  # Skills → skills
  for d in "$PLUGIN_DIR"/skills/*/; do
    [[ -f "$d/SKILL.md" ]] || continue
    local name description body slug
    name="$(get_field "name" "$d/SKILL.md")"
    description="$(get_field "description" "$d/SKILL.md")"
    body="$(get_body "$d/SKILL.md" | adapt_body)"
    slug="kolshek-${name}"
    mkdir -p "$outdir/$slug"

    cat > "$outdir/$slug/SKILL.md" <<HEREDOC
---
name: ${slug}
description: ${description}
risk: low
source: community
date_added: '${today}'
---
${body}
$(get_context_block)
HEREDOC
    (( count++ )) || true
  done

  info "Antigravity: $count skills -> $outdir"
}

# --- Converter: OpenCode (.opencode/agent/*.md) ---
convert_opencode() {
  local outdir="$OUT_DIR/opencode/agent"
  mkdir -p "$outdir"
  local count=0

  # Agent → agent file
  for f in "$PLUGIN_DIR"/agents/*.md; do
    [[ -f "$f" ]] || continue
    local name description color body slug
    name="$(get_field "name" "$f")"
    description="$(get_field "description" "$f")"
    color="$(get_field "color" "$f")"
    body="$(get_body "$f" | adapt_body)"
    slug="kolshek-${name}"

    cat > "$outdir/${slug}.md" <<HEREDOC
---
name: KolShek ${name}
description: ${description}
color: ${color:-green}
---
${body}
$(get_context_block)
HEREDOC
    (( count++ )) || true
  done

  # Skills → agent files (OpenCode doesn't have skills, map to agents)
  for d in "$PLUGIN_DIR"/skills/*/; do
    [[ -f "$d/SKILL.md" ]] || continue
    local name description body slug
    name="$(get_field "name" "$d/SKILL.md")"
    description="$(get_field "description" "$d/SKILL.md")"
    body="$(get_body "$d/SKILL.md" | adapt_body)"
    slug="kolshek-${name}"

    cat > "$outdir/${slug}.md" <<HEREDOC
---
name: KolShek ${name}
description: ${description}
color: green
---
${body}
$(get_context_block)
HEREDOC
    (( count++ )) || true
  done

  info "OpenCode: $count agents -> $outdir"
}

# --- Converter: Aider (single CONVENTIONS.md) ---
convert_aider() {
  local outfile="$OUT_DIR/aider/CONVENTIONS.md"
  mkdir -p "$OUT_DIR/aider"

  cat > "$outfile" <<'HEREDOC'
# KolShek — Israeli Finance CLI Conventions
#
# This file provides Aider with KolShek's agent personalities and skill
# workflows. Reference them by name in your session.
#
# Generated by plugin/scripts/convert.sh — do not edit manually.

HEREDOC

  # Inline CONTEXT.md first
  if [[ -f "$PLUGIN_DIR/CONTEXT.md" ]]; then
    cat "$PLUGIN_DIR/CONTEXT.md" >> "$outfile"
    echo "" >> "$outfile"
    echo "---" >> "$outfile"
    echo "" >> "$outfile"
  fi

  # Agent
  for f in "$PLUGIN_DIR"/agents/*.md; do
    [[ -f "$f" ]] || continue
    local name description body
    name="$(get_field "name" "$f")"
    description="$(get_field "description" "$f")"
    body="$(get_body "$f" | adapt_body)"

    cat >> "$outfile" <<HEREDOC

## Agent: KolShek ${name}

> ${description}

${body}

---

HEREDOC
  done

  # Skills
  for d in "$PLUGIN_DIR"/skills/*/; do
    [[ -f "$d/SKILL.md" ]] || continue
    local name description body
    name="$(get_field "name" "$d/SKILL.md")"
    description="$(get_field "description" "$d/SKILL.md")"
    body="$(get_body "$d/SKILL.md" | adapt_body)"

    cat >> "$outfile" <<HEREDOC

## Skill: kolshek:${name}

> ${description}

${body}

---

HEREDOC
  done

  info "Aider: CONVENTIONS.md -> $outfile"
}

# --- Converter: Windsurf (single .windsurfrules) ---
convert_windsurf() {
  local outfile="$OUT_DIR/windsurf/.windsurfrules"
  mkdir -p "$OUT_DIR/windsurf"

  cat > "$outfile" <<'HEREDOC'
# KolShek — Israeli Finance CLI Rules for Windsurf
#
# Agent personalities and skill workflows for KolShek.
# Reference them by name in your Windsurf conversation.
#
# Generated by plugin/scripts/convert.sh — do not edit manually.

HEREDOC

  # Inline CONTEXT.md first
  if [[ -f "$PLUGIN_DIR/CONTEXT.md" ]]; then
    cat "$PLUGIN_DIR/CONTEXT.md" >> "$outfile"
    echo "" >> "$outfile"
    echo "================================================================================" >> "$outfile"
    echo "" >> "$outfile"
  fi

  # Agent
  for f in "$PLUGIN_DIR"/agents/*.md; do
    [[ -f "$f" ]] || continue
    local name description body
    name="$(get_field "name" "$f")"
    description="$(get_field "description" "$f")"
    body="$(get_body "$f" | adapt_body)"

    cat >> "$outfile" <<HEREDOC
================================================================================
## Agent: KolShek ${name}
${description}
================================================================================

${body}

HEREDOC
  done

  # Skills
  for d in "$PLUGIN_DIR"/skills/*/; do
    [[ -f "$d/SKILL.md" ]] || continue
    local name description body
    name="$(get_field "name" "$d/SKILL.md")"
    description="$(get_field "description" "$d/SKILL.md")"
    body="$(get_body "$d/SKILL.md" | adapt_body)"

    cat >> "$outfile" <<HEREDOC
================================================================================
## Skill: kolshek:${name}
${description}
================================================================================

${body}

HEREDOC
  done

  info "Windsurf: .windsurfrules -> $outfile"
}

# --- Entry point ---
main() {
  local tool="all"

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --tool) tool="${2:?'--tool requires a value'}"; shift 2 ;;
      --help|-h) usage ;;
      *) error "Unknown option: $1"; usage ;;
    esac
  done

  local valid_tools=("cursor" "gemini-cli" "antigravity" "opencode" "aider" "windsurf" "all")
  local valid=false
  for t in "${valid_tools[@]}"; do [[ "$t" == "$tool" ]] && valid=true && break; done
  if ! $valid; then
    error "Unknown tool '$tool'. Valid: ${valid_tools[*]}"
    exit 1
  fi

  header "KolShek -- Converting plugin to tool-specific formats"
  echo "  Plugin: $PLUGIN_DIR"
  echo "  Output: $OUT_DIR"
  echo "  Tool:   $tool"

  local tools_to_run=()
  if [[ "$tool" == "all" ]]; then
    tools_to_run=("cursor" "gemini-cli" "antigravity" "opencode" "aider" "windsurf")
  else
    tools_to_run=("$tool")
  fi

  for t in "${tools_to_run[@]}"; do
    header "Converting: $t"
    case "$t" in
      cursor)      convert_cursor      ;;
      gemini-cli)  convert_gemini_cli  ;;
      antigravity) convert_antigravity ;;
      opencode)    convert_opencode    ;;
      aider)       convert_aider       ;;
      windsurf)    convert_windsurf    ;;
    esac
  done

  echo ""
  info "Done. Output in $OUT_DIR"
}

main "$@"
