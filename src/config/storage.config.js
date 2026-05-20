const { str } = require("./env");

module.exports = {
  supabaseUrl: str("SUPABASE_URL", null),
  supabaseServiceRoleKey: str("SUPABASE_SERVICE_ROLE_KEY", null),
};
