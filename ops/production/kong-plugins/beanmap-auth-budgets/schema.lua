local typedefs = require "kong.db.schema.typedefs"
return {
  name = "beanmap-auth-budgets",
  fields = {
    { consumer = typedefs.no_consumer },
    { protocols = typedefs.protocols_http },
    { config = { type = "record", fields = {
      -- Deliberately fixed: deployments cannot silently weaken the reviewed limits.
      { signup_source_ip = { type = "string", default = "127.0.0.255" } },
      { scale = { type = "integer", default = 1, one_of = { 1 } } },
    } } },
  },
}
