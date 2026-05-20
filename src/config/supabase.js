const { createClient } = require("@supabase/supabase-js");
const storage = require("./storage.config");

const supabase = createClient(storage.supabaseUrl, storage.supabaseServiceRoleKey);

module.exports = { supabase };
