# Steam Currency Converter — онлайн-установка.
#   irm https://raw.githubusercontent.com/Jidos86/steam-currency-converter/main/scripts/web-install.ps1 | iex
#
# Переопределить репозиторий/ветку — через переменные окружения SCC_REPO / SCC_REF.
# (Никаких param()/CmdletBinding — иначе ломается при подаче через `iex`.)

& {
    $ErrorActionPreference = 'Stop'
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

    $repo = if ($env:SCC_REPO) { $env:SCC_REPO } else { 'Jidos86/steam-currency-converter' }
    $ref  = if ($env:SCC_REF)  { $env:SCC_REF }  else { 'main' }

    Write-Host "== Steam Currency Converter — установка ==" -ForegroundColor Cyan

    $tmp = Join-Path $env:TEMP ("scc-" + [Guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Force -Path $tmp | Out-Null

    try {
        $srcDir = $null

        # 1) Пробуем готовый релизный zip (собран в CI).
        try {
            $rel = Invoke-RestMethod "https://api.github.com/repos/$repo/releases/latest" -Headers @{ 'User-Agent' = 'scc-installer' }
            $asset = $rel.assets | Where-Object { $_.name -like '*.zip' } | Select-Object -First 1
            if ($asset) {
                Write-Host "Скачиваю релиз $($rel.tag_name) ..."
                $zip = Join-Path $tmp 'release.zip'
                Invoke-WebRequest $asset.browser_download_url -OutFile $zip -UseBasicParsing
                Expand-Archive $zip -DestinationPath (Join-Path $tmp 'release') -Force
                $srcDir = Get-ChildItem -Path (Join-Path $tmp 'release') -Recurse -Filter plugin.json |
                    Select-Object -First 1 | ForEach-Object { $_.Directory.FullName }
            }
        } catch {
            Write-Host "Релиз не найден, собираю из исходников." -ForegroundColor DarkYellow
        }

        # 2) Иначе — исходники + сборка (нужен Node.js).
        if (-not $srcDir) {
            if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
                throw "Нет готового релиза и не найден Node.js для сборки. Поставь Node 18+ (https://nodejs.org) или дождись релиза плагина."
            }
            $zip = Join-Path $tmp 'src.zip'
            Invoke-WebRequest "https://codeload.github.com/$repo/zip/refs/heads/$ref" -OutFile $zip -UseBasicParsing
            Expand-Archive $zip -DestinationPath $tmp -Force
            $srcDir = Get-ChildItem -Path $tmp -Directory |
                Where-Object { Test-Path (Join-Path $_.FullName 'package.json') } |
                Select-Object -First 1 -ExpandProperty FullName
            if (-not $srcDir) { throw "В архиве не найден package.json." }

            Write-Host "npm ci ..." -ForegroundColor DarkGray
            Push-Location $srcDir
            try {
                & npm ci --silent 2>&1 | Out-Null
                & npm run build 2>&1 | Out-Null
            } finally { Pop-Location }
        }

        if (-not (Test-Path (Join-Path $srcDir '.millennium\Dist\webkit.js'))) {
            throw "Сборка не дала .millennium\Dist\webkit.js"
        }

        & (Join-Path $srcDir 'scripts\install.ps1')
    }
    finally {
        Remove-Item -Path $tmp -Recurse -Force -ErrorAction SilentlyContinue
    }
}
