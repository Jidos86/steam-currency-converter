# Steam Currency Converter

Плагин для [Millennium](https://steambrew.app): показывает **примерную цену в выбранной валюте** рядом с любой ценой Steam — в магазине, корзине, оформлении заказа, на странице сообщества и в игровом оверлее.

> Это приблизительная конвертация по биржевому курсу, а **не** официальная региональная цена Steam.

Форк [KuroKim/steam-currency-to-rub](https://github.com/KuroKim/steam-currency-to-rub).

---

## Возможности

- определяет валюту аккаунта (по id кошелька Steam → schema.org → форматтеру магазина);
- **целевая валюта настраивается** (по умолчанию — RUB);
- поддерживает все валюты кошелька Steam (USD, EUR, GBP, CHF, PLN, BRL, JPY, NOK, IDR, MYR, PHP, SGD, THB, VND, KRW, TRY, UAH, MXN, CAD, AUD, CNY, INR, CLP, PEN, COP, ZAR, HKD, TWD, SAR, AED, SEK, ARS, ILS, BYN, KZT, KWD, QAR, CRC, UYU) и как исходную, и как целевую;
- универсальный разбор цен: `1,234.56`, `1.234,56`, `1 199`, валюты без копеек;
- работает в корзине и оформлении заказа (в т.ч. новый React-интерфейс) и в оверлее;
- курс кешируется на 6 часов, при недоступности сети — прошлый кеш; три источника с автопереключением;
- рендер только через DOM API (`createElement`/`textContent`) — без `innerHTML`, `eval` и удалённого кода.

## Статус

| | |
|---|---|
| Конвертация в **RUB** | ✅ работает (webkit-модуль, обход CSP через `setBypassCSP`) |
| Выбор целевой валюты в UI | 🚧 в разработке (ветка `feat/settings-panel`, переход на сборку `@steambrew`) |

---

## Установка

Нужен установленный [Millennium](https://steambrew.app).

### Одной командой (PowerShell)

```powershell
irm https://raw.githubusercontent.com/Jidos86/steam-currency-converter/main/scripts/web-install.ps1 | iex
```

### Вручную

1. `Code → Download ZIP` (или релизный `steam-currency-converter.zip`).
2. Распаковать в `…\Steam\millennium\plugins\` → `…\plugins\steam-currency-converter\plugin.json`.
3. Millennium → Settings → Plugins → включить **Steam Currency Converter**.
4. Полностью перезапустить Steam.

### Удаление

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\uninstall.ps1
```

---

## Разработка

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\dev-link.ps1   # симлинк репо в папку плагинов
```

Текущий рантайм — один файл [`.millennium/Dist/webkit.js`](.millennium/Dist/webkit.js) (hand-authored, без сборки). Правишь → перезапуск Steam.

```text
plugin.json                  манифест Millennium
.millennium/Dist/webkit.js   весь плагин (webkit-модуль, грузится в контекст страницы с setBypassCSP)
scripts/                     install / uninstall / dev-link / web-install
.github/workflows/release.yml сборка zip по тегу v*
```

---

## Как это работает

Millennium грузит `.millennium/Dist/webkit.js` в контекст страниц Steam с `Page.setBypassCSP`, поэтому скрипт работает даже там, где CSP магазина запрещает сторонние `<script>` (например, в китайском регионе Steam).

Скрипт: берёт курсы через [currency-api](https://github.com/fawazahmed0/exchange-api) (3 зеркала, кеш в `localStorage`) → определяет валюту аккаунта → сканирует ценовые элементы (+ MutationObserver) → на `/cart` и `/checkout` дополнительно ищет «листовые» элементы с ценой → дописывает `≈ N <валюта>`.

---

## Благодарности

- Оригинальный плагин — [KuroKim](https://github.com/KuroKim/steam-currency-to-rub).
- Исходный userscript — [CJMAXiK](https://gist.github.com/cjmaxik/7ce493d08958eecd56a78c01482e49fa) (MIT).
- Курсы валют — [@fawazahmed0/exchange-api](https://github.com/fawazahmed0/exchange-api).

Не связано с Valve и Millennium / Steambrew. Неофициальный плагин. Лицензия MIT.
