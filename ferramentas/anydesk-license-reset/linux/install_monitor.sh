#!/bin/bash

# Instala o monitor AnyDesk para iniciar automaticamente no Linux
# Opcoes: systemd (padrao) ou autostart

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MONITOR_SCRIPT="$SCRIPT_DIR/monitor_anydesk.sh"
SERVICE_NAME="anydesk-license-monitor"

if [ ! -f "$MONITOR_SCRIPT" ]; then
    echo "ERRO: monitor_anydesk.sh nao encontrado em $MONITOR_SCRIPT"
    exit 1
fi

chmod +x "$MONITOR_SCRIPT"

# Detecta metodo disponivel
if command -v systemctl &>/dev/null; then
    echo "Instalando como servico systemd (usuario)..."
    mkdir -p "$HOME/.config/systemd/user"

    cat > "$HOME/.config/systemd/user/$SERVICE_NAME.service" <<EOF
[Unit]
Description=AnyDesk License Monitor - Auto reset when commercial detected
After=network.target

[Service]
ExecStart=$MONITOR_SCRIPT
Restart=on-failure
RestartSec=10

[Install]
WantedBy=default.target
EOF

    systemctl --user daemon-reload
    systemctl --user enable "$SERVICE_NAME.service"
    systemctl --user start "$SERVICE_NAME.service"
    echo "Servico instalado e iniciado!"
    echo "Ver status: systemctl --user status $SERVICE_NAME.service"
    echo "Parar: systemctl --user stop $SERVICE_NAME.service"
    echo "Desabilitar: systemctl --user disable $SERVICE_NAME.service"

elif [ -d "$HOME/.config/autostart" ]; then
    echo "Instalando como autostart..."
    cat > "$HOME/.config/autostart/$SERVICE_NAME.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=AnyDesk License Monitor
Exec=$MONITOR_SCRIPT
Terminal=false
X-GNOME-Autostart-enabled=true
EOF
    chmod +x "$HOME/.config/autostart/$SERVICE_NAME.desktop"
    echo "Autostart instalado! Sera iniciado no proximo login."
else
    echo "Nenhum metodo de auto-start detectado."
    echo "Execute manualmente: $MONITOR_SCRIPT &"
    echo "Ou adicione ao ~/.bashrc: $MONITOR_SCRIPT &"
fi
