local millennium = require("millennium")
local json = require("json")
local logger = require("logger")

local DEFAULT_TARGET = "RUB"

local function current_target()
    local target = millennium.config.get("target_currency")
    if type(target) ~= "string" or target == "" then
        return DEFAULT_TARGET
    end
    return string.upper(target)
end

--- Read by the webkit module and the settings panel.
function get_settings()
    local source = millennium.config.get("rate_source")
    return json.encode({
        target_currency = current_target(),
        rate_source = source == "freedom_bank" and "freedom_bank" or "currency_api",
    })
end

function set_rate_source(source)
    if type(source) == "table" then
        source = source.source
    end
    if source == "currency_api" or source == "freedom_bank" then
        millennium.config.set("rate_source", source)
    end
    return get_settings()
end

--- Written by the settings panel. Accepts a 3-letter ISO 4217 code as a bare
--- string or as a table `{ currency = "USD" }`.
function set_target_currency(currency)
    if type(currency) == "table" then
        currency = currency.currency
    end
    if type(currency) == "string" and currency:match("^%a%a%a$") then
        millennium.config.set("target_currency", string.upper(currency))
        logger:info("Steam Currency Converter: target currency set to " .. string.upper(currency))
    else
        logger:warn("Steam Currency Converter: ignored invalid currency " .. tostring(currency))
    end
    return get_settings()
end

local function on_load()
    logger:info("Steam Currency Converter: backend loaded")
    millennium.ready()
end

local function on_unload()
    logger:info("Steam Currency Converter: backend unloaded")
end

local wallet_balance = [[(\w+)=(\(0,\w+\.\w+\)\(\))\.GetCurrentUser\(\)\.strAccountBalance,(\w+=\(0,\w+\.\w+\)\(\)\.GetCurrentUser\(\)\.strAccountBalancePending);return (\w+\?\.length>0\?\(0,)(\w+\.jsx)(\)\("div",\{className:\w+\(\)\.WalletBalance,children:)(\(0,\w+\.\w+\)\("#WalletPendingBalance",\w+,\w+\))(\}\):\w+\?\.length>0\?\(0,\w+\.jsx\)\("div",\{className:\w+\(\)\.WalletBalance,children:)\w+]]

return {
    on_load = on_load,
    on_unload = on_unload,
    patches = {
        {
            -- Steam renders this component in both the title bar and the account menu.
            file = [[(?:sp|chunk~[0-9a-f]+)\.js]],
            find = wallet_balance,
            transforms = {
                {
                    match = wallet_balance,
                    replace = [[\1=\2.GetCurrentUser().strAccountBalance,\3;const sccRenderWallet=original=>(0,\5)((window.PLUGIN_LIST&&#{{self}}?.walletHooks?.WalletBalance)||(({original})=>original),{original,balance:\1,steamId:\2.GetCurrentUser().strSteamID,client:\2});return \4\5\6(sccRenderWallet(\7))\8(sccRenderWallet(\1))]],
                },
            },
        },
    },
}
