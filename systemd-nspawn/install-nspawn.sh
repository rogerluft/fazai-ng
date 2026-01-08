#!/bin/bash
# FazAI-OS: Instalador de ambiente nspawn no Fedora Host

MACHINE_NAME="fazai-os"
MACHINE_PATH="/var/lib/machines/$MACHINE_NAME"

if [ "$EUID" -ne 0 ]; then
  echo "Por favor, execute como root."
  exit 1
fi

echo "🚀 Preparando base Fedora para o FazAI-OS..."
mkdir -p "$MACHINE_PATH"

# Instala base minima
dnf --installroot="$MACHINE_PATH" --releasever=41 install -y @core dnf systemd dbus python3 nodejs-npm

echo "📦 Instalando dependencias agenticas dentro da maquina..."
systemd-nspawn -D "$MACHINE_PATH" /usr/bin/dnf install -y tar curl git procps-ng

echo "✅ Base instalada em $MACHINE_PATH"
echo "Para iniciar: sudo systemd-nspawn -bD $MACHINE_PATH"
