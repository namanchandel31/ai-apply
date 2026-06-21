const crypto = require("crypto");
const config = require("../config");

const ENCRYPTION_KEY = config.auth.encryptionKey;
const ALGORITHM = "aes-256-cbc";
const GCM_ALGORITHM = "aes-256-gcm";
// Marker prefix so decryptSecret can tell GCM payloads apart from legacy CBC ones.
const GCM_PREFIX = "gcm:";

if (!ENCRYPTION_KEY) {
  throw new Error("ENCRYPTION_KEY environment variable is required");
}

function keyBuffer() {
  return Buffer.from(ENCRYPTION_KEY, "hex");
}

function encrypt(text) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, keyBuffer(), iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return `${iv.toString("hex")}:${encrypted}`;
}

function decrypt(encryptedText) {
  const textParts = encryptedText.split(":");
  const iv = Buffer.from(textParts.shift(), "hex");
  const encrypted = textParts.join(":");
  const decipher = crypto.createDecipheriv(ALGORITHM, keyBuffer(), iv);
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

/**
 * Authenticated encryption (AES-256-GCM) for OAuth refresh/access tokens.
 * Tamper-evident via the auth tag. Wire format: "gcm:{iv}:{tag}:{ciphertext}" (hex).
 * Reuses the same ENCRYPTION_KEY as the legacy CBC helpers.
 */
function encryptSecret(text) {
  if (text == null) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(GCM_ALGORITHM, keyBuffer(), iv);
  let encrypted = cipher.update(String(text), "utf8", "hex");
  encrypted += cipher.final("hex");
  const tag = cipher.getAuthTag().toString("hex");
  return `${GCM_PREFIX}${iv.toString("hex")}:${tag}:${encrypted}`;
}

/**
 * Decrypts a value produced by encryptSecret (GCM). Transparently falls back to
 * legacy CBC decrypt for values without the GCM marker, so old ciphertext keeps working.
 */
function decryptSecret(payload) {
  if (payload == null) return null;
  if (!payload.startsWith(GCM_PREFIX)) {
    return decrypt(payload);
  }
  const body = payload.slice(GCM_PREFIX.length);
  const [ivHex, tagHex, encrypted] = body.split(":");
  const decipher = crypto.createDecipheriv(GCM_ALGORITHM, keyBuffer(), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

module.exports = { encrypt, decrypt, encryptSecret, decryptSecret };
