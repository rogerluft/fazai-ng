#!/bin/bash
# consolidate-fazai.sh: A tool to find and remove redundant `fazai` executables,
# ensuring a single, canonical installation is used system-wide.

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
    info "--- Fazai Executable Consolidation Tool ---"

    # Define the one true source of the installation
    local canonical_dir="/opt/fazai"
    local canonical_executable="${canonical_dir}/bin/fazai"
    local canonical_symlink="/usr/local/bin/fazai"

    echo
    info "The goal is to have a single system-wide command: "
    info "'${canonical_symlink}' pointing to '${canonical_executable}'"
    echo

    if [[ ! -f "$canonical_executable" ]]; then
        fail "Canonical executable not found at '${canonical_executable}'. Please run the main installer first."
    fi

    # List of known redundant paths based on our search
    local redundant_paths=(
        "/usr/local/sbin/fazai"
        "/root/.local/bin/fazai"
        "/home/rluft/.fazai/bin/fazai"
        "/home/rluft/.fazai/fazai"
        "/home/rluft/fazai-ng/fazai" # The script referenced as @fazai
    )
    
    info "Searching for redundant executables to remove..."
    local found_redundancy=0
    for path in "${redundant_paths[@]}"; do
        if [ -e "$path" ]; then
            found_redundancy=1
            warn "Found redundant item: ${path}"
            if confirm "Do you want to remove this item?"; then
                if sudo rm -f "$path"; then
                    success "Removed ${path}."
                else
                    warn "Could not remove ${path}. Check permissions."
                fi
            else
                warn "Skipping removal of ${path}."
            fi
        fi
    done

    if [ "$found_redundancy" -eq 0 ]; then
        info "No known redundant executables found in standard locations."
    fi
    echo

    info "Now, verifying the primary symlink in your PATH..."
    
    if [ -e "$canonical_symlink" ]; then
        if [ -L "$canonical_symlink" ] && [ "$(readlink -f "$canonical_symlink")" == "$canonical_executable" ]; then
            success "Symlink at '${canonical_symlink}' is already correct."
        else
            warn "Item at '${canonical_symlink}' is incorrect (not a symlink or points to wrong target)."
            if confirm "Correct it to point to '${canonical_executable}'?"; then
                sudo rm -f "$canonical_symlink"
                if sudo ln -s "$canonical_executable" "$canonical_symlink"; then
                    success "Symlink corrected."
                else
                    fail "Failed to create correct symlink."
                fi
            fi
        fi
    else
        warn "Canonical symlink '${canonical_symlink}' does not exist."
        if confirm "Create it now?"; then
            if sudo ln -s "$canonical_executable" "$canonical_symlink"; then
                success "Symlink created."
            else
                fail "Failed to create symlink."
            fi
        fi
    fi
    echo

    info "Verifying which 'fazai' is found in PATH..."
    local final_path
    final_path=$(which fazai)

    if [ "$final_path" == "$canonical_symlink" ]; then
        success "Your shell will now use the correct executable: ${final_path} -> $(readlink -f "$final_path")"
    else
        warn "A different 'fazai' is still being found first in your PATH: ${final_path}"
        warn "Please check your shell's PATH environment variable or remove other executables manually."
    fi

    echo
    success "--- Consolidation process complete ---"
}

# --- Script Execution ---
if [ "$(whoami)" != "root" ]; then
    fail "This script requires root privileges for some operations. Please run with 'sudo'."
fi

main
