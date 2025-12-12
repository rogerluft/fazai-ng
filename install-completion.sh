#!/usr/bin/env bash
#
# FazAI Bash Completion Installer
# Instala o arquivo de completion em /etc/bash_completion.d/
#

set -e

COMPLETION_FILE="completion/fazai-completion.bash"
TARGET="/etc/bash_completion.d/fazai"

echo "🔧 FazAI Bash Completion Installer"
echo ""

# Check if completion file exists
if [[ ! -f "$COMPLETION_FILE" ]]; then
    echo "❌ Error: $COMPLETION_FILE not found"
    echo "   Run this script from the fazai-ng root directory"
    exit 1
fi

# Install to /etc/bash_completion.d/
echo "📦 Installing bash completion..."
sudo cp "$COMPLETION_FILE" "$TARGET"
sudo chmod 644 "$TARGET"

echo "✅ Bash completion installed to $TARGET"
echo ""
echo "📝 To activate completion in current shell, run:"
echo "   source $TARGET"
echo ""
echo "Or restart your shell / open a new terminal"
echo ""
