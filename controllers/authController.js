/**
 * controllers/authController.js — register, login, profile, change password.
 *
 * Nothing here touches the bcrypt library directly: hashing lives in
 * models/User.js (pre-save hook) and comparison lives in
 * `user.comparePassword()`. That way the rules cannot be bypassed by a
 * controller that forgets a step.
 *
 * Error style follows the rest of the API:
 *   throw badRequest('…', ['one line per problem'])  → 400
 *   throw conflict('…')                              → 409
 *   throw unauthorized('…')                          → 401
 */

const User = require('../models/User');
const {
  USER_ROLES,
  PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
} = require('../models/User');

const {
  badRequest,
  conflict,
  forbidden,
  notFound,
  unauthorized,
} = require('../utils/httpError');

const { isNonEmptyString, isValidEmail } = require('../utils/validation');
const { signToken, getExpiresIn } = require('../utils/jwt');

/**
 * Roles a visitor may pick for themselves.
 *
 * "admin" is deliberately NOT here: letting anyone POST role=admin would make
 * the whole role system pointless. Admins are created by seed.js, or by
 * temporarily setting ALLOW_ADMIN_REGISTRATION=true in .env.
 */
const SELF_SERVICE_ROLES = ['jobseeker', 'employer'];

/**
 * @param {unknown} role
 * @returns {boolean} true when the requested role can be self-assigned
 */
function canSelfAssignRole(role) {
  if (role === 'admin') {
    return String(process.env.ALLOW_ADMIN_REGISTRATION).toLowerCase() === 'true';
  }

  return SELF_SERVICE_ROLES.includes(role);
}

/**
 * @param {unknown} value
 * @returns {string} trimmed, lower-cased email (what the model stores anyway)
 */
function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

/**
 * The success body shared by register and login.
 *
 * @param {import('../models/User')} user
 * @param {string} message
 * @returns {object}
 */
function authResponse(user, message) {
  return {
    success: true,
    message,
    token: signToken(user),
    tokenType: 'Bearer',
    expiresIn: getExpiresIn(), // e.g. "7d" — send it in the Authorization header
    user: user.toAuthJSON(),
  };
}

/**
 * POST /auth/register
 *
 * Body: { name, email, password, role? }
 * 201 → { success, token, tokenType, expiresIn, user }
 *
 * Validation happens in this order, so the client gets the most useful message
 * first: required fields → format → role → duplicate email → schema rules.
 */
async function register(req, res) {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const { name, password, role } = body;
  const email = normalizeEmail(body.email);

  // ---------------------------------------------------------------- validate
  const errors = [];

  if (!isNonEmptyString(name)) {
    errors.push('name is required.');
  } else if (name.trim().length < 2) {
    errors.push('name must be at least 2 characters long.');
  }

  if (!isNonEmptyString(body.email)) {
    errors.push('email is required.');
  } else if (!isValidEmail(email)) {
    errors.push(`"${body.email}" is not a valid email address.`);
  }

  // NOTE: a password is checked as-is — never trim() it, because a leading or
  // trailing space is a real character the user may have chosen on purpose.
  if (!isNonEmptyString(password)) {
    errors.push('password is required.');
  } else if (password.length < PASSWORD_MIN_LENGTH) {
    errors.push(`password must be at least ${PASSWORD_MIN_LENGTH} characters long.`);
  } else if (password.length > PASSWORD_MAX_LENGTH) {
    errors.push(`password cannot be longer than ${PASSWORD_MAX_LENGTH} characters.`);
  }

  const requestedRole = isNonEmptyString(role) ? role.trim().toLowerCase() : 'jobseeker';

  if (!USER_ROLES.includes(requestedRole)) {
    errors.push(`role must be one of: ${USER_ROLES.join(', ')}.`);
  } else if (!canSelfAssignRole(requestedRole)) {
    errors.push('role "admin" cannot be chosen during public registration.');
  }

  if (errors.length > 0) {
    throw badRequest('Registration failed. Please check the highlighted fields.', errors);
  }

  // ----------------------------------------------------------- duplicate check
  // A friendly 409 before MongoDB's unique index fires. The index is still the
  // real guarantee, because two requests can pass this check at the same time
  // (the second one then hits error code 11000 → also 409).
  const existingUser = await User.exists({ email });

  if (existingUser) {
    throw conflict(`An account with the email "${email}" already exists. Try logging in instead.`);
  }

  // ------------------------------------------------------------------ create
  // The pre-save hook hashes `password` with bcrypt (12 salt rounds) — the
  // plain text never reaches the database.
  const user = await User.create({
    name: name.trim(),
    email,
    password,
    role: requestedRole,
  });

  return res.status(201).json(authResponse(user, 'Account created successfully.'));
}

