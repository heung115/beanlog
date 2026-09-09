-- Authentication budgets run after key-auth and ACL. No credentials, query
-- strings, or client addresses are written to the application log.
local Handler = { PRIORITY = 900, VERSION = "1.1.1" }
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
local function normalized_auth_endpoint()
  -- Public Caddy rejects noncanonical paths already. Apply the same private
  -- endpoint boundary to gateway peers without trusting any forwarded header.
  local path = kong.request.get_path()
  for _ = 1, 3 do path = ngx.unescape_uri(path) end
  local segments = {}
  for part in path:gmatch("[^/]+") do
    if part == ".." then table.remove(segments)
    elseif part ~= "." then segments[#segments + 1] = part end
  end
  path = "/" .. table.concat(segments, "/")
  return path:match("^/auth/v1/([^/]+)")
end
function Handler:access(conf)
  -- This header is an internal identity, never a caller-controlled bypass.
  local ip = kong.client.get_forwarded_ip()
  kong.service.request.set_header("X-Beanmap-Auth-Rate-Identity", "public:" .. ip)
  -- Account deletion uses its authenticated Go handler -> Auth:9999 directly;
  -- there is deliberately no caller-controlled gateway exception for OTP.
  local endpoint = normalized_auth_endpoint()
  local trusted_web = kong.client.get_ip() == conf.signup_source_ip
      and kong.request.get_header("X-Beanmap-Auth-Client-IP") ~= nil
  if endpoint == "otp" or endpoint == "magiclink" or endpoint == "resend" then
    return kong.response.exit(404, { message = "Not found" }, { ["Cache-Control"] = "no-store" })
  end
  -- Signup and password recovery use the verified Next server's socket peer,
  -- never the forwarded client identity. Signup additionally uses a DB HMAC.
  if (endpoint == "signup" or endpoint == "recover") and not trusted_web then
    return kong.response.exit(404, { message = "Not found" })
  end
  if endpoint == "token" and not trusted_web then
    local method = kong.request.get_method()
    local content_type = (kong.request.get_header("Content-Type") or ""):lower()
    local json = content_type == "application/json" or content_type:match("^application/json%s*;") ~= nil
    -- Match Auth's FormValue precedence: rejecting form/multipart input is
    -- required even when the query claims refresh_token. Duplicate/encoded
    -- query keys are deliberately not an alternate public grant spelling.
    if ngx.var.args ~= "grant_type=refresh_token" or (method ~= "POST" and method ~= "OPTIONS")
        or (method ~= "OPTIONS" and not json) then
      return kong.response.exit(404, { message = "Not found" }, { ["Cache-Control"] = "no-store" })
    end
  end
  if kong.request.get_method() == "OPTIONS" then return end
  local dict = ngx.shared.beanmap_auth_budgets
  if not dict then return kong.response.exit(503, { message = "Authentication temporarily unavailable" }) end
  local operation = category()
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
