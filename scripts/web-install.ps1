# Steam Currency Converter - one-line installer.
#   irm https://raw.githubusercontent.com/Jidos86/steam-currency-converter/main/scripts/web-install.ps1 | iex
#
# Self-contained: no param()/CmdletBinding (breaks under `iex`), no BOM.
# Override repo/branch via env vars SCC_REPO / SCC_REF.

& {
    $ErrorActionPreference = 'Stop'
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

    $repo   = if ($env:SCC_REPO) { $env:SCC_REPO } else { 'Jidos86/steam-currency-converter' }
    $ref    = if ($env:SCC_REF)  { $env:SCC_REF }  else { 'main' }
    $folder = 'steam-currency-converter'
    $name   = 'steam_currency_converter'   # plugin.json "name"

    Write-Host "== Steam Currency Converter ==" -ForegroundColor Cyan

    function Resolve-SteamPath {
        $cands = @()
        foreach ($r in @(
            @{ P = 'HKCU:\Software\Valve\Steam';             N = 'SteamPath' },
            @{ P = 'HKLM:\SOFTWARE\WOW6432Node\Valve\Steam'; N = 'InstallPath' },
            @{ P = 'HKLM:\SOFTWARE\Valve\Steam';             N = 'InstallPath' }
        )) {
            try { $v = (Get-ItemProperty -Path $r.P -Name $r.N -ErrorAction Stop).$($r.N); if ($v) { $cands += ($v -replace '/', '\') } } catch {}
        }
        $cands += 'C:\Program Files (x86)\Steam', 'C:\Program Files\Steam'
        foreach ($c in $cands) { if ($c -and (Test-Path (Join-Path $c 'steam.exe'))) { return (Resolve-Path $c).Path } }
        throw "Steam not found. Set `$env:SCC_STEAM_PATH and retry."
    }

    function Resolve-PluginsDir($steam) {
        foreach ($c in @(
            (Join-Path $steam 'millennium\plugins'),
            (Join-Path $env:USERPROFILE '.millennium\plugins'),
            (Join-Path $steam 'plugins')
        )) { if (Test-Path $c) { return $c } }
        $def = Join-Path $steam 'millennium\plugins'
        New-Item -ItemType Directory -Force -Path $def | Out-Null
        return $def
    }

    function Enable-Plugin($steam, $pluginName) {
        foreach ($cfg in @(
            (Join-Path $steam 'millennium\config\config.json'),
            (Join-Path $env:USERPROFILE '.millennium\config\config.json')
        )) {
            if (-not (Test-Path $cfg)) { continue }
            try {
                $j = Get-Content -Raw $cfg | ConvertFrom-Json
                if (-not ($j.PSObject.Properties.Name -contains 'plugins')) {
                    $j | Add-Member plugins ([pscustomobject]@{ enabledPlugins = @() })
                }
                if (-not ($j.plugins.PSObject.Properties.Name -contains 'enabledPlugins')) {
                    $j.plugins | Add-Member enabledPlugins @()
                }
                $list = @($j.plugins.enabledPlugins | Where-Object { $_ -ne $pluginName }) + $pluginName
                $j.plugins.enabledPlugins = @($list)
                ($j | ConvertTo-Json -Depth 32) | Set-Content $cfg -Encoding UTF8
                Write-Host "Enabled in Millennium config." -ForegroundColor Green
                return
            } catch {
                Write-Host "Could not edit config.json ($($_.Exception.Message)); enable the plugin manually in Millennium -> Settings -> Plugins." -ForegroundColor Yellow
                return
            }
        }
        Write-Host "Millennium config.json not found; enable the plugin manually in Millennium -> Settings -> Plugins." -ForegroundColor Yellow
    }

    $steam = if ($env:SCC_STEAM_PATH) { $env:SCC_STEAM_PATH } else { Resolve-SteamPath }
    Write-Host "Steam:   $steam"

    $tmp = Join-Path $env:TEMP ("scc-" + [Guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Force -Path $tmp | Out-Null

    try {
        $pluginSrc = $null

        # Prefer the prebuilt release zip.
        try {
            $rel = Invoke-RestMethod "https://api.github.com/repos/$repo/releases/latest" -Headers @{ 'User-Agent' = 'scc-installer' }
            $asset = $rel.assets | Where-Object { $_.name -like '*.zip' } | Select-Object -First 1
            if ($asset) {
                Write-Host "Downloading release $($rel.tag_name) ..."
                $zip = Join-Path $tmp 'r.zip'
                Invoke-WebRequest $asset.browser_download_url -OutFile $zip -UseBasicParsing
                Expand-Archive $zip -DestinationPath (Join-Path $tmp 'r') -Force
                $pluginSrc = Get-ChildItem -Path (Join-Path $tmp 'r') -Recurse -Filter plugin.json |
                    Select-Object -First 1 | ForEach-Object { $_.Directory.FullName }
            }
        } catch {
            Write-Host "No usable release; building from source." -ForegroundColor DarkYellow
        }

        # Fall back to source + build (needs Node.js).
        if (-not $pluginSrc) {
            if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
                throw "No release found and Node.js is not installed (needed to build). Install Node 18+ or wait for a release."
            }
            $zip = Join-Path $tmp 's.zip'
            Invoke-WebRequest "https://codeload.github.com/$repo/zip/refs/heads/$ref" -OutFile $zip -UseBasicParsing
            Expand-Archive $zip -DestinationPath $tmp -Force
            $root = Get-ChildItem -Path $tmp -Directory | Where-Object { Test-Path (Join-Path $_.FullName 'package.json') } | Select-Object -First 1
            if (-not $root) { throw "package.json not found in the source archive." }
            Push-Location $root.FullName
            try {
                Write-Host "npm ci ..." -ForegroundColor DarkGray
                & npm ci --silent 2>&1 | Out-Null
                & npm run build 2>&1 | Out-Null
            } finally { Pop-Location }
            $pluginSrc = $root.FullName
        }

        if (-not $pluginSrc -or -not (Test-Path (Join-Path $pluginSrc '.millennium\Dist\webkit.js'))) {
            throw "Build/download did not produce .millennium\Dist\webkit.js"
        }

        $pluginsDir = Resolve-PluginsDir $steam
        $target = Join-Path $pluginsDir $folder
        Write-Host "Install: $target"

        if (Test-Path $target) { Remove-Item $target -Recurse -Force }
        New-Item -ItemType Directory -Force -Path $target | Out-Null
        foreach ($item in @('plugin.json', 'README.md', 'LICENSE', 'backend', '.millennium')) {
            $s = Join-Path $pluginSrc $item
            if (Test-Path $s) { Copy-Item $s -Destination $target -Recurse -Force }
        }

        Enable-Plugin $steam $name

        Write-Host ""
        Write-Host "Done. Fully restart Steam (tray -> Exit), then open the store." -ForegroundColor Green
    }
    finally {
        Remove-Item -Path $tmp -Recurse -Force -ErrorAction SilentlyContinue
    }
}
