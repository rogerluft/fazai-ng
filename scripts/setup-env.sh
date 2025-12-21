#!/bin/bash
# setup-env.sh: Configures system-wide alias and environment variables for Fazai.

# --- Helper Functions ---
# Color definitions for better output
readonly C_RESET='\033[0m'
readonly C_GREEN='\033[0;32m'
readonly C_YELLOW='\033[0;33m'
readonly C_BLUE='\033[0;34m'

info() {
    echo -e "${C_BLUE}INFO: $1${C_RESET}"
}

success() {
    echo -e "${C_GREEN}SUCCESS: $1${C_RESET}"
}

warn() {
    echo -e "${C_YELLOW}WARN: $1${C_RESET}"
}

# --- Main Logic ---

# Automatically detect the absolute path of the repository
# This works by finding the script's own directory and going up one level.
info "Detecting Fazai repository path..."
# Dereference symlink if the script is called through one
SOURCE="${BASH_SOURCE[0]}"
while [ -h "$SOURCE" ]; do
  DIR="$( cd -P "$( dirname "$SOURCE" )" >/dev/null 2>&1 && pwd )"
  SOURCE="$(readlink "$SOURCE")"
  [[ $SOURCE != /* ]] && SOURCE="$DIR/$SOURCE"
done
SCRIPT_DIR="$( cd -P "$( dirname "$SOURCE" )" >/dev/null 2>&1 && pwd )"
FAZAI_REPO_PATH="$(cd "${SCRIPT_DIR}/.." && pwd)"
success "Fazai repository found at: ${FAZAI_REPO_PATH}"

# --- Alias and Environment Variable Setup ---

# Function to add configuration to a shell profile file
# $1: file path (e.g., ~/.bashrc)
# $2: line to check for
# $3: line to add
add_to_profile() {
    local profile_file="$1"
    local check_line="$2"
    local add_line="$3"

    if [ -f "$profile_file" ]; then
        if grep -q "$check_line" "$profile_file"; then
            info "Configuration already exists in ${profile_file}. Skipping."
        else
            info "Adding configuration to ${profile_file}..."
            echo "" >> "$profile_file"
            echo "# Added by Fazai setup" >> "$profile_file"
            echo "$add_line" >> "$profile_file"
            success "Configuration added to ${profile_file}."
        fi
    else
        warn "${profile_file} not found. Skipping."
    fi
}

# Add alias 'repo' for common shells
info "Checking for 'repo' alias..."
add_to_profile "$HOME/.bashrc" "alias repo=" "alias repo='cd ${FAZAI_REPO_PATH}'"
add_to_profile "$HOME/.zshrc" "alias repo=" "alias repo='cd ${FAZAI_REPO_PATH}'"

# --- Dev Command Link (Fix: Immediate Execution) ---
info "Linking 'fazai' command for immediate development use..."
TARGET_BIN="/usr/local/bin/fazai"
SOURCE_BIN="${FAZAI_REPO_PATH}/bin/fazai"

if [ -f "$SOURCE_BIN" ]; then
    # Make executable
    chmod +x "$SOURCE_BIN"
    
    # Create symlink
    if [ -L "$TARGET_BIN" ] && [ "$(readlink "$TARGET_BIN")" == "$SOURCE_BIN" ]; then
        info "Symlink $TARGET_BIN already points to repo. Skipping."
    else
        info "Creating symlink: $TARGET_BIN -> $SOURCE_BIN"
        sudo ln -sf "$SOURCE_BIN" "$TARGET_BIN"
        if [ $? -eq 0 ]; then
            success "Command 'fazai' linked! You can run it immediately."
        else
            warn "Failed to link 'fazai' to /usr/local/bin. Sudo required."
        fi
    fi
else
    warn "Source binary not found at $SOURCE_BIN"
fi

info "Alias check complete."

# Add global environment variable FAZAI_REPO
info "Checking for FAZAI_REPO environment variable..."
PROFILE_D_FILE="/etc/profile.d/fazai.sh"
if [ -f "$PROFILE_D_FILE" ] && grep -q "export FAZAI_REPO=" "$PROFILE_D_FILE"; then
    info "FAZAI_REPO variable already set in ${PROFILE_D_FILE}. Skipping."
else
    info "Setting global FAZAI_REPO variable in ${PROFILE_D_FILE}..."
    # This requires sudo privileges
    echo "# Added by Fazai setup to define the repository location" | sudo tee "$PROFILE_D_FILE" > /dev/null
    echo "export FAZAI_REPO=\"${FAZAI_REPO_PATH}\"" | sudo tee -a "$PROFILE_D_FILE" > /dev/null
    if [ $? -eq 0 ]; then
        success "FAZAI_REPO set successfully. It will be available in new shell sessions."
    else
        warn "Could not set global FAZAI_REPO variable. Sudo privileges might be required."
    fi
fi


# --- Permissions Adjustment ---

info "Checking for Fazai log files in /var/log/..."
if ls /var/log/fazai* 1> /dev/null 2>&1; then
    info "Fazai log files found. Adjusting permissions..."
    # Note: 777 permissions are highly permissive. This is done as per user request.
    sudo chmod -R 777 /var/log/fazai*
    if [ $? -eq 0 ]; then
        success "Permissions for /var/log/fazai* set to 777."
    else
        warn "Could not set permissions for Fazai log files. Sudo privileges might be required."
    fi
else
    info "No Fazai log files found in /var/log/. Skipping permission adjustment."
fi

success "Environment setup check complete."
