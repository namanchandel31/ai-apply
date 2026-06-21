/**
 * Provider registry — maps a provider key to its EmailProvider implementation.
 * Lazily instantiated singletons. New providers (outlook, m365) plug in here
 * without touching application code.
 */
const instances = new Map();

function buildProvider(name) {
  switch (name) {
    case "gmail": {
      const { GmailProvider } = require("./providers/GmailProvider");
      return new GmailProvider();
    }
    case "smtp": {
      const { SmtpProvider } = require("./providers/SmtpProvider");
      return new SmtpProvider();
    }
    default:
      throw new Error(`Unknown email provider: ${name}`);
  }
}

function getProvider(name) {
  if (!instances.has(name)) {
    instances.set(name, buildProvider(name));
  }
  return instances.get(name);
}

module.exports = { getProvider };
