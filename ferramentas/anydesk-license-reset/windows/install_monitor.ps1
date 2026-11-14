# Instala o monitor AnyDesk como tarefa agendada (inicia com o Windows)
# Executar como administrador

$scriptPath = "$PSScriptRoot\monitor_anydesk.ps1"
$taskName = "AnyDeskMonitorBypass"

if (-not (Test-Path $scriptPath)) {
    Write-Host "ERRO: monitor_anydesk.ps1 nao encontrado em $scriptPath" -ForegroundColor Red
    exit 1
}

Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue

$action = New-ScheduledTaskAction -Execute "powershell.exe" `
    -Argument "-WindowStyle Hidden -ExecutionPolicy Bypass -File `"$scriptPath`""
$trigger = New-ScheduledTaskTrigger -AtLogon
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force

Write-Host "Monitor AnyDesk instalado como tarefa agendada!"
Write-Host "Task: $taskName"
Write-Host "Inicia automaticamente ao ligar o Windows"
Write-Host "Remover: Unregister-ScheduledTask -TaskName $taskName -Confirm:`$false"
