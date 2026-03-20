#!/bin/sh
# KolShek installer for macOS and Linux
# Usage: curl -fsSL https://kolshek.com/install.sh | sh
# Uninstall: curl -fsSL https://kolshek.com/install.sh | sh -s -- --uninstall
#
# Environment variables:
#   KOLSHEK_INSTALL_DIR  Override install location (default: ~/.local/bin)
#   KOLSHEK_VERSION      Install a specific version (default: latest)
set -eu

REPO="DaveDushi/kolshek"
DEFAULT_INSTALL_DIR="$HOME/.local/bin"
INSTALL_DIR="${KOLSHEK_INSTALL_DIR:-$DEFAULT_INSTALL_DIR}"
VERSION="${KOLSHEK_VERSION:-}"
BINARY_PATH="$INSTALL_DIR/kolshek"

# --- Colors (only if stdout is a terminal) ---

if [ -t 1 ]; then
  BOLD='\033[1m'
  GREEN='\033[32m'
  RED='\033[31m'
  YELLOW='\033[33m'
  CYAN='\033[36m'
  RESET='\033[0m'
else
  BOLD='' GREEN='' RED='' YELLOW='' CYAN='' RESET=''
fi

info()    { printf "${CYAN}info${RESET}  %s\n" "$1"; }
success() { printf "${GREEN}done${RESET}  %s\n" "$1"; }
warn()    { printf "${YELLOW}warn${RESET}  %s\n" "$1"; }
error()   { printf "${RED}error${RESET} %s\n" "$1" >&2; }

# --- Uninstall ---

if [ "${1:-}" = "--uninstall" ]; then
  if [ -f "$BINARY_PATH" ]; then
    rm -f "$BINARY_PATH"
    success "Removed $BINARY_PATH"
  else
    warn "kolshek not found at $BINARY_PATH"
  fi
  printf "\n"
  info "If you added ~/.local/bin to your PATH via your shell profile,"
  info "you can remove the line containing '# Added by kolshek installer'."
  info "To remove data: rm -rf ~/.local/share/kolshek ~/.config/kolshek ~/.cache/kolshek"
  exit 0
fi

# --- Prerequisites ---

DOWNLOAD_CMD=""
if command -v curl >/dev/null 2>&1; then
  DOWNLOAD_CMD="curl"
elif command -v wget >/dev/null 2>&1; then
  DOWNLOAD_CMD="wget"
else
  error "curl or wget is required but neither was found."
  info "Install curl: https://curl.se/download.html"
  exit 1
fi

CHECKSUM_CMD=""
if command -v sha256sum >/dev/null 2>&1; then
  CHECKSUM_CMD="sha256sum"
elif command -v shasum >/dev/null 2>&1; then
  CHECKSUM_CMD="shasum"
fi

# --- Download helper ---

download() {
  url="$1"
  output="$2"
  if [ "$DOWNLOAD_CMD" = "curl" ]; then
    curl -fsSL --retry 3 -o "$output" "$url"
  else
    wget -qO "$output" "$url"
  fi
}

download_text() {
  url="$1"
  if [ "$DOWNLOAD_CMD" = "curl" ]; then
    curl -fsSL --retry 3 "$url"
  else
    wget -qO- "$url"
  fi
}

# --- Platform detection ---

OS="$(uname -s)"
ARCH="$(uname -m)"

case "$OS" in
  Darwin)  PLATFORM="macos"  ;;
  Linux)   PLATFORM="linux"  ;;
  *)
    error "Unsupported operating system: $OS"
    info "KolShek supports macOS and Linux. For Windows, use PowerShell:"
    info "  irm https://kolshek.com/install.ps1 | iex"
    exit 1
    ;;
esac

case "$ARCH" in
  x86_64|amd64)   ARCH_NAME="x64"  ;;
  aarch64|arm64)   ARCH_NAME="arm64" ;;
  *)
    error "Unsupported architecture: $ARCH"
    info "KolShek supports x64 and arm64."
    exit 1
    ;;
esac

BINARY_NAME="kolshek-${PLATFORM}-${ARCH_NAME}"
info "Detected platform: ${PLATFORM}-${ARCH_NAME}"

# --- Determine version ---

if [ -n "$VERSION" ]; then
  # Ensure the tag has a v prefix
  case "$VERSION" in
    v*) TAG="$VERSION" ;;
    *)  TAG="v$VERSION" ;;
  esac
  info "Installing version: $TAG"
else
  info "Fetching latest release..."
  RELEASE_JSON="$(download_text "https://api.github.com/repos/$REPO/releases/latest" 2>&1)" || {
    error "Failed to fetch release info from GitHub."
    info "You may be rate-limited. Try setting GITHUB_TOKEN or download manually:"
    info "  https://github.com/$REPO/releases"
    exit 1
  }
  TAG="$(printf '%s' "$RELEASE_JSON" | grep '"tag_name"' | head -1 | sed -E 's/.*"tag_name"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/')"
  if [ -z "$TAG" ]; then
    error "Could not determine latest version from GitHub API."
    info "Download manually: https://github.com/$REPO/releases"
    exit 1
  fi
  info "Latest version: $TAG"
