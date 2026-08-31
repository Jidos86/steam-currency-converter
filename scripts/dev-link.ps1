<#
.SYNOPSIS
    Dev-режим: делает симлинк из этого репозитория в папку плагинов Millennium.
    Правишь файлы в репе — Steam видит изменения сразу (после перезапуска/reload плагина).
.NOTES
    Нужны права администратора ИЛИ включённый Developer Mode в Windows.
.EXAMPLE
    .\scripts\dev-link.ps1
#>
[CmdletBinding()]
param(
    [string]$SteamPath
)

$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\_common.ps1"

$repoRoot = Split-Path -Path $PSScriptRoot -Parent
if (-not (Test-Path (Join-Path $repoRoot 'plugin.json'))) {
    throw "plugin.json не найден в $repoRoot."
}

$steam      = Get-SteamPath -Override $SteamPath
$pluginsDir = Get-PluginsDir -SteamPath $steam -CreateIfMissing
$target     = Join-Path $pluginsDir $script:PluginFolder

Write-Info "Steam:   $steam"
Write-Info "Симлинк: $target  ->  $repoRoot"

if (Test-Path $target) { Remove-Item -Path $target -Recurse -Force }

try {
    New-Item -ItemType SymbolicLink -Path $target -Target $repoRoot | Out-Null
} catch {
    throw @"
Не удалось создать симлинк.

Проверь:
  1. PowerShell запущен от имени администратора, ИЛИ
  2. в Windows включён Developer Mode (Параметры -> Для разработчиков)

Исходная ошибка: $($_.Exception.Message)
"@
}

Set-PluginEnabled -SteamPath $steam -Name $script:PluginName -Enabled $true

Write-Host ""
Write-Ok "Симлинк создан. Перезапусти Steam."
