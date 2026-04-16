/**
 * Validates that a value is a non-empty string.
 * @param {*} value
 * @returns {boolean}
 */
const isNonEmptyString = (value) =>
  typeof value === "string" && value.trim().length > 0;

/**
 * Validates an email address format.
 * @param {*} email
 * @returns {boolean}
 */
const isValidEmail = (email) =>
  typeof email === "string" &&
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

/**
 * Validates a phone number (7+ digits, allows +, -, spaces, parentheses).
 * @param {*} phone
 * @returns {boolean}
 */
const isValidPhone = (phone) =>
  typeof phone === "string" &&
  /^[0-9+\-\s()]{7,}$/.test(phone);

module.exports = { isNonEmptyString, isValidEmail, isValidPhone };