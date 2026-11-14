param([switch]$Console)

$logFile = "$env:TEMP\anydesk_monitor.log"
$lastResetFile = "$env:TEMP\anydesk_last_reset.txt"
$cooldownMinutes = 10

function Write-Log {
    param([string]$msg)
    $time = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    "$time - $msg" | Out-File $logFile -Append
    if ($Console) { Write-Host "$time - $msg" }
}

function Reset-AnyDeskId {
    try {
        Write-Log "Parando AnyDesk..."
        Stop-Service AnyDesk -Force -ErrorAction SilentlyContinue
        Stop-Process -Name AnyDesk -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2

        $userConf = "$env:APPDATA\AnyDesk\user.conf"
        $thumbDir = "$env:APPDATA\AnyDesk\thumbnails"
        $backupUser = "$env:TEMP\anydesk_user_backup.conf"
        $backupThumb = "$env:TEMP\anydesk_thumb_backup"

        if (Test-Path $userConf) { Copy-Item $userConf $backupUser -Force }
        if (Test-Path $thumbDir) {
            Remove-Item $backupThumb -Recurse -Force -ErrorAction SilentlyContinue
            Copy-Item $thumbDir $backupThumb -Recurse -Force
        }

        Remove-Item "$env:ProgramData\AnyDesk\service.conf" -Force -ErrorAction SilentlyContinue
        Remove-Item "$env:APPDATA\AnyDesk\service.conf" -Force -ErrorAction SilentlyContinue
        Remove-Item "$env:ProgramData\AnyDesk\connection_trace.txt" -Force -ErrorAction SilentlyContinue
        Remove-Item "$env:ProgramData\AnyDesk\*.trace" -Force -ErrorAction SilentlyContinue
        Remove-Item "$env:ProgramData\AnyDesk\*" -Recurse -Force -ErrorAction SilentlyContinue
        Remove-Item "$env:APPDATA\AnyDesk\*" -Recurse -Force -ErrorAction SilentlyContinue

        Start-Service AnyDesk -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 3

        $timeout = 15
        $elapsed = 0
        while ($elapsed -lt $timeout) {
            $sysConf = "$env:ProgramData\AnyDesk\system.conf"
            if (Test-Path $sysConf) {
                $c = Get-Content $sysConf -ErrorAction SilentlyContinue
                if ($c -match "ad.anynet.id=") { break }
            }
            Start-Sleep -Seconds 1; $elapsed++
        }

        Stop-Service AnyDesk -Force -ErrorAction SilentlyContinue
        Stop-Process -Name AnyDesk -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2

        if (Test-Path $backupUser) {
            New-Item -ItemType Directory -Path "$env:APPDATA\AnyDesk" -Force | Out-Null
            Copy-Item $backupUser $userConf -Force
        }
        if (Test-Path $backupThumb) {
            New-Item -ItemType Directory -Path "$env:APPDATA\AnyDesk\thumbnails" -Force | Out-Null
            Copy-Item "$backupThumb\*" "$env:APPDATA\AnyDesk\thumbnails\" -Recurse -Force
        }

        Start-Service AnyDesk -ErrorAction SilentlyContinue
        Set-Content $lastResetFile -Value (Get-Date)
        Remove-Item $backupUser -Force -ErrorAction SilentlyContinue
        Remove-Item $backupThumb -Recurse -Force -ErrorAction SilentlyContinue
        Write-Log "Reset concluido"
    } catch {
        Write-Log "Erro no reset: $_"
    }
}

function Test-CommercialDetection {
    $traceFile = "$env:ProgramData\AnyDesk\connection_trace.txt"
    if (Test-Path $traceFile) {
        try {
            $lines = Get-Content $traceFile -Tail 100 -ErrorAction Stop
            foreach ($line in $lines) {
                if ($line -match '(?i)(commercial|time.limit|blocked|SESSION_BLOCKED|license.limit|licen)') {
                    Write-Log "Detectado: $line"; return $true
                }
            }
        } catch {}
    }

    $traceFiles = Get-ChildItem "$env:ProgramData\AnyDesk\*.trace" -ErrorAction SilentlyContinue
    foreach ($f in $traceFiles | Where-Object { $_.LastWriteTime -gt (Get-Date).AddMinutes(-5) }) {
        $content = Get-Content $f.FullName -Tail 50 -ErrorAction SilentlyContinue
        if ($content -match '(?i)(commercial|blocked|limit|licen)') {
            Write-Log "Detectado em $($f.Name)"; return $true
        }
    }
    return $false
}

function Should-Reset {
    if (-not (Test-Path $lastResetFile)) { return $true }
    $lastReset = Get-Content $lastResetFile | Get-Date
    return ((Get-Date) - $lastReset).TotalMinutes -ge $cooldownMinutes
}

Write-Log "Monitor AnyDesk iniciado"
while ($true) {
    if (Test-CommercialDetection) {
        Write-Log "Comercial detectado!"
        if (Should-Reset) { Reset-AnyDeskId }
        else { Write-Log "Cooldown de $cooldownMinutes min" }
    }
    Start-Sleep -Seconds 15
}
