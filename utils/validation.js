/**
 * utils/validation.js — small, dependency-free validators.
 *
 * The same rules are reused everywhere so they can never drift apart:
 *   • models/          → Mongoose schema validation
 *   • controllers/     → query-string / body checks (nicer messages)
 *   • seed.js          → guarantees the seed data is valid before inserting
 */

// Deliberately simple, readable patterns instead of a validation library.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/;
const PHONE_REGEX = /^\+?[0-9(][0-9\s\-().]{6,19}$/; // +92 300 1234567, (021) 3456 7890, 0300-1234567 …
const URL_REGEX = /^https?:\/\/[^\s/$.?#][^\s]*$/i;
const OBJECT_ID_REGEX = /^[0-9a-fA-F]{24}$/; // a Mongo ObjectId is exactly 24 hex chars

const MIN_FOUNDED_YEAR = 1800;
const CURRENT_YEAR = new Date().getFullYear();

/**
 * @param {unknown} value
 * @returns {boolean} true when value is a string containing real characters
 */
function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * @param {unknown} value
 * @returns {boolean} true for a plausible e-mail address
 */
function isValidEmail(value) {
  return isNonEmptyString(value) && EMAIL_REGEX.test(value.trim());
}

/**
 * @param {unknown} value
 * @returns {boolean} true for a reasonable phone number (digits, spaces, + ( ) -)
 */
function isValidPhone(value) {
  return isNonEmptyString(value) && PHONE_REGEX.test(value.trim());
}

/**
 * @param {unknown} value
 * @returns {boolean} true for an http:// or https:// URL
 */
function isValidUrl(value) {
  if (!isNonEmptyString(value)) return false;

  const trimmed = value.trim();
  if (!URL_REGEX.test(trimmed)) return false;

  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    // new URL() throws on malformed input such as "https://"
    return false;
  }
}

/**
 * Strict 24-hex check.
 *
 * Why not just mongoose.Types.ObjectId.isValid()? Because that helper also
 * accepts any 12-character string, which would turn an "invalid id" request
 * into a confusing "not found" response.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
function isValidObjectId(value) {
  return typeof value === 'string' && OBJECT_ID_REGEX.test(value.trim());
}

/**
 * @param {unknown} value
 * @returns {boolean} true for a real 4-digit year between 1800 and this year
 */
function isValidFoundedYear(value) {
  return (
    Number.isInteger(value) && value >= MIN_FOUNDED_YEAR && value <= CURRENT_YEAR
  );
}

/**
 * @param {unknown} value
 * @returns {boolean} true when value is an array with at least one usable string
 */
function isNonEmptyStringArray(value) {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((item) => isNonEmptyString(item))
  );
}

/**
 * Trims every item, drops empty ones and removes duplicates.
 * Used for `requirements` so " React " and "React" do not show up twice.
 *
 * @param {unknown} value
 * @returns {string[]}
 */
function normalizeStringArray(value) {
  if (!Array.isArray(value)) return [];

  const seen = new Set();
  const result = [];

  value.forEach((item) => {
    if (!isNonEmptyString(item)) return;
    const trimmed = item.trim();
    if (seen.has(trimmed)) return;
    seen.add(trimmed);
    result.push(trimmed);
  });

  return result;
}

/**
 * Makes user input safe to drop inside a RegExp (search endpoints).
 * Without this, a keyword like "a+b(" would create an invalid regex.
 *
 * @param {string} value
 * @returns {string}
 */
function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = {
  EMAIL_REGEX,
  PHONE_REGEX,
  URL_REGEX,
  MIN_FOUNDED_YEAR,
  CURRENT_YEAR,
  isNonEmptyString,
  isValidEmail,
  isValidPhone,
  isValidUrl,
  isValidObjectId,
  isValidFoundedYear,
  isNonEmptyStringArray,
  normalizeStringArray,
  escapeRegExp,
};
