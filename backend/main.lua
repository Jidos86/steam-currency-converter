local millennium = require("millennium")
local json = require("json")
local logger = require("logger")

local DEFAULT_TARGET = "RUB"

--- Exposed to the webkit module via `callable("get_settings")`.
--- Returns the chosen target currency (falls back to RUB).
function get_settings()
    local target = millennium.config.get("target_currency")
    if type(target) ~= "string" or target == "" then
        target = DEFAULT_TARGET
    end
    return json.encode({ target_currency = string.upper(target) })
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
