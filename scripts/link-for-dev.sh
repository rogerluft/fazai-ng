#!/bin/bash
# link-for-dev.sh: Sets up a development environment by symlinking the
# local repository to the global /opt/fazai installation path.

# --- Helper Functions ---
readonly C_RESET='\033[0m'
readonly C_RED='\033[0;31m'
readonly C_GREEN='\033[0;32m'
readonly C_YELLOW='\033[0;33m'
readonly C_BLUE='\033[0;34m'
readonly C_CYAN='\033[0;36m'

info() {
    echo -e "${C_BLUE}INFO: $1${C_RESET}"
}

success() {
    echo -e "${C_GREEN}SUCCESS: $1${C_RESET}"
}

warn() {
    echo -e "${C_YELLOW}WARN: $1${C_RESET}"
}

fail() {
    echo -e "${C_RED}ERROR: $1${C_RESET}"
    exit 1
}

confirm() {
    local prompt="$1"
    while true; do
        read -p "$(echo -e "${C_YELLOW}CONFIRM: ${prompt} [y/n] ${C_RESET}")" yn
        case $yn in
            [Yy]* ) return 0;;
            [Nn]* ) return 1;;
            * ) echo "Please answer yes (y) or no (n).";;
        esac
    done
}

# --- Main Logic ---

main() {
    info "--- Fazai Development Linker ---"
    
    if [ "$(whoami)" != "root" ]; then
        fail "This script requires root privileges to manage /opt/fazai. Please run with 'sudo'."
    fi

    # Auto-detect the source repository path
    local source_repo_path
    SOURCE="${BASH_SOURCE[0]}"
    while [ -h "$SOURCE" ]; do
      DIR="$( cd -P "$( dirname "$SOURCE" )" >/dev/null 2>&1 && pwd )"
      SOURCE="$(readlink "$SOURCE")"
      [[ $SOURCE != /* ]] && SOURCE="$DIR/$SOURCE"
    done
    SCRIPT_DIR="$( cd -P "$( dirname "$SOURCE" )" >/dev/null 2>&1 && pwd )"
    source_repo_path="$(cd "${SCRIPT_DIR}/.." && pwd)"

    local install_path="/opt/fazai"

    echo
    info "This will link your local dev repo to the global installation."
    info "Source: ${source_repo_path}"
    info "Target: ${install_path}"
    echo

    if ! confirm "Proceed with linking?"; then
        warn "Operation cancelled."
        exit 0
    fi

    # 1. Clean up existing installation at /opt/fazai
    info "Checking for existing installation at ${install_path}..."
    if [ -d "$install_path" ] || [ -f "$install_path" ]; then
        if confirm "'${install_path}' already exists. It will be removed and replaced with symlinks. Continue?"; then
            sudo rm -rf "$install_path" || fail "Could not remove existing directory at ${install_path}."
            success "Removed existing ${install_path}."
        else
            warn "Cleanup cancelled. Cannot proceed."
            exit 0
        fi
    fi

    # 2. Create the base directory
    info "Creating base directory at ${install_path}..."
    sudo mkdir -p "$install_path" || fail "Could not create directory at ${install_path}."

    # 3. Symlink essential repository items
    local items_to_link=(
        "bin"
        "dist"
        "web"
        "etc"
        "completion"
        "node_modules"
        "package.json"
        "package-lock.json"
        "fazai.conf.example"
    )

    info "Creating symlinks from '${source_repo_path}' to '${install_path}'..."
    for item in "${items_to_link[@]}"; do
        local source_item="${source_repo_path}/${item}"
        local target_item="${install_path}/${item}"
        if [ -e "$source_item" ]; then
            if sudo ln -s "$source_item" "$target_item"; then
                info "  ✓ Linked ${item}"
            else
                warn "  ✗ Failed to link ${item}"
            fi
        else
            warn "  ✗ Source item '${source_item}' not found. Skipping."
        fi
    done

    # 4. Ensure the main executable entry point is correct
    local canonical_executable="${install_path}/bin/fazai"
    local canonical_symlink="/usr/local/bin/fazai"
    info "Verifying system-wide entry point: ${canonical_symlink}..."

    if sudo ln -sf "$canonical_executable" "$canonical_symlink"; then
        success "System-wide command '${canonical_symlink}' is correctly linked."
    else
        fail "Failed to create the main symlink at '${canonical_symlink}'."
    fi

    echo
    success "--- Development Environment Linked ---"
    info "Any changes in '${source_repo_path}' (after a build) will now be reflected in the global 'fazai' command."
    info "The 'fazai sync' command is no longer needed for this workflow."
}

main "$@"
