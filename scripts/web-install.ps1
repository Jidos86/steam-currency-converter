# Steam Currency Converter - one-line installer.
#   irm https://raw.githubusercontent.com/Jidos86/steam-currency-converter/main/scripts/web-install.ps1 | iex
#
# Self-contained: no param()/CmdletBinding (breaks under `iex`), no BOM.
# Env vars: SCC_REPO, SCC_REF, SCC_STEAM_PATH, SCC_LANG (en|ru).

& {
    $ErrorActionPreference = 'Stop'
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

    $repo   = if ($env:SCC_REPO) { $env:SCC_REPO } else { 'Jidos86/steam-currency-converter' }
    $ref    = if ($env:SCC_REF)  { $env:SCC_REF }  else { 'main' }
    $folder = 'steam-currency-converter'
    $name   = 'steam_currency_converter'   # plugin.json "name"

    $ru = if ($env:SCC_LANG) {
        $env:SCC_LANG -eq 'ru'
    } else {
        [System.Globalization.CultureInfo]::CurrentUICulture.TwoLetterISOLanguageName -eq 'ru'
    }
    function L($en, $rutext) { if ($ru) { $rutext } else { $en } }

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
        throw (L "Steam not found. Set `$env:SCC_STEAM_PATH and retry." "Steam не найден. Задай `$env:SCC_STEAM_PATH и повтори.")
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

    function Remove-Target($path) {
        if (-not (Test-Path -LiteralPath $path)) { return }
        $item = Get-Item -LiteralPath $path -Force
        if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) {
            # junction / symlink — remove only the link, never recurse into its target
            if ($item.PSIsContainer) { [IO.Directory]::Delete($path, $false) }
            else                     { [IO.File]::Delete($path) }
        } else {
            Remove-Item -LiteralPath $path -Recurse -Force
        }
    }

    # Write UTF-8 without a BOM (PS 5.1 Set-Content -Encoding UTF8 adds one, which
    # Millennium's JSON parser rejects) and keep enabledPlugins a JSON array.
    function Save-Config($path, $text) {
        $text = $text -replace '(?m)("enabledPlugins"\s*:\s*)"([^"\r\n]*)"', '$1["$2"]'
        $text = $text -replace '(?m)("enabledPlugins"\s*:\s*)null', '$1[]'
        [System.IO.File]::WriteAllText($path, $text, (New-Object System.Text.UTF8Encoding($false)))
    }

    function Enable-Plugin($steam, $pluginName) {
        $cfgList = @(
            (Join-Path $steam 'millennium\config\config.json'),
            (Join-Path $env:USERPROFILE '.millennium\config\config.json')
        )
        # Fresh Millennium install: config.json is created on first launch. Seed
        # a minimal one now so the plugin comes up already enabled.
        if (-not ($cfgList | Where-Object { Test-Path $_ })) {
            $seed = $cfgList[0]
            try {
                New-Item -ItemType Directory -Force -Path (Split-Path $seed) | Out-Null
                Save-Config $seed ('{ "plugins": { "enabledPlugins": ["' + $pluginName + '"] } }')
                Write-Host (L "Seeded Millennium config with the plugin enabled." "Создал конфиг Millennium с включённым плагином.") -ForegroundColor Green
                return
            } catch { }
        }
        foreach ($cfg in $cfgList) {
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
                Save-Config $cfg ($j | ConvertTo-Json -Depth 32)
                Write-Host (L "Enabled in the Millennium config." "Плагин включён в конфиге Millennium.") -ForegroundColor Green
                return
            } catch {
                $err = $_.Exception.Message
                $enMsg = "Could not edit config.json ($err); enable the plugin manually in Millennium -> Settings -> Plugins."
                $ruMsg = "Не удалось изменить config.json ($err); включи плагин вручную в Millennium -> Settings -> Plugins."
                Write-Host (L $enMsg $ruMsg) -ForegroundColor Yellow
                return
            }
        }
        Write-Host (L "Millennium config.json not found; enable the plugin manually in Millennium -> Settings -> Plugins." "config.json Millennium не найден; включи плагин вручную в Millennium -> Settings -> Plugins.") -ForegroundColor Yellow
    }

    function Test-Millennium($steam) {
        return (Test-Path (Join-Path $steam 'millennium\lib\millennium.dll')) -or
               (Test-Path (Join-Path $steam 'millennium')) -or
               (Test-Path (Join-Path $steam 'wsock32.dll')) -or
               (Test-Path (Join-Path $steam 'user32.dll')) -or
               (Test-Path (Join-Path $env:USERPROFILE '.millennium'))
    }

    # Same steps as the official installer: stop Steam, download the release
    # zip (verify sha256), extract into the Steam root.
    function Install-Millennium($steam, $tmpDir) {
        Write-Host (L "Millennium not found. Installing it (official release)..." "Millennium не найден. Ставлю его (официальный релиз)...") -ForegroundColor Yellow

        $rel = Invoke-RestMethod 'https://api.github.com/repos/SteamClientHomebrew/Millennium/releases/latest' -Headers @{ 'User-Agent' = 'scc-installer' }
        $asset = $rel.assets | Where-Object { $_.name -like '*windows-x86_64.zip' } | Select-Object -First 1
        if (-not $asset) { throw 'Could not find the Millennium Windows release asset.' }

        $zip = Join-Path $tmpDir $asset.name
        Write-Host "  $($asset.name) ($($rel.tag_name))"
        Invoke-WebRequest $asset.browser_download_url -OutFile $zip -UseBasicParsing

        $want = $null
        if ($asset.digest -and $asset.digest -like 'sha256:*') {
            $want = $asset.digest.Substring(7)
        } else {
            $sha = $rel.assets | Where-Object { $_.name -eq ($asset.name + '.sha256') } | Select-Object -First 1
            if ($sha) { $want = ((Invoke-WebRequest $sha.browser_download_url -UseBasicParsing).Content -split '\s+')[0] }
        }
        if (-not $want) {
            throw (L "No checksum available for the Millennium download; refusing to install an unverified archive." "Нет контрольной суммы для скачанного Millennium — не ставлю непроверенный архив.")
        }
        if ((Get-FileHash $zip -Algorithm SHA256).Hash.ToLower() -ne $want.Trim().ToLower()) {
            throw (L "Millennium download failed sha256 verification." "Millennium: контрольная сумма не совпала.")
        }

        $running = Get-Process steam -ErrorAction SilentlyContinue
        if ($running) {
            Write-Host (L "Closing Steam to install Millennium..." "Закрываю Steam для установки Millennium...") -ForegroundColor DarkYellow
            $running | Stop-Process -Force
            Start-Sleep -Seconds 3
        }

        try {
            Expand-Archive -Path $zip -DestinationPath $steam -Force
        } catch {
            throw (L "Could not write to $steam. Run PowerShell as administrator and retry." "Нет доступа на запись в $steam. Запусти PowerShell от администратора и повтори.")
        }
        Write-Host (L "Millennium installed. It finishes setup on the next Steam launch." "Millennium установлен. Донастройка — при следующем запуске Steam.") -ForegroundColor Green
        $script:sccNeedSteamStart = $true
    }

    $steam = if ($env:SCC_STEAM_PATH) { $env:SCC_STEAM_PATH } else { Resolve-SteamPath }
    Write-Host "Steam:   $steam"

    $tmp = Join-Path $env:TEMP ("scc-" + [Guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Force -Path $tmp | Out-Null

    if (-not (Test-Millennium $steam)) {
        Install-Millennium $steam $tmp
        if (-not (Test-Millennium $steam)) {
            throw (L "Millennium install did not land. Get it from https://steambrew.app and re-run." "Millennium не установился. Возьми его с https://steambrew.app и запусти команду снова.")
        }
    }

    try {
        $pluginSrc = $null

        # Prefer the prebuilt release zip.
        try {
            $rel = Invoke-RestMethod "https://api.github.com/repos/$repo/releases/latest" -Headers @{ 'User-Agent' = 'scc-installer' }
            $asset = $rel.assets | Where-Object { $_.name -like '*.zip' } | Select-Object -First 1
            if ($asset) {
                $tag = $rel.tag_name
                Write-Host (L "Downloading release $tag ..." "Скачиваю релиз $tag ...")
                $zip = Join-Path $tmp 'r.zip'
                Invoke-WebRequest $asset.browser_download_url -OutFile $zip -UseBasicParsing
                Expand-Archive $zip -DestinationPath (Join-Path $tmp 'r') -Force
                $pluginSrc = Get-ChildItem -Path (Join-Path $tmp 'r') -Recurse -Filter plugin.json |
                    Select-Object -First 1 | ForEach-Object { $_.Directory.FullName }
            }
        } catch {
            Write-Host (L "No usable release; building from source." "Готового релиза нет; собираю из исходников.") -ForegroundColor DarkYellow
        }

        # Fall back to source + build (needs Node.js).
        if (-not $pluginSrc) {
            if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
                throw (L "No release found and Node.js is not installed (needed to build). Install Node 18+ or wait for a release." "Нет готового релиза и не найден Node.js для сборки. Поставь Node 18+ или дождись релиза.")
            }
            $zip = Join-Path $tmp 's.zip'
            Invoke-WebRequest "https://codeload.github.com/$repo/zip/refs/heads/$ref" -OutFile $zip -UseBasicParsing
            Expand-Archive $zip -DestinationPath $tmp -Force
            $root = Get-ChildItem -Path $tmp -Directory | Where-Object { Test-Path (Join-Path $_.FullName 'package.json') } | Select-Object -First 1
            if (-not $root) { throw (L "package.json not found in the source archive." "В архиве исходников нет package.json.") }
            Push-Location $root.FullName
            try {
                Write-Host "npm ci ..." -ForegroundColor DarkGray
                & npm ci --silent 2>&1 | Out-Null
                & npm run build 2>&1 | Out-Null
            } finally { Pop-Location }
            $pluginSrc = $root.FullName
        }

        if (-not $pluginSrc -or -not (Test-Path (Join-Path $pluginSrc '.millennium\Dist\webkit.js'))) {
            throw (L "Build/download did not produce .millennium\Dist\webkit.js" "Сборка/загрузка не дала .millennium\Dist\webkit.js")
        }

        $pluginsDir = Resolve-PluginsDir $steam
        $target = Join-Path $pluginsDir $folder
        Write-Host (L "Install: $target" "Ставлю в: $target")

        Remove-Target $target
        New-Item -ItemType Directory -Force -Path $target | Out-Null
        foreach ($item in @('plugin.json', 'README.md', 'README.ru.md', 'LICENSE', 'backend', '.millennium')) {
            $s = Join-Path $pluginSrc $item
            if (Test-Path $s) { Copy-Item $s -Destination $target -Recurse -Force }
        }

        Enable-Plugin $steam $name

        Write-Host ""
        if ($script:sccNeedSteamStart) {
            $exe = Join-Path $steam 'steam.exe'
            if (Test-Path $exe) {
                Write-Host (L "Starting Steam..." "Запускаю Steam...") -ForegroundColor Green
                Start-Process -FilePath $exe
            }
            Write-Host (L "Done. Millennium + the plugin are installed." "Готово. Millennium и плагин установлены.") -ForegroundColor Green
        } else {
            Write-Host (L "Done. Fully restart Steam (tray -> Exit), then open the store." "Готово. Полностью перезапусти Steam (трей -> Выход), затем открой магазин.") -ForegroundColor Green
        }
    }
    finally {
        Remove-Item -Path $tmp -Recurse -Force -ErrorAction SilentlyContinue
    }
}
