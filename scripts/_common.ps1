# Shared helpers for install / uninstall / dev-link scripts.
# Dot-source this file: . "$PSScriptRoot\_common.ps1"

$script:PluginName   = 'steam_currency_converter'   # must match plugin.json "name"
$script:PluginFolder = 'steam-currency-converter'   # folder name inside the plugins dir

function Write-Info  { param($m) Write-Host $m -ForegroundColor Cyan }
function Write-Ok    { param($m) Write-Host $m -ForegroundColor Green }
function Write-Warn2 { param($m) Write-Host $m -ForegroundColor Yellow }

# Delete a plugin install target. If it's a junction / symlink, remove only the
# link — never recurse into (and wipe) the repo it points at.
function Remove-Target {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) { return }
    $item = Get-Item -LiteralPath $Path -Force
    if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) {
        if ($item.PSIsContainer) { [IO.Directory]::Delete($Path, $false) }
        else                     { [IO.File]::Delete($Path) }
    } else {
        Remove-Item -LiteralPath $Path -Recurse -Force
    }
}

# Serialize a Millennium config object back to disk without corrupting it:
#  - PS 5.1 ConvertTo-Json collapses a 1-element array to a scalar; keep it an array
#  - PS 5.1 Set-Content -Encoding UTF8 writes a BOM, which the parser rejects
function Save-MillenniumConfig {
    param([string]$Path, $Config)
    $text = $Config | ConvertTo-Json -Depth 32
    $text = $text -replace '(?m)("enabledPlugins"\s*:\s*)"([^"\r\n]*)"', '$1["$2"]'
    $text = $text -replace '(?m)("enabledPlugins"\s*:\s*)null', '$1[]'
    [System.IO.File]::WriteAllText($Path, $text, (New-Object System.Text.UTF8Encoding($false)))
}

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

        Save-MillenniumConfig -Path $cfg -Config $json
        if ($Enabled) { Write-Ok "Плагин включён в config.json Millennium." }
        else          { Write-Warn2 "Плагин выключен в config.json Millennium." }
    } catch {
        Write-Warn2 "Не смог изменить config.json ($($_.Exception.Message)). Включи/выключи плагин вручную в Millennium Settings."
    }
}

function Copy-PluginFiles {
    param([string]$RepoRoot, [string]$Target)

    Remove-Target $Target
    New-Item -ItemType Directory -Force -Path $Target | Out-Null

    # Только то, что нужно рантайму — без scripts/.git/.github/node_modules.
    foreach ($item in @('plugin.json', 'README.md', 'README.ru.md', 'LICENSE', 'backend', '.millennium')) {
        $src = Join-Path $RepoRoot $item
        if (Test-Path $src) {
            Copy-Item -Path $src -Destination $Target -Recurse -Force
        }
    }
}