/**
 * POST /auth/login
 *
 * Body: { email, password }
 * 200 → { success, token, tokenType, expiresIn, user }
 *
 * Rate limited to 5 attempts / 15 minutes by middleware/rateLimit.js.
 */
async function login(req, res) {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const email = normalizeEmail(body.email);
  const { password } = body;

  const errors = [];

  if (!isNonEmptyString(body.email)) errors.push('email is required.');
  else if (!isValidEmail(email)) errors.push(`"${body.email}" is not a valid email address.`);

  if (!isNonEmptyString(password)) errors.push('password is required.');

  if (errors.length > 0) {
    throw badRequest('Login failed. Please check the highlighted fields.', errors);
  }

  // `.select('+password')` is required: the field is `select: false` so it is
  // not loaded by default (which is what keeps it out of every other response).
  const user = await User.findOne({ email }).select('+password');

  // ONE message for both "no such email" and "wrong password". Saying which one
  // failed would let an attacker discover which email addresses have accounts.
  const invalidCredentials = unauthorized('Invalid email or password.');

  if (!user) throw invalidCredentials;

  const passwordMatches = await user.comparePassword(password);

  if (!passwordMatches) throw invalidCredentials;

  return res.status(200).json(authResponse(user, 'Login successful.'));
}

/**
 * GET /auth/me
 *
 * `protect` has already verified the token and loaded the user, so this is
 * just a shape of the response. The password hash is stripped by the model's
 * toJSON transform.
 */
async function me(req, res) {
  return res.status(200).json({
    success: true,
    user: req.user,
  });
}

/**
 * PATCH /auth/change-password
 *
 * Body: { oldPassword, newPassword }
 * 200 → { success, message, token, user }
 *
 * ⚠️ Tokens already issued stay valid until they expire (a JWT is stateless),
 * so the freshly signed `token` in the response is the one the client should
 * store. To invalidate old tokens you would add a `passwordChangedAt` field and
 * compare it with the token's `iat` claim inside middleware/auth.js.
 */
async function changePassword(req, res) {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const { oldPassword, newPassword } = body;

  const errors = [];

  if (!isNonEmptyString(oldPassword)) errors.push('oldPassword is required.');

  if (!isNonEmptyString(newPassword)) {
    errors.push('newPassword is required.');
  } else if (newPassword.length < PASSWORD_MIN_LENGTH) {
    errors.push(`newPassword must be at least ${PASSWORD_MIN_LENGTH} characters long.`);
  } else if (newPassword.length > PASSWORD_MAX_LENGTH) {
    errors.push(`newPassword cannot be longer than ${PASSWORD_MAX_LENGTH} characters.`);
  }

  if (errors.length > 0) {
    throw badRequest('Password change failed. Please check the highlighted fields.', errors);
  }

  if (oldPassword === newPassword) {
    throw badRequest('The new password must be different from the current password.');
  }

  const user = await User.findById(req.user._id).select('+password');

  if (!user) throw notFound('User account not found.');

  const oldPasswordMatches = await user.comparePassword(oldPassword);

  if (!oldPasswordMatches) {
    // 401 rather than 400: the request is fine, the supplied credential is not.
    throw unauthorized('The current password is incorrect.');
  }

  user.password = newPassword; // assigning it marks the field dirty …
  await user.save(); // … so the pre-save hook hashes it again (12 rounds)

  return res.status(200).json({
    success: true,
    message: 'Password changed successfully. Use the new token (and the new password) from now on.',
    token: signToken(user),
    tokenType: 'Bearer',
    expiresIn: getExpiresIn(),
    user: user.toAuthJSON(),
  });
}

/**
 * GET /auth/users (admin only) — small list endpoint that proves the role gate
 * works. Useful when testing 403 vs 200 in Postman.
 */
async function listUsers(req, res) {
  const users = await User.find({}).sort({ createdAt: -1 });

  return res.status(200).json({
    success: true,
    count: users.length,
    users: users.map((user) => user.toAuthJSON()),
  });
}

/**
 * DELETE /auth/users/:id (admin only) — an example of "admins can delete any
 * resource". An admin cannot delete their own account, which prevents locking
 * everybody out by accident.
 */
async function deleteUser(req, res) {
  const { id } = req.params;

  if (String(id) === String(req.user._id)) {
    throw forbidden('You cannot delete the account you are currently logged in with.');
  }

  const user = await User.findById(id);

  if (!user) throw notFound(`User with id ${id} not found.`);

  await user.deleteOne();

  return res.status(200).json({
    success: true,
    message: 'User deleted successfully.',
    deletedUser: user.toAuthJSON(),
  });
}

module.exports = {
  register,
  login,
  me,
  changePassword,
  listUsers,
  deleteUser,
  SELF_SERVICE_ROLES,
};
