/**
 * models/User.js — Mongoose model for an account (jobseeker / employer / admin).
 *
 * The password is NEVER stored in plain text:
 *   • a pre-save hook hashes it with bcrypt (salt rounds = 12) every time the
 *     field changes, so `user.save()` is always safe;
 *   • the field is `select: false`, which means a normal query does not even
 *     load it — the login flow asks for it explicitly with
 *     `.select('+password')`;
 *   • the toJSON/toObject transform strips it from every API response, so a
 *     controller can never leak it by accident.
 *
 * Passwords are compared with `comparePassword()` (bcrypt.compare), never with
 * `===`, because bcrypt hashes are salted: the same password produces a
 * different hash every time.
 */

const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const { isValidEmail } = require('../utils/validation');

// Cost factor for bcrypt. 12 is a good 2020s default: noticeably slower for an
// attacker than the old default (10) while still ~250ms on normal hardware.
const SALT_ROUNDS = 12;

// The three roles named in the task spec.
const USER_ROLES = ['jobseeker', 'employer', 'admin'];

const PASSWORD_MIN_LENGTH = 8;
// bcrypt only uses the first 72 BYTES of a password, so anything longer would
// be silently truncated — better to reject it than to confuse the user.
const PASSWORD_MAX_LENGTH = 72;

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required.'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters long.'],
      maxlength: [80, 'Name cannot be longer than 80 characters.'],
    },

    email: {
      type: String,
      required: [true, 'Email is required.'],
      // `unique` creates a unique index in MongoDB. Two simultaneous signups
      // are still caught by that index (error code 11000 → 409 in the handler).
      unique: true,
      trim: true,
      lowercase: true, // Ali@Example.com is stored as ali@example.com
      validate: {
        validator: isValidEmail,
        message: (props) => `"${props.value}" is not a valid email address.`,
      },
    },

    password: {
      type: String,
      required: [true, 'Password is required.'],
      minlength: [PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters long.`],
      maxlength: [PASSWORD_MAX_LENGTH, `Password cannot be longer than ${PASSWORD_MAX_LENGTH} characters.`],
      select: false, // never returned by a normal query
    },

    role: {
      type: String,
      enum: {
        values: USER_ROLES,
        message: `Role must be one of: ${USER_ROLES.join(', ')}.`,
      },
      default: 'jobseeker', // a new account is a job seeker unless stated otherwise
      lowercase: true,
      trim: true,
    },

    // Explicit field (instead of `timestamps: true`) because the task spec asks
    // for exactly `createdAt`.
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    versionKey: false,
    toJSON: { transform: stripPassword },
    toObject: { transform: stripPassword },
  }
);

/**
 * Removes the password hash from any serialised document.
 *
 * @param {import('mongoose').Document} doc
 * @param {Record<string, unknown>} ret
 * @returns {Record<string, unknown>}
 */
function stripPassword(doc, ret) {
  delete ret.password;
  return ret;
}

/**
 * Hashes the password before every save in which it actually changed.
 *
 * Two guards stop the value from being hashed twice:
 *
 *   1. `isModified('password')` — an unrelated update (changing the role, for
 *      example) must not touch a value that is already a hash.
 *
 *   2. `$locals.passwordHash` — if a save FAILS after this hook has run (a
 *      duplicate e-mail, for instance) mongoose has not reset the modified
 *      flags yet. The caller fixes the document and saves again, the hook runs a
 *      second time and hashes the hash — and the user can never log in again,
 *      because no password matches "${hash} of a hash". Remembering the value we
 *      produced makes this hook idempotent, which also keeps it safe to call
 *      more than once in one request.
 *
 * ⚠️ Mongoose 9 uses Kareem 3, whose pre hooks are PROMISE based. Writing
 * `function hashPassword(next) { … next() }` would look right but the hook would
 * silently never complete, storing plain-text passwords. `async` + no arguments
 * is the correct shape here.
 */
userSchema.pre('save', async function hashPassword() {
  if (!this.isModified('password')) return;

  // The value is already the hash this hook produced for it → nothing to do.
  if (this.$locals.passwordHash === this.password) return;

  this.password = await bcrypt.hash(this.password, SALT_ROUNDS);
  this.$locals.passwordHash = this.password;
});

/**
 * Compares a plain-text candidate with the stored hash.
 *
 * @param {string} candidatePassword plain password sent by the client
 * @returns {Promise<boolean>}
 * @throws {Error} when the document was loaded without its password field
 */
userSchema.methods.comparePassword = function comparePassword(candidatePassword) {
  if (!this.password) {
    throw new Error(
      'The password field was not loaded. Query the user with .select("+password") before comparing.'
    );
  }

  return bcrypt.compare(candidatePassword, this.password);
};

/**
 * The "public" shape of a user — what endpoints such as POST /auth/register
 * and GET /auth/me return.
 *
 * @returns {{ id: string, name: string, email: string, role: string, createdAt: Date }}
 */
userSchema.methods.toAuthJSON = function toAuthJSON() {
  return {
    id: this._id,
    name: this.name,
    email: this.email,
    role: this.role,
    createdAt: this.createdAt,
  };
};

module.exports = mongoose.model('User', userSchema);
module.exports.USER_ROLES = USER_ROLES;
module.exports.SALT_ROUNDS = SALT_ROUNDS;
module.exports.PASSWORD_MIN_LENGTH = PASSWORD_MIN_LENGTH;
module.exports.PASSWORD_MAX_LENGTH = PASSWORD_MAX_LENGTH;
