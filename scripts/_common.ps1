# Shared helpers for install / uninstall / dev-link scripts.
# Dot-source this file: . "$PSScriptRoot\_common.ps1"

$script:PluginName   = 'steam_currency_to_rub'   # must match plugin.json "name"
$script:PluginFolder = 'steam-currency-to-rub'   # folder name inside the plugins dir

function Write-Info  { param($m) Write-Host $m -ForegroundColor Cyan }
function Write-Ok    { param($m) Write-Host $m -ForegroundColor Green }
function Write-Warn2 { param($m) Write-Host $m -ForegroundColor Yellow }

function Get-SteamPath {
    param([string]$Override)

    $candidates = @()
    if ($Override) { $candidates += $Override }

    foreach ($reg in @(
        @{ Path = 'HKCU:\Software\Valve\Steam';                 Name = 'SteamPath' },
        @{ Path = 'HKLM:\SOFTWARE\WOW6432Node\Valve\Steam';     Name = 'InstallPath' },
        @{ Path = 'HKLM:\SOFTWARE\Valve\Steam';                 Name = 'InstallPath' }
    )) {
        try {
            $v = (Get-ItemProperty -Path $reg.Path -Name $reg.Name -ErrorAction Stop).$($reg.Name)
            if ($v) { $candidates += ($v -replace '/', '\') }
        } catch { }
    }

    $candidates += 'C:\Program Files (x86)\Steam'
    $candidates += 'C:\Program Files\Steam'

    foreach ($c in $candidates) {
        if ($c -and (Test-Path (Join-Path $c 'steam.exe'))) {
            return (Resolve-Path $c).Path
        }
    }

    throw "Steam не найден автоматически. Запусти скрипт с параметром -SteamPath 'D:\Path\to\Steam'."
}

function Test-MillenniumInstalled {
    param([string]$SteamPath)
    return (
        (Test-Path (Join-Path $SteamPath 'millennium')) -or
        (Test-Path (Join-Path $SteamPath 'user32.dll')) -or
        (Test-Path (Join-Path $SteamPath 'millennium.dll')) -or
        (Test-Path (Join-Path $env:USERPROFILE '.millennium'))
    )
}

function Get-PluginsDir {
    param([string]$SteamPath, [switch]$CreateIfMissing)

    $candidates = @(
        (Join-Path $SteamPath 'millennium\plugins'),
        (Join-Path $env:USERPROFILE '.millennium\plugins'),
        (Join-Path $SteamPath 'plugins')
    )
    foreach ($c in $candidates) {
        if (Test-Path $c) { return $c }
    }

    $default = $candidates[0]
    if ($CreateIfMissing) {
        New-Item -ItemType Directory -Force -Path $default | Out-Null
        return $default
    }
    throw "Папка плагинов Millennium не найдена. Установлен ли Millennium? (https://steambrew.app)"
}

function Get-MillenniumConfigPath {
    param([string]$SteamPath)
    foreach ($p in @(
        (Join-Path $SteamPath 'millennium\config\config.json'),
        (Join-Path $env:USERPROFILE '.millennium\config\config.json'),
        (Join-Path $SteamPath 'ext\millennium.ini')
    )) {
        if (Test-Path $p) { return $p }
    }
    return $null
}

function Set-PluginEnabled {
    param([string]$SteamPath, [string]$Name, [bool]$Enabled)

    $cfg = Get-MillenniumConfigPath -SteamPath $SteamPath
    if (-not $cfg -or -not $cfg.EndsWith('.json')) {
        Write-Warn2 "Не нашёл config.json Millennium — включи плагин вручную в Millennium -> Settings -> Plugins."
        return
    }

    try {
        $json = Get-Content -Raw -Path $cfg | ConvertFrom-Json

        if (-not ($json.PSObject.Properties.Name -contains 'plugins')) {
            $json | Add-Member -NotePropertyName 'plugins' -NotePropertyValue ([pscustomobject]@{ enabledPlugins = @() })
        }
        if (-not ($json.plugins.PSObject.Properties.Name -contains 'enabledPlugins')) {
            $json.plugins | Add-Member -NotePropertyName 'enabledPlugins' -NotePropertyValue @()
        }

        $list = @($json.plugins.enabledPlugins | Where-Object { $_ -ne $Name })
        if ($Enabled) { $list += $Name }
        $json.plugins.enabledPlugins = @($list)

        ($json | ConvertTo-Json -Depth 32) | Set-Content -Path $cfg -Encoding UTF8
        if ($Enabled) { Write-Ok "Плагин включён в config.json Millennium." }
        else          { Write-Warn2 "Плагин выключен в config.json Millennium." }
    } catch {
        Write-Warn2 "Не смог изменить config.json ($($_.Exception.Message)). Включи/выключи плагин вручную в Millennium Settings."
    }
}

function Copy-PluginFiles {
    param([string]$RepoRoot, [string]$Target)

    if (Test-Path $Target) { Remove-Item -Path $Target -Recurse -Force }
    New-Item -ItemType Directory -Force -Path $Target | Out-Null

    # Только то, что нужно рантайму — без scripts/.git/.github.
    foreach ($item in @('plugin.json', 'README.md', 'LICENSE', '.millennium')) {
        $src = Join-Path $RepoRoot $item
        if (Test-Path $src) {
            Copy-Item -Path $src -Destination $Target -Recurse -Force
        }
    }
}
