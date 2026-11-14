#!/bin/bash

# Configuracoes
CONFIG_DIR="$HOME/Library/Application Support/AnyDesk"
LAST_RESET="$HOME/Library/Caches/anydesk_last_reset"
COOLDOWN=10
LOG_FILE="$HOME/Library/Logs/anydesk_monitor.log"

log() {
    local msg="$1"
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $msg" | tee -a "$LOG_FILE"
}

notify() {
    local msg="$1"
    osascript -e "display notification \"$msg\" with title \"AnyDesk Monitor\""
}

stop_anydesk() {
    log "Parando AnyDesk..."
    pkill -f AnyDesk 2>/dev/null
    sleep 2
}

start_anydesk() {
    log "Iniciando AnyDesk..."
    if [ -d "/Applications/AnyDesk.app" ]; then
        open "/Applications/AnyDesk.app"
    else
        open -a AnyDesk 2>/dev/null
    fi
}

detect_commercial() {
    local trace_file="$CONFIG_DIR/connection_trace.txt"
    if [ -f "$trace_file" ]; then
        if tail -100 "$trace_file" 2>/dev/null | grep -qiE "commercial|time.limit|blocked|SESSION_BLOCKED|license.limit|licen"; then
            return 0
        fi
    fi
    for f in "$CONFIG_DIR"/*.trace 2>/dev/null; do
        [ -f "$f" ] || continue
        if tail -50 "$f" 2>/dev/null | grep -qiE "commercial|blocked|limit|licen"; then
            return 0
        fi
    done
    return 1
}

should_reset() {
    [ ! -f "$LAST_RESET" ] && return 0
    local last=$(cat "$LAST_RESET")
    local now=$(date +%s)
    local diff=$(( (now - last) / 60 ))
    [ "$diff" -ge "$COOLDOWN" ]
}

reset_anydesk() {
    notify "AnyDesk vai ser reiniciado para renovar a licenca. Aguarde..."
    log "Iniciando reset..."

    stop_anydesk

    mkdir -p /tmp/anydesk_backup
    [ -f "$CONFIG_DIR/user.conf" ] && cp "$CONFIG_DIR/user.conf" /tmp/anydesk_backup/
    [ -d "$CONFIG_DIR/thumbnails" ] && cp -r "$CONFIG_DIR/thumbnails" /tmp/anydesk_backup/

    rm -f "$CONFIG_DIR/service.conf" 2>/dev/null
    rm -f "$CONFIG_DIR/connection_trace.txt" 2>/dev/null
    rm -f "$CONFIG_DIR"/*.trace 2>/dev/null
    rm -rf "$CONFIG_DIR"/* 2>/dev/null

    start_anydesk
    sleep 3

    for i in $(seq 1 20); do
        if grep -q "ad.anynet.id=" "$CONFIG_DIR/system.conf" 2>/dev/null; then
            break
        fi
        sleep 1
    done

    stop_anydesk

    mkdir -p "$CONFIG_DIR/thumbnails"
    [ -f /tmp/anydesk_backup/user.conf ] && cp /tmp/anydesk_backup/user.conf "$CONFIG_DIR/user.conf"
    [ -d /tmp/anydesk_backup/thumbnails ] && cp -r /tmp/anydesk_backup/thumbnails/* "$CONFIG_DIR/thumbnails/" 2>/dev/null
    rm -rf /tmp/anydesk_backup

    start_anydesk
    date +%s > "$LAST_RESET"
    log "Reset concluido"
    notify "AnyDesk renovado com sucesso! Pronto para usar."
}

log "Monitor AnyDesk iniciado"

while true; do
    if detect_commercial; then
        log "Comercial detectado!"
        if should_reset; then
            reset_anydesk
        else
            log "Cooldown de $COOLDOWN min"
        fi
    fi
    sleep 15
done
