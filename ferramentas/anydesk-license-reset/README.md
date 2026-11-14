# AnyDesk License Reset

Scripts para resetar a licenca gratuita do AnyDesk quando ocorrer bloqueio por uso continuo, com monitoramento automatico em background.

## Como funciona

O AnyDesk limita o uso gratuito baseado no ID unico do dispositivo. Quando voce usa por muito tempo, ele exibe mensagens como "Commercial Use Detected" ou "Sessao finalizada devido a limitacao da licenca" e bloqueia novas conexoes.

Este conjunto de scripts:

1. **Monitora** os arquivos de log/trace do AnyDesk em busca de palavras como "commercial", "blocked", "limit"
2. **Detecta** automaticamente quando a limitacao ocorre
3. **Reseta** o ID do AnyDesk (remove o `service.conf`, força geracao de um novo ID)
4. **Restaura** suas configuracoes (favoritos, sessoes recentes)
5. **Reinicia** o AnyDesk com um ID novo — tudo em aproximadamente 10 segundos

> **Importante:** Isso nao e um crack, nem uma versao modificada do AnyDesk. O script apenas executa o reset do ID de forma automatizada, exatamente como voce faria manualmente. Ele nao desbloqueia permanentemente o AnyDesk — apenas restaura o funcionamento gratuito por mais um periodo.
>
> **Recomendacao:** Se voce usa AnyDesk com frequencia ou para fins profissionais, considere adquirir uma licenca oficial. Outra alternativa excelente e open-source e o [RustDesk](https://github.com/rustdesk/rustdesk) — voce pode montar seu proprio servidor remoto gratuito.

---

## Windows

### Requisitos
- Windows 7/10/11
- AnyDesk instalado
- Executar como administrador

### Instalacao

```powershell
# PowerShell como administrador
cd caminho\para\windows
.\install_monitor.ps1
```

Isso cria uma **Tarefa Agendada** que inicia o monitor automaticamente ao ligar o Windows.

### Remocao

```powershell
Unregister-ScheduledTask -TaskName "AnyDeskMonitorBypass" -Confirm:$false
```

---

## Linux

### Requisitos
- AnyDesk instalado
- Permissao sudo para acesso ao `/etc/anydesk`

### Instalacao via systemd (recomendado)

```bash
cd caminho/para/linux
chmod +x install_monitor.sh
./install_monitor.sh
```

O script detecta automaticamente se systemd esta disponivel e cria um servico de usuario.

### Instalacao via autostart (alternativa)

Se nao tiver systemd, o script cria uma entrada em `~/.config/autostart/` para iniciar com o ambiente grafico.

### Comandos uteis

```bash
# Ver status
systemctl --user status anydesk-license-monitor.service

# Ver logs
tail -f ~/.cache/anydesk_monitor.log

# Parar monitor
systemctl --user stop anydesk-license-monitor.service

# Desabilitar
systemctl --user disable anydesk-license-monitor.service
```

---

## macOS

### Requisitos
- macOS 10.13+
- AnyDesk instalado em `/Applications/AnyDesk.app`

### Instalacao

```bash
cd caminho/para/macos
chmod +x install_monitor.sh
./install_monitor.sh
```

O script cria um **LaunchAgent** que inicia o monitor automaticamente ao fazer login.

### Comandos uteis

```bash
# Verificar se esta rodando
launchctl list | grep anydesk-license-monitor

# Ver logs
tail -f ~/Library/Logs/anydesk_monitor.log

# Parar monitor
launchctl unload ~/Library/LaunchAgents/com.user.anydesk-license-monitor.plist

# Remover permanentemente
rm ~/Library/LaunchAgents/com.user.anydesk-license-monitor.plist
launchctl unload ~/Library/LaunchAgents/com.user.anydesk-license-monitor.plist
```

---

## Estrutura do repositorio

```
anydesk-license-reset/
├── README.md
├── windows/
│   ├── monitor_anydesk.ps1    # Monitor + reset para Windows
│   └── install_monitor.ps1    # Instala como tarefa agendada
├── linux/
│   ├── monitor_anydesk.sh     # Monitor + reset para Linux
│   └── install_monitor.sh     # Instala como servico systemd ou autostart
└── macos/
    ├── monitor_anydesk.sh     # Monitor + reset para macOS
    └── install_monitor.sh     # Instala como LaunchAgent
```

## Nota sobre uso etico

Esta ferramenta foi criada para fins de estudo e para usuarios que utilizam o AnyDesk ocasionalmente para uso pessoal. Se voce depende do AnyDesk para trabalho ou uso profissional, adquira uma licenca oficial para suportar os desenvolvedores e ter acesso a todas as funcionalidades sem limitacoes.
