# Steam Currency Converter

Плагин для [Millennium](https://steambrew.app): показывает **примерную цену в выбранной валюте** рядом с любой ценой Steam — в магазине, корзине, оформлении заказа, на странице сообщества и в игровом оверлее.

> Это приблизительная конвертация по биржевому курсу, а **не** официальная региональная цена Steam.

![Steam Currency Converter в магазине Steam](docs/demo.png)

Форк [KuroKim/steam-currency-to-rub](https://github.com/KuroKim/steam-currency-to-rub).

---

## Возможности

- **выбор целевой валюты** в настройках плагина (Millennium → Settings → Plugins → Steam Currency Converter); по умолчанию RUB;
- определяет валюту аккаунта автоматически (по id кошелька Steam → schema.org → форматтеру магазина);
- поддерживает все 40 валют кошелька Steam и как исходную, и как целевую
  (USD, EUR, GBP, CHF, PLN, BRL, JPY, NOK, IDR, MYR, PHP, SGD, THB, VND, KRW, TRY,
  UAH, MXN, CAD, AUD, CNY, INR, CLP, PEN, COP, ZAR, HKD, TWD, SAR, AED, SEK, ARS,
  ILS, BYN, KZT, KWD, QAR, CRC, UYU, NZD);
- универсальный разбор цен: `1,234.56`, `1.234,56`, `1 199`, валюты без копеек;
- работает в корзине и оформлении заказа (в т.ч. новый React-интерфейс) и в оверлее;
- курс кешируется на 6 часов, при недоступности сети — прошлый кеш; три источника с автопереключением;
- рендер только через DOM API (`createElement` / `textContent`) — без `innerHTML`, `eval` и удалённого кода.

Смена валюты применяется после перезапуска Steam.

---

## Установка

Нужен установленный [Millennium](https://steambrew.app).

### Одной командой (PowerShell)

```powershell
irm https://raw.githubusercontent.com/Jidos86/steam-currency-converter/main/scripts/web-install.ps1 | iex
```

### Вручную

1. Скачай релизный `steam-currency-converter.zip` (вкладка Releases) — он уже собран.
2. Распакуй в `…\Steam\millennium\plugins\` → `…\plugins\steam-currency-converter\plugin.json`.
3. Millennium → Settings → Plugins → включи **Steam Currency Converter**.
4. Полностью перезапусти Steam.

### Удаление

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\uninstall.ps1
```

---

## Как это работает

Плагин состоит из трёх частей (сборка `@steambrew/ttc`):

| часть | что делает |
|---|---|
| `webkit/` | внедряется в страницы Steam с `Page.setBypassCSP` (поэтому работает даже там, где CSP магазина блокирует сторонние `<script>` — например, в китайском регионе); тянет курсы через [currency-api](https://github.com/fawazahmed0/exchange-api), определяет валюту аккаунта, сканирует ценовые блоки (+ MutationObserver, + отдельный проход по `/cart` и `/checkout`) и дописывает `≈ N <валюта>` |
| `frontend/` | панель настроек с выпадающим списком валют |
| `backend/main.lua` | хранит выбранную валюту (`millennium.config`) и отдаёт её webkit-модулю и панели через `callable` |

---

## Разработка

```bash
npm install
npm run build      # millennium-ttc → .millennium/Dist/{index.js,webkit.js}
npm run typecheck
```

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\dev-link.ps1   # симлинк репо в папку плагинов Millennium
```

```text
plugin.json                  манифест Millennium
frontend/index.tsx           панель настроек
webkit/index.tsx             конвертер (внедряется в страницы Steam)
backend/main.lua             хранение выбранной валюты
scripts/                     install / uninstall / dev-link / web-install
.github/workflows/ci.yml     typecheck → build → luaparse → zip (релиз по тегу v*)
```

`.millennium/` и `node_modules/` — сборка, в git не хранятся.

---

## Благодарности

- Оригинальный плагин — [KuroKim](https://github.com/KuroKim/steam-currency-to-rub).
- Исходный userscript — [CJMAXiK](https://gist.github.com/cjmaxik/7ce493d08958eecd56a78c01482e49fa) (MIT).
- Курсы валют — [@fawazahmed0/exchange-api](https://github.com/fawazahmed0/exchange-api).

Не связано с Valve и Millennium / Steambrew. Неофициальный плагин. Лицензия MIT.
