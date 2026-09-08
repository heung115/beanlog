local typedefs = require "kong.db.schema.typedefs"
return {
  name = "beanmap-auth-budgets",
  fields = {
    { consumer = typedefs.no_consumer },
    { protocols = typedefs.protocols_http },
    { config = { type = "record", fields = {
      -- Deliberately fixed: deployments cannot silently weaken the reviewed limits.
      { scale = { type = "integer", default = 1, one_of = { 1 } } },
    } } },
  },
}