fi

# --- Download binary ---

DOWNLOAD_URL="https://github.com/$REPO/releases/download/$TAG/$BINARY_NAME"
TMPDIR="$(mktemp -d)"
trap 'rm -rf "$TMPDIR"' EXIT

info "Downloading $BINARY_NAME..."
download "$DOWNLOAD_URL" "$TMPDIR/$BINARY_NAME" || {
  error "Failed to download $BINARY_NAME"
  info "URL: $DOWNLOAD_URL"
  info "Check that this version and platform exist at:"
  info "  https://github.com/$REPO/releases/tag/$TAG"
  exit 1
}

# --- Verify checksum ---

CHECKSUM_URL="${DOWNLOAD_URL}.sha256"
if download "$CHECKSUM_URL" "$TMPDIR/checksum.sha256" 2>&1; then
  if [ -n "$CHECKSUM_CMD" ]; then
    EXPECTED="$(cut -d' ' -f1 < "$TMPDIR/checksum.sha256")"
    if [ "$CHECKSUM_CMD" = "sha256sum" ]; then
      ACTUAL="$(sha256sum "$TMPDIR/$BINARY_NAME" | cut -d' ' -f1)"
    else
      ACTUAL="$(shasum -a 256 "$TMPDIR/$BINARY_NAME" | cut -d' ' -f1)"
    fi
    if [ "$EXPECTED" != "$ACTUAL" ]; then
      error "SECURITY: Checksum verification failed!"
      error "  Expected: $EXPECTED"
      error "  Actual:   $ACTUAL"
      error "The downloaded binary may have been tampered with. Aborting."
      exit 1
    fi
    success "Checksum verified"
  else
    warn "No sha256sum or shasum found — skipping checksum verification."
  fi
else
  warn "No checksum file available for this release. Skipping verification."
fi

# --- Install binary ---

mkdir -p "$INSTALL_DIR"
mv "$TMPDIR/$BINARY_NAME" "$BINARY_PATH"
chmod +x "$BINARY_PATH"

# Remove macOS quarantine attribute so Gatekeeper doesn't block the unsigned binary
if [ "$PLATFORM" = "macos" ]; then
  xattr -d com.apple.quarantine "$BINARY_PATH" 2>/dev/null || true
fi

success "Installed to $BINARY_PATH"

# --- PATH management ---

add_to_path() {
  profile_file="$1"
  export_line="$2"

  if [ ! -f "$profile_file" ]; then
    # Create the file if it doesn't exist
    touch "$profile_file"
  fi

  # Check if we already added our line
  if grep -q "# Added by kolshek installer" "$profile_file" 2>/dev/null; then
    return 0
  fi

  printf '\n%s\n' "$export_line" >> "$profile_file"
  info "Added PATH entry to $profile_file"
}

case ":$PATH:" in
  *":$INSTALL_DIR:"*)
    # Already on PATH
    ;;
  *)
    SHELL_NAME="$(basename "${SHELL:-/bin/sh}")"
    case "$SHELL_NAME" in
      zsh)
        add_to_path "$HOME/.zshrc" "export PATH=\"$INSTALL_DIR:\$PATH\"  # Added by kolshek installer"
        ;;
      bash)
        if [ "$PLATFORM" = "macos" ]; then
          # macOS: bash reads .bash_profile for login shells
          BASH_PROFILE="$HOME/.bash_profile"
          if [ ! -f "$BASH_PROFILE" ] && [ -f "$HOME/.bashrc" ]; then
            BASH_PROFILE="$HOME/.bashrc"
          fi
          add_to_path "$BASH_PROFILE" "export PATH=\"$INSTALL_DIR:\$PATH\"  # Added by kolshek installer"
        else
          add_to_path "$HOME/.bashrc" "export PATH=\"$INSTALL_DIR:\$PATH\"  # Added by kolshek installer"
        fi
        ;;
      fish)
        FISH_CONFIG="$HOME/.config/fish/config.fish"
        mkdir -p "$(dirname "$FISH_CONFIG")"
        add_to_path "$FISH_CONFIG" "fish_add_path $INSTALL_DIR  # Added by kolshek installer"
        ;;
      *)
        add_to_path "$HOME/.profile" "export PATH=\"$INSTALL_DIR:\$PATH\"  # Added by kolshek installer"
        ;;
    esac
    ;;
esac

# --- Success ---

DISPLAY_VERSION="$(echo "$TAG" | sed 's/^v//')"
printf "\n"
printf "  ${BOLD}KolShek ${GREEN}v%s${RESET} installed successfully!\n" "$DISPLAY_VERSION"
printf "\n"
printf "  Get started:\n"
printf "    ${CYAN}kolshek init${RESET}     Set up your first bank or credit card\n"
printf "\n"

# Check if the binary is available in current PATH
if ! command -v kolshek >/dev/null 2>&1; then
  printf "  ${YELLOW}Restart your terminal${RESET} for PATH changes to take effect, or run:\n"
  printf "    export PATH=\"%s:\$PATH\"\n" "$INSTALL_DIR"
  printf "\n"
fi
