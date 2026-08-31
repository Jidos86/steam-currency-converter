# Steam Currency to RUB

Плагин для [Millennium](https://steambrew.app): показывает **примерную цену в рублях** рядом с любой ценой Steam — в магазине, корзине, оформлении заказа, на странице сообщества и в игровом оверлее.

> Это приблизительная конвертация по биржевому курсу, а **не** официальная региональная цена Steam. Реальная цена в рублёвом регионе может отличаться.

Форк [KuroKim/steam-currency-to-rub](https://github.com/KuroKim/steam-currency-to-rub). Что изменилось — см. [«Отличия форка»](#отличия-форка).

---

## Возможности

- определяет валюту аккаунта: по id кошелька Steam → schema.org-разметке → форматтеру магазина;
- поддерживает **все валюты кошелька Steam** (USD, EUR, GBP, CHF, PLN, BRL, JPY, NOK, IDR, MYR, PHP, SGD, THB, VND, KRW, TRY, UAH, MXN, CAD, AUD, CNY, INR, CLP, PEN, COP, ZAR, HKD, TWD, SAR, AED, SEK, ARS, ILS, BYN, KZT, KWD, QAR, CRC, UYU);
- универсальный разбор цен: `1,234.56`, `1.234,56`, `1 199`, валюты без копеек (JPY, KRW, IDR…);
- работает в **корзине и на оформлении заказа** (в т.ч. новый React-интерфейс);
- работает в игровом оверлее Steam;
- курс кешируется локально на 6 часов, при недоступности сети берётся прошлый кеш;
- три источника курса с автоматическим переключением.

---

## Установка

Нужен установленный [Millennium](https://steambrew.app).

### Вариант 1. Одной командой (PowerShell)

```powershell
irm https://raw.githubusercontent.com/Jidos86/steam-currency-to-rub/main/scripts/web-install.ps1 | iex
```

Скрипт сам найдёт Steam, скопирует плагин в папку Millennium и включит его. После — **полностью перезапусти Steam** (трей → «Выход»).

### Вариант 2. Вручную

1. Скачай репозиторий: `Code → Download ZIP` (или релизный `steam-currency-to-rub.zip`).
2. Распакуй папку в `…\Steam\millennium\plugins\` — должно получиться
   `…\Steam\millennium\plugins\steam-currency-to-rub\plugin.json`.
3. Millennium → Settings → Plugins → включи **Steam Currency to RUB**.
4. Полностью перезапусти Steam.

### Вариант 3. Локальный скрипт

Из папки репозитория:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install.ps1
```

### Удаление

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\uninstall.ps1
```

---

## Разработка

```powershell
# симлинк репозитория в папку плагинов (нужен админ или Developer Mode)
powershell -ExecutionPolicy Bypass -File .\scripts\dev-link.ps1
```

Весь код — один файл: [`.millennium/Dist/webkit.js`](.millennium/Dist/webkit.js). Правишь → перезапускаешь Steam (или reload плагина в Millennium).

Структура:

```text
plugin.json                  манифест Millennium (useBackend: false)
.millennium/Dist/webkit.js   весь плагин (webkit-модуль, грузится в контекст страницы)
scripts/                     install / uninstall / dev-link / web-install
.github/workflows/release.yml сборка zip по тегу v*
```

---

## Как это работает

Millennium грузит `.millennium/Dist/webkit.js` в контекст страниц Steam с `Page.setBypassCSP`, поэтому скрипт работает даже там, где Content-Security-Policy магазина запрещает сторонние `<script>` (например, в китайском регионе Steam).

Скрипт:

1. берёт курсы через [currency-api](https://github.com/fawazahmed0/exchange-api) (3 зеркала), кеширует в `localStorage`;
2. определяет валюту аккаунта;
3. сканирует ценовые элементы (+ MutationObserver на динамический контент);
4. на `/cart` и `/checkout` дополнительно ищет «листовые» элементы, чей текст — ровно цена;
5. дописывает `≈ N ₽` рядом с оригинальной ценой.

---

## Отличия форка

| | upstream | этот форк |
|---|---|---|
| Внедрение | `add_browser_js` → `<script src>` (ломается о CSP) | webkit-модуль + `setBypassCSP` |
| Валюты | 7 (whitelist) | все валюты кошелька Steam |
| Разбор цен | US / EU форматы | + `1 199`, валюты без копеек, авто-детект разделителя |
| Точность курса | округление до 2 знаков (ошибка до десятков % для валют с курсом < 1) | полная точность |
| Источники курса | 2 | 3 + fallback на устаревший кеш |
| Корзина/оформление | частично | явная поддержка, в т.ч. React-интерфейс |
| Установка | ручной `dev-link` | авто-детект Steam/Millennium, one-liner, релизный zip |

---

## Планы

- [ ] заявка в [Millennium PluginDatabase](https://github.com/SteamClientHomebrew/PluginDatabase) (магазин плагинов Millennium)

---

## Благодарности

- Оригинальный плагин — [KuroKim](https://github.com/KuroKim/steam-currency-to-rub).
- Исходный userscript — [CJMAXiK](https://gist.github.com/cjmaxik/7ce493d08958eecd56a78c01482e49fa) (MIT).
- Курсы валют — [@fawazahmed0/exchange-api](https://github.com/fawazahmed0/exchange-api).

Не связано с Valve и Millennium / Steambrew. Неофициальный плагин.

## Лицензия

MIT
