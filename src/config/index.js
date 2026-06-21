const { validateStartup } = require("./env");

validateStartup();

const server = require("./server.config");
const database = require("./database.config");
const redis = require("./redis.config");
const queue = require("./queue.config");
const ai = require("./ai.config");
const auth = require("./auth.config");
const supabaseAuth = require("./supabaseAuth.config");
const google = require("./google.config");
const mail = require("./mail.config");
const logging = require("./logging.config");
const storage = require("./storage.config");
const product = require("./product.config");
const realtime = require("./realtime.config");
const runtime = require("./runtime.config");
const cors = require("./cors.config");
const billing = require("./billing.config");

const config = Object.freeze({
  server,
  database,
  redis,
  queue,
  ai,
  auth,
  supabaseAuth,
  google,
  mail,
  logging,
  storage,
  product,
  realtime,
  runtime,
  cors,
  billing,
});

module.exports = config;
