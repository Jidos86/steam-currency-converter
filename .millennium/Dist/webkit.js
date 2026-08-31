/**
 * Steam Currency to RUB — webkit module (Millennium).
 *
 * Hand-authored, no build step: Millennium loads this file directly for
 * loose-file plugins from `.millennium/Dist/webkit.js` and injects it into
 * Steam page contexts with Page.setBypassCSP, so it works even where the
 * store's CSP would block an external <script> (e.g. Steam China).
 *
 * Only DOM APIs + textContent are used to render the RUB hint — no innerHTML,
 * no eval, no remote code. Network access is limited to public exchange-rate
 * JSON endpoints listed in fetchRates().
 *
 * Fork of https://github.com/KuroKim/steam-currency-to-rub (MIT).
 */
(() => {
    'use strict';

    const HOST = String(location.hostname || '').toLowerCase();
    if (HOST !== 'store.steampowered.com' && HOST !== 'steamcommunity.com') {
        return;
    }

    const CACHE_KEY = 'steam_currency_to_rub_rates_v2';
    const CACHE_TIMEOUT_KEY = 'steam_currency_to_rub_timeout_v2';
    const CACHE_MS = 6 * 60 * 60 * 1000; // 6 hours

    // Полный список валют кошелька Steam: id -> { abbr, symbol }.
    // symbol используется только как запасной способ детекта (основной — по id кошелька).
    const steamCurrencies = [
        { id: 1,  abbr: 'USD', symbol: '$' },
        { id: 2,  abbr: 'GBP', symbol: '£' },
        { id: 3,  abbr: 'EUR', symbol: '€' },
        { id: 4,  abbr: 'CHF', symbol: 'CHF' },
        { id: 5,  abbr: 'RUB', symbol: '₽' },
        { id: 6,  abbr: 'PLN', symbol: 'zł' },
        { id: 7,  abbr: 'BRL', symbol: 'R$' },
        { id: 8,  abbr: 'JPY', symbol: '¥' },
        { id: 9,  abbr: 'NOK', symbol: 'kr' },
        { id: 10, abbr: 'IDR', symbol: 'Rp' },
        { id: 11, abbr: 'MYR', symbol: 'RM' },
        { id: 12, abbr: 'PHP', symbol: '₱' },
        { id: 13, abbr: 'SGD', symbol: 'S$' },
        { id: 14, abbr: 'THB', symbol: '฿' },
        { id: 15, abbr: 'VND', symbol: '₫' },
        { id: 16, abbr: 'KRW', symbol: '₩' },
        { id: 17, abbr: 'TRY', symbol: 'TL' },
        { id: 18, abbr: 'UAH', symbol: '₴' },
        { id: 19, abbr: 'MXN', symbol: 'Mex$' },
        { id: 20, abbr: 'CAD', symbol: 'CDN$' },
        { id: 21, abbr: 'AUD', symbol: 'A$' },
        { id: 22, abbr: 'NZD', symbol: 'NZ$' },
        { id: 23, abbr: 'CNY', symbol: '¥' },
        { id: 24, abbr: 'INR', symbol: '₹' },
        { id: 25, abbr: 'CLP', symbol: 'CLP$' },
        { id: 26, abbr: 'PEN', symbol: 'S/.' },
        { id: 27, abbr: 'COP', symbol: 'COL$' },
        { id: 28, abbr: 'ZAR', symbol: 'R' },
        { id: 29, abbr: 'HKD', symbol: 'HK$' },
        { id: 30, abbr: 'TWD', symbol: 'NT$' },
        { id: 31, abbr: 'SAR', symbol: 'SR' },
        { id: 32, abbr: 'AED', symbol: 'AED' },
        { id: 33, abbr: 'SEK', symbol: 'kr' },
        { id: 34, abbr: 'ARS', symbol: 'ARS$' },
        { id: 35, abbr: 'ILS', symbol: '₪' },
        { id: 36, abbr: 'BYN', symbol: 'Br' },
        { id: 37, abbr: 'KZT', symbol: '₸' },
        { id: 38, abbr: 'KWD', symbol: 'KD' },
        { id: 39, abbr: 'QAR', symbol: 'QR' },
        { id: 40, abbr: 'CRC', symbol: '₡' },
        { id: 41, abbr: 'UYU', symbol: '$U' },
    ];

    // Отличительные символы для эвристики "в этом тексте есть цена".
    // Только многосимвольные / уникальные знаки, чтобы не ловить обычный текст.
    const signToCurrency = {
        'ARS$': 'ARS',
        'Mex$': 'MXN',
        'CDN$': 'CAD',
        'COL$': 'COP',
        'CLP$': 'CLP',
        'NT$': 'TWD',
        'HK$': 'HKD',
        'NZ$': 'NZD',
        'S$': 'SGD',
        'A$': 'AUD',
        'R$': 'BRL',
        '$U': 'UYU',
        'RM': 'MYR',
        'Rp': 'IDR',
        'CHF': 'CHF',
        'zł': 'PLN',
        '₸': 'KZT',
        'TL': 'TRY',
        '₺': 'TRY',
        '€': 'EUR',
        '£': 'GBP',
        '₴': 'UAH',
        '₹': 'INR',
        '₪': 'ILS',
        '₩': 'KRW',
        '฿': 'THB',
        '₫': 'VND',
        '₱': 'PHP',
        '₡': 'CRC',
        '¥': 'CNY',
        '$': 'USD',
    };

    const SELECTORS = [
        '#header_wallet_balance',
        'div[class*=StoreSalePriceBox]',
        '.game_purchase_price',
        '.discount_final_price',
        '.discount_final_price > div:not([class])',
        '.search_price',
        '.price',
        '.match_subtitle',
        '.game_area_dlc_price',
        '.savings.bundle_savings',
        '.wallet_column',
        '.wht_total',
        '.normal_price',
        '.sale_price',
        '.StoreSalePriceWidgetContainer:not(.Discounted) div',
        '.StoreSalePriceWidgetContainer.Discounted div:nth-child(2) > div:nth-child(2)',
        '#marketWalletBalanceAmount',
        '.market_commodity_order_summary > span:nth-child(2)',
        '.market_commodity_orders_table tr > td:first-child',
        '.market_listing_price_with_fee',
        '.market_activity_price',
        '.item_market_actions > div > div:nth-child(2)',
        // Корзина / оформление заказа
        '.cart_area_summary_final_price',
        '#cart_estimated_total',
        '#cart_total_wrapper',
        '#total_original',
        '#total_after_discounts',
        '#gift_or_wallet_new_total',
        '#accountBalanceAmount',
        '.checkout_content .price',
        '#cart_item_list .price',
        'div[class*=EstimatedTotal]',
        'div[class*=SubtotalRow] > div:last-child',
        'div[class*=CheckoutSummary] div[class*=Price]'
    ].map((x) => `${x}:not([data-steam-rub-done="1"])`).join(', ');

    // Пути, где вёрстка цен нестандартная (React-корзина) — добавочный проход по «листьям».
    const EXTRA_SCAN_PATHS = ['/cart', '/checkout'];

    let sourceCurrency = null;
    let sourceCurrencySign = null;
    let rubRate = null;
    let observerStarted = false;
    let injectScheduled = false;

    function log(...args) {
        console.log('[Steam Currency to RUB]', ...args);
    }

    function findCurrencyById(id) {
        return steamCurrencies.find((item) => item.id === id) || null;
    }

    function makeSpan(className, text) {
        const span = document.createElement('span');
        span.className = className;
        span.textContent = text;
        return span;
    }

    function addStyles() {
        if (document.getElementById('steam-currency-to-rub-style')) return;

        const style = document.createElement('style');
        style.id = 'steam-currency-to-rub-style';
        style.textContent = `
            .steam-rub-original {
                font-size: 11px;
            }

            .steam-rub-block {
                padding-left: 5px;
                white-space: nowrap;
                opacity: 0.92;
            }

            .steam-rub-inline {
                white-space: nowrap;
                opacity: 0.92;
            }

            .tab_item_discount { width: 160px !important; }
            .tab_item_discount .discount_prices { width: 100% !important; }
            .tab_item_discount .discount_final_price { padding: 0 !important; }
            .home_marketing_message.small .discount_block { height: auto !important; }
            .discount_block_inline { white-space: nowrap !important; }
            .curator #RecommendationsRows .store_capsule.price_inline .discount_block { min-width: 200px !important; }
            .market_listing_their_price { min-width: 130px !important; }
        `;
        document.head.appendChild(style);
    }

    function safeParseJSON(value) {
        try {
            return JSON.parse(value);
        } catch {
            return null;
        }
    }

    async function fetchRates() {
        const sources = [
            `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/rub.json?${Math.random()}`,
            `https://latest.currency-api.pages.dev/v1/currencies/rub.json?${Math.random()}`,
            `https://raw.githubusercontent.com/fawazahmed0/exchange-api/main/latest/currencies/rub.json?${Math.random()}`
        ];

        let lastError = null;

        for (const url of sources) {
            try {
                const response = await fetch(url, { cache: 'no-store' });
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status} for ${url}`);
                }

                const data = await response.json();

                localStorage.setItem(CACHE_KEY, JSON.stringify(data));
                localStorage.setItem(CACHE_TIMEOUT_KEY, String(Date.now() + CACHE_MS));

                return data;
            } catch (error) {
                lastError = error;
            }
        }

        throw lastError || new Error('Failed to fetch rates');
    }

    async function getRates() {
        const timeout = Number(localStorage.getItem(CACHE_TIMEOUT_KEY) || 0);
        const cache = safeParseJSON(localStorage.getItem(CACHE_KEY));
        const rateDate = cache && cache.date ? Date.parse(cache.date) : 0;

        if (
            !cache ||
            !timeout ||
            timeout <= Date.now() ||
            !rateDate ||
            rateDate + 24 * 60 * 60 * 1000 <= Date.now()
        ) {
            try {
                return await fetchRates();
            } catch (error) {
                if (cache) {
                    log('using stale cached rates:', error);
                    return cache;
                }
                throw error;
            }
        }

        return cache;
    }

    function detectCurrencyFromMeta() {
        const meta = document.querySelector('meta[itemprop="priceCurrency"]');
        if (meta && meta.content) {
            const abbr = String(meta.content).trim().toUpperCase();
            if (abbr.length === 3) {
                const match = steamCurrencies.find((c) => c.abbr === abbr);
                return { abbr, sign: match ? match.symbol : null };
            }
        }
        return null;
    }

    function detectCurrencyFromWallet() {
        try {
            if (
                typeof g_rgWalletInfo !== 'undefined' &&
                g_rgWalletInfo &&
                g_rgWalletInfo.wallet_currency != null
            ) {
                const currency = findCurrencyById(Number(g_rgWalletInfo.wallet_currency));
                if (currency) {
                    return { abbr: currency.abbr, sign: currency.symbol };
                }
            }
        } catch (error) {
            log('wallet detect failed', error);
        }

        return null;
    }

    function detectCurrencyFromFormatter() {
        try {
            if (
                typeof GStoreItemData !== 'undefined' &&
                GStoreItemData &&
                typeof GStoreItemData.fnFormatCurrency === 'function'
            ) {
                const formatted = String(GStoreItemData.fnFormatCurrency(12345));
                // Убираем цифры, пробелы и разделители — остаётся чистый символ валюты.
                const sign = formatted.replace(/[\d\s .,'’]+/g, '').trim();

                if (sign) {
                    const abbr =
                        signToCurrency[sign] ||
                        (steamCurrencies.find((c) => c.symbol === sign) || {}).abbr ||
                        null;
                    if (abbr) {
                        return { abbr, sign };
                    }
                }
            }
        } catch (error) {
            log('formatter detect failed', error);
        }

        return null;
    }

    function detectCurrentCurrency() {
        if (sourceCurrency) {
            return { abbr: sourceCurrency, sign: sourceCurrencySign };
        }

        return (
            detectCurrencyFromMeta() ||
            detectCurrencyFromWallet() ||
            detectCurrencyFromFormatter() ||
            null
        );
    }

    function formatRub(value) {
        return new Intl.NumberFormat('ru-RU', {
            maximumFractionDigits: 0
        }).format(Math.ceil(value)) + ' ₽';
    }

    function textContainsSupportedCurrency(text) {
        if (!text) return false;
        if (sourceCurrencySign && text.includes(sourceCurrencySign)) return true;
        return Object.keys(signToCurrency).some((sign) => text.includes(sign));
    }

    function alreadyConverted(element) {
        const text = element.innerText || element.textContent || '';
        return (
            element.getAttribute('data-steam-rub-done') === '1' ||
            (text.includes('≈') && text.includes('₽'))
        );
    }

    function shouldSkip(element) {
        if (!(element instanceof HTMLElement)) return true;
        if (alreadyConverted(element)) return true;

        const classList = String(element.className || '');

        if (classList.includes('discount_original_price')) return true;
        if (classList.includes('es-regprice') || classList.includes('es-converted')) return true;
        if (classList.includes('your_price_label')) return true;
        if (classList.includes('spotlight_body') || classList.includes('similar_grid_price')) return true;
        if (classList.includes('market_table_value')) return true;

        const ownText = element.innerText || element.textContent || '';
        const parentText = element.parentElement ? (element.parentElement.innerText || element.parentElement.textContent || '') : '';

        return !textContainsSupportedCurrency(ownText) && !textContainsSupportedCurrency(parentText);
    }

    // Универсальный разбор числа: работает и с "1,234.56" (US/UK), и с "1.234,56" (EU),
    // и с "1 234" (без дробной части). Последний по позиции разделитель считается десятичным,
    // если после него 1-2 цифры.
    function parseNumeric(raw) {
        let s = String(raw).replace(/[^0-9.,]/g, '');
        if (!s) return null;

        const lastComma = s.lastIndexOf(',');
        const lastDot = s.lastIndexOf('.');
        let decSep = null;

        if (lastComma > -1 && lastDot > -1) {
            decSep = lastComma > lastDot ? ',' : '.';
        } else if (lastComma > -1) {
            const digitsAfter = s.length - lastComma - 1;
            if (s.indexOf(',') === lastComma && (digitsAfter === 1 || digitsAfter === 2)) {
                decSep = ',';
            }
        } else if (lastDot > -1) {
            const digitsAfter = s.length - lastDot - 1;
            if (s.indexOf('.') === lastDot && (digitsAfter === 1 || digitsAfter === 2)) {
                decSep = '.';
            }
        }

        if (decSep) {
            const thouSep = decSep === ',' ? '.' : ',';
            s = s.split(thouSep).join('').replace(decSep, '.');
        } else {
            s = s.replace(/[.,]/g, '');
        }

        const value = Number(s);
        return Number.isFinite(value) && value > 0 ? value : null;
    }

    function parsePrice(element) {
        if (element.dataset && element.dataset.priceFinal) {
            const value = Number(element.dataset.priceFinal) / 100;
            return Number.isFinite(value) && value > 0 ? value : null;
        }

        const clone = element.cloneNode(true);

        // Убираем strike/старую цену, если она внутри
        const strikes = clone.querySelectorAll('strike');
        for (const strike of strikes) {
            strike.remove();
        }

        const line = (clone.innerText || clone.textContent || '')
            .trim()
            .split(/\r?\n|\r|\n/g)[0];

        return parseNumeric(line);
    }

    function injectPrice(element, forceInline = false) {
        if (shouldSkip(element)) return;
        if (!sourceCurrency || !rubRate) return;

        const price = parsePrice(element);
        if (!price) return;

        const convertedText = `≈${formatRub(price / rubRate)}`;

        let inline = forceInline;

        const classList = String(element.className || '');
        if (
            element.id === 'marketWalletBalanceAmount' ||
            classList.includes('market_listing_price_with_fee') ||
            classList.includes('market_activity_price')
        ) {
            inline = true;
        }

        if (
            element.parentElement &&
            element.parentElement.parentElement &&
            String(element.parentElement.parentElement.className || '').includes('item_market_actions')
        ) {
            inline = true;
        }

        // Только DOM API + textContent — никакого innerHTML.
        if (inline) {
            element.append(' ', makeSpan('steam-rub-inline', `(${convertedText})`));
        } else {
            const originalText = (element.textContent || '').replace('ARS$ ', '$').trim();
            element.textContent = '';
            element.append(
                makeSpan('steam-rub-original', originalText),
                makeSpan('steam-rub-block', convertedText)
            );
        }

        element.setAttribute('data-steam-rub-done', '1');
    }

    // На /cart и /checkout цены в React-вёрстке лежат в div'ах без стабильных классов.
    // Ищем «листовые» элементы, чей текст — это ровно цена в валюте аккаунта.
    function scanLooseCartPrices(root) {
        if (!sourceCurrencySign) return;
        if (!EXTRA_SCAN_PATHS.some((p) => location.pathname.startsWith(p))) return;

        const sign = sourceCurrencySign;
        const walker = document.createTreeWalker(
            root && root.nodeType === 1 ? root : document.body,
            NodeFilter.SHOW_ELEMENT
        );

        const targets = [];
        let node = walker.currentNode;

        while (node) {
            if (
                node.childElementCount === 0 &&
                !node.hasAttribute('data-steam-rub-done')
            ) {
                const text = (node.textContent || '').trim();

                if (
                    text.length > 0 &&
                    text.length <= 24 &&
                    text.includes(sign) &&
                    /\d/.test(text) &&
                    !/[A-Za-zА-Яа-яЁё]{3,}/.test(text.split(sign).join(' '))
                ) {
                    targets.push(node);
                }
            }
            node = walker.nextNode();
        }

        for (const el of targets) {
            try {
                injectPrice(el, true);
            } catch (error) {
                log('cart inject error', error, el);
            }
        }
    }

    function runInjection(root = document) {
        if (!sourceCurrency || !rubRate) return;

        const prices = root.querySelectorAll(SELECTORS);
        for (const priceNode of (prices || [])) {
            try {
                injectPrice(priceNode);
            } catch (error) {
                log('inject error', error, priceNode);
            }
        }

        scanLooseCartPrices(root);
    }

    function scheduleInjection() {
        if (injectScheduled) return;
        injectScheduled = true;

        requestAnimationFrame(() => {
            injectScheduled = false;
            runInjection(document);
        });
    }

    function startObserver() {
        if (observerStarted || !document.body) return;

        observerStarted = true;

        const observer = new MutationObserver(() => {
            scheduleInjection();
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        // Повторный пинок на лениво дорисованные блоки
        setTimeout(scheduleInjection, 1000);
        setTimeout(scheduleInjection, 2500);
    }

    async function main() {
        try {
            addStyles();

            const rates = await getRates();
            const detected = detectCurrentCurrency();

            sourceCurrency = detected ? detected.abbr : null;
            sourceCurrencySign = detected ? detected.sign : null;

            log('detected currency:', sourceCurrency, 'sign:', sourceCurrencySign);

            if (!sourceCurrency) {
                throw new Error('No source currency detected');
            }

            if (sourceCurrency === 'RUB') {
                log('Already RUB, nothing to do');
                return;
            }

            const rawRate = rates && rates.rub ? rates.rub[sourceCurrency.toLowerCase()] : null;
            if (!rawRate || !Number.isFinite(rawRate)) {
                throw new Error(`Rate not found for ${sourceCurrency}`);
            }

            // Полная точность: округление до 2 знаков ломало валюты с курсом < 1
            // (USD, EUR, GBP, CNY и т.п.) — ошибка достигала десятков процентов.
            rubRate = Math.round(rawRate * 1e8) / 1e8;
            log('effective rate:', rubRate);

            runInjection(document);
            startObserver();
        } catch (error) {
            log('fatal error', error);
        }
    }

    if (document.readyState === 'loading') {
        window.addEventListener('DOMContentLoaded', main, { once: true });
    } else {
        main();
    }
})();
