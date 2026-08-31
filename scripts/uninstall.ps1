<#
.SYNOPSIS
    Удаляет плагин "Steam Currency to RUB" из Millennium.
.EXAMPLE
    .\scripts\uninstall.ps1
#>
[CmdletBinding()]
param(
    [string]$SteamPath
)

$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\_common.ps1"

$steam = Get-SteamPath -Override $SteamPath
Write-Info "Steam: $steam"

$removedAny = $false
foreach ($base in @(
    (Join-Path $steam 'millennium\plugins'),
    (Join-Path $env:USERPROFILE '.millennium\plugins'),
    (Join-Path $steam 'plugins'),
    (Join-Path $steam 'steamui')
)) {
    foreach ($name in @($script:PluginFolder, 'steam-currency-to-rub-main', 'steam_currency_to_rub.js')) {
        $p = Join-Path $base $name
        if (Test-Path $p) {
            Remove-Item -Path $p -Recurse -Force
            Write-Warn2 "Удалено: $p"
            $removedAny = $true
        }
    }
}

if (-not $removedAny) { Write-Warn2 "Файлы плагина не найдены — возможно, уже удалён." }

Set-PluginEnabled -SteamPath $steam -Name $script:PluginName -Enabled $false

Write-Host ""
Write-Ok "Готово. Перезапусти Steam."
