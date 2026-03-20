#!/bin/sh
# KolShek uninstaller for macOS and Linux
# Usage: curl -fsSL https://kolshek.com/uninstall.sh | sh
set -eu

DEFAULT_INSTALL_DIR="$HOME/.local/bin"
INSTALL_DIR="${KOLSHEK_INSTALL_DIR:-$DEFAULT_INSTALL_DIR}"
BINARY_PATH="$INSTALL_DIR/kolshek"

# --- Colors ---

if [ -t 1 ]; then
  GREEN='\033[32m' YELLOW='\033[33m' CYAN='\033[36m' RESET='\033[0m'
else
  GREEN='' YELLOW='' CYAN='' RESET=''
fi

info()    { printf "${CYAN}info${RESET}  %s\n" "$1"; }
success() { printf "${GREEN}done${RESET}  %s\n" "$1"; }
warn()    { printf "${YELLOW}warn${RESET}  %s\n" "$1"; }

# --- Remove binary ---

if [ -f "$BINARY_PATH" ]; then
  rm -f "$BINARY_PATH"
  success "Removed $BINARY_PATH"
else
  warn "kolshek not found at $BINARY_PATH"
fi

# --- Remove PATH entry from shell profile ---

remove_from_profile() {
  profile_file="$1"
  if [ -f "$profile_file" ] && grep -q "# Added by kolshek installer" "$profile_file" 2>/dev/null; then
    # Create a temp file without the kolshek line
    grep -v "# Added by kolshek installer" "$profile_file" > "$profile_file.tmp"
    mv "$profile_file.tmp" "$profile_file"
    success "Removed PATH entry from $profile_file"
  fi
}

remove_from_profile "$HOME/.zshrc"
remove_from_profile "$HOME/.bashrc"
remove_from_profile "$HOME/.bash_profile"
remove_from_profile "$HOME/.profile"
remove_from_profile "$HOME/.config/fish/config.fish"

# --- Done ---

printf "\n"
printf "  ${GREEN}KolShek has been uninstalled.${RESET}\n"
printf "\n"
printf "  To also remove your data:\n"
printf "    ${CYAN}rm -rf ~/.local/share/kolshek ~/.config/kolshek ~/.cache/kolshek${RESET}\n"
printf "\n"
printf "  ${YELLOW}Restart your terminal for PATH changes to take effect.${RESET}\n"
printf "\n"
