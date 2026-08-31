<#
.SYNOPSIS
    Онлайн-установка одной командой. Скачивает репозиторий и запускает install.ps1.
.EXAMPLE
    irm https://raw.githubusercontent.com/Jidos86/steam-currency-to-rub/main/scripts/web-install.ps1 | iex
#>
[CmdletBinding()]
param(
    [string]$Repo   = 'Jidos86/steam-currency-to-rub',
    [string]$Ref    = 'main',
    [string]$SteamPath
)

$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

Write-Host "== Steam Currency to RUB — онлайн-установка ==" -ForegroundColor Cyan

$tmp = Join-Path $env:TEMP ("sctr-" + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force -Path $tmp | Out-Null

try {
    $zip = Join-Path $tmp 'src.zip'
    $url = "https://codeload.github.com/$Repo/zip/refs/heads/$Ref"
    Write-Host "Скачиваю $url ..."
    Invoke-WebRequest -Uri $url -OutFile $zip -UseBasicParsing

    Expand-Archive -Path $zip -DestinationPath $tmp -Force

    $srcDir = Get-ChildItem -Path $tmp -Directory | Where-Object { Test-Path (Join-Path $_.FullName 'plugin.json') } | Select-Object -First 1
    if (-not $srcDir) { throw "В архиве не найден plugin.json." }

    $installArgs = @{}
    if ($SteamPath) { $installArgs['SteamPath'] = $SteamPath }

    & (Join-Path $srcDir.FullName 'scripts\install.ps1') @installArgs
}
finally {
    Remove-Item -Path $tmp -Recurse -Force -ErrorAction SilentlyContinue
}
