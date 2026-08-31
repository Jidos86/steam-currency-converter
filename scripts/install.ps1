<#
.SYNOPSIS
    Устанавливает плагин "Steam Currency Converter" в Millennium (копирование файлов).
.EXAMPLE
    .\scripts\install.ps1
.EXAMPLE
    .\scripts\install.ps1 -SteamPath "D:\Steam"
#>
[CmdletBinding()]
param(
    [string]$SteamPath
)

$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\_common.ps1"

$repoRoot = Split-Path -Path $PSScriptRoot -Parent
if (-not (Test-Path (Join-Path $repoRoot 'plugin.json'))) {
    throw "plugin.json не найден в $repoRoot — запусти скрипт из папки репозитория."
}

# Собранного webkit.js нет (свежий клон) — собираем, если есть Node.
if (-not (Test-Path (Join-Path $repoRoot '.millennium\Dist\webkit.js'))) {
    if (-not (Test-Path (Join-Path $repoRoot 'package.json'))) {
        throw ".millennium\Dist\webkit.js не найден и нет package.json для сборки."
    }
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        throw "Плагин не собран, и не найден Node.js. Поставь Node 18+ (https://nodejs.org) и запусти снова, либо скачай релизный zip."
    }
    Write-Info "Собираю плагин (npm ci && npm run build)..."
    Push-Location $repoRoot
    try {
        & npm ci --silent
        & npm run build
    } finally { Pop-Location }
    if (-not (Test-Path (Join-Path $repoRoot '.millennium\Dist\webkit.js'))) {
        throw "Сборка не дала .millennium\Dist\webkit.js"
    }
}

$steam = Get-SteamPath -Override $SteamPath
Write-Info "Steam:      $steam"

if (-not (Test-MillenniumInstalled -SteamPath $steam)) {
    Write-Warn2 "Millennium не обнаружен. Поставь его с https://steambrew.app и запусти установку снова."
}

$pluginsDir = Get-PluginsDir -SteamPath $steam -CreateIfMissing
$target     = Join-Path $pluginsDir $script:PluginFolder
Write-Info "Плагины:    $pluginsDir"
Write-Info "Цель:       $target"

Copy-PluginFiles -RepoRoot $repoRoot -Target $target
Write-Ok "Файлы плагина скопированы."

Set-PluginEnabled -SteamPath $steam -Name $script:PluginName -Enabled $true

Write-Host ""
Write-Ok "Готово. Полностью перезапусти Steam (трей -> Выход), затем открой магазин."
