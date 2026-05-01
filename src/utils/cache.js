/**
 * In-memory cache layer abstraction with TTL.
 * 
 * Supports get, set, delete operations.
 * Map values are { data, expiresAt }.
 */

const cacheStore = new Map();
const DEFAULT_TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Retrieve data from cache. Deletes and returns null if expired.
 * @param {string} key 
 * @returns {any|null}
 */
const getCache = (key) => {
  if (!cacheStore.has(key)) return null;

  const entry = cacheStore.get(key);
  if (Date.now() > entry.expiresAt) {
    cacheStore.delete(key);
    return null;
  }

  return entry.data;
};

/**
 * Set data in cache with a TTL.
 * @param {string} key 
 * @param {any} data 
 * @param {number} ttlMs 
 */
const setCache = (key, data, ttlMs = DEFAULT_TTL_MS) => {
  const expiresAt = Date.now() + ttlMs;
  cacheStore.set(key, { data, expiresAt });
};

/**
 * Delete a specific key from cache.
 * @param {string} key 
 */
const deleteCache = (key) => {
  cacheStore.delete(key);
};

module.exports = {
  getCache,
  setCache,
  deleteCache
};
