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
    return json.encode({ target_currency = current_target() })
end

--- Written by the settings panel. `currency` is an ISO 4217 code.
function set_target_currency(currency)
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

return {
    on_load = on_load,
    on_unload = on_unload,
}
