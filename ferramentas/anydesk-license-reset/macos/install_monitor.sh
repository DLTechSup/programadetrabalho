#!/bin/bash

# Instala o monitor AnyDesk para iniciar automaticamente no macOS via LaunchAgent

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MONITOR_SCRIPT="$SCRIPT_DIR/monitor_anydesk.sh"
PLIST_LABEL="com.user.anydesk-license-monitor"
PLIST_PATH="$HOME/Library/LaunchAgents/$PLIST_LABEL.plist"

if [ ! -f "$MONITOR_SCRIPT" ]; then
    echo "ERRO: monitor_anydesk.sh nao encontrado em $MONITOR_SCRIPT"
    exit 1
fi

chmod +x "$MONITOR_SCRIPT"

mkdir -p "$HOME/Library/LaunchAgents"

cat > "$PLIST_PATH" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>$PLIST_LABEL</string>
    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>$MONITOR_SCRIPT</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>$HOME/Library/Logs/anydesk_monitor_launchd.log</string>
    <key>StandardErrorPath</key>
    <string>$HOME/Library/Logs/anydesk_monitor_launchd.log</string>
</dict>
</plist>
EOF

launchctl load "$PLIST_PATH"
echo "LaunchAgent instalado e iniciado!"
echo "Para verificar: launchctl list | grep $PLIST_LABEL"
echo "Para parar: launchctl unload $PLIST_PATH"
echo "Para remover: rm $PLIST_PATH && launchctl unload $PLIST_PATH"
