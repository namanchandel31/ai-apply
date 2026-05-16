const { NotFoundError } = require("./errors");

/**
 * Assert that a fetched resource is non-null.
 *
 * Ownership is enforced at the query level (user_id in WHERE clause).
 * A null result therefore means: not found OR not owned by this user.
 * Both cases map to HTTP 404 — no existence leakage via 403.
 *
 * @param {any} resource - Result of a DB fetch (null if missing/unauthorized).
 * @param {object} [context] - Extra fields for structured logging (e.g. resourceType, resourceId).
 * @returns {any} The resource, if non-null.
 * @throws {NotFoundError} If resource is null or undefined.
 *
 * @example
 * const application = requireResource(
 *   await getApplicationById(id, userId),
 *   { resourceType: "application", resourceId: id }
 * );
 */
const requireResource = (resource, context = {}) => {
  if (resource == null) {
    throw new NotFoundError({ message: "Resource not found", ...context });
  }
  return resource;
};

module.exports = { requireResource };
