-- Authentication budgets run after key-auth and ACL. No credentials, query
-- strings, or client addresses are written to the application log.
local Handler = { PRIORITY = 900, VERSION = "1.1.0" }
local limits = {
  user_read = 600, user_write = 30, password = 60, refresh = 120,
  signup = 10, recover = 10, otp = 10, verify = 30, logout = 30,
  authorize = 60, callback = 60, other = 60, admin = 300,
}
local function category()
  local path = kong.request.get_path():gsub("/+", "/"):gsub("/$", "")
  local method = kong.request.get_method()
  if path:match("^/auth/v1/admin/") or path == "/auth/v1/admin" then return "admin" end
  if path == "/auth/v1/user" then return method == "GET" and "user_read" or "user_write" end
  if path == "/auth/v1/token" then
    local args = kong.request.get_query()
    return args.grant_type == "refresh_token" and "refresh" or "password"
  end
  local name = path:match("^/auth/v1/([%a]+)$")
  return limits[name] and name or "other"
end
function Handler:access(conf)
  -- This header is an internal identity, never a caller-controlled bypass.
  local ip = kong.client.get_forwarded_ip()
  kong.service.request.set_header("X-Beanmap-Auth-Rate-Identity", "public:" .. ip)
  if kong.request.get_method() == "OPTIONS" then return end
  local dict = ngx.shared.beanmap_auth_budgets
  if not dict then return kong.response.exit(503, { message = "Authentication temporarily unavailable" }) end
  local operation = category()
  -- The signup gate uses the socket peer, never the forwarded client identity.
  -- A DB HMAC assertion additionally binds the exact email and consent event.
  if operation == "signup" and (kong.client.get_ip() ~= conf.signup_source_ip
      or not kong.request.get_header("X-Beanmap-Auth-Client-IP")) then
    return kong.response.exit(404, { message = "Not found" })
  end
  if operation == "admin" then
    local consumer = kong.client.get_consumer()
    if not consumer or consumer.username ~= "service_role" then
      return kong.response.exit(403, { message = "Access is forbidden" })
    end
  end
  local minute = math.floor(ngx.now() / 60)
  local retry = 60 - math.floor(ngx.now() % 60)
  local function charge(scope, identity, maximum)
    local key = minute .. ":" .. scope .. ":" .. identity
    -- safe_add must never evict another client's active counter under pressure.
    local ok, err = dict:safe_add(key, 0, 125)
    if not ok and err ~= "exists" then
      kong.log.err("beanmap_auth_budget unavailable scope=", scope)
      return kong.response.exit(503, { message = "Authentication temporarily unavailable" }, { ["Retry-After"] = tostring(retry) })
    end
    local count = dict:incr(key, 1)
    if not count then return kong.response.exit(503, { message = "Authentication temporarily unavailable" }) end
    if count > maximum then
      if count == maximum + 1 or (count - maximum) % 50 == 0 then
        kong.log.warn("beanmap_auth_budget denied operation=", operation, " scope=", scope,
          " denied_in_window=", count - maximum)
      end
      return kong.response.exit(429, { message = "Rate limit exceeded" }, { ["Retry-After"] = tostring(retry), ["Cache-Control"] = "no-store" })
    end
  end
  -- Rejected traffic stops here before spending the shared capacity. An IP
  -- can use at most 900 of the public 9000/minute capacity, across all routes.
  charge("operation-" .. operation, ip, limits[operation] * conf.scale)
  if operation == "admin" then
    charge("admin-total", "all", 1200 * conf.scale)
  else
    charge("client-total", ip, 900 * conf.scale)
    charge("public-total", "all", 9000 * conf.scale)
  end
end
return Handler
