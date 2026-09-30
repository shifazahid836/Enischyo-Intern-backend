/**
 * tests/auth-smoke.js — dependency-free checks for the authentication middleware.
 *
 * `protect` reads the Bearer token, verifies it with jsonwebtoken and then loads
 * the user from MongoDB. This script swaps `User.findById` for a stub, so every
 * branch of that logic can be tested WITHOUT a database connection:
 *
 *   npm run test:auth        (or: node tests/auth-smoke.js)
 *
 * Covered:
 *   ✅ User model  — the pre-save hook really hashes the password (bcrypt, cost
 *                    12), the hook is idempotent, and toJSON never leaks it
 *   ✅ protect     — missing header, "Bearer" with no token, wrong scheme,
 *                    garbage token, expired token, deleted account,
 *                    a valid token attaching req.user
 *   ✅ authorize   — 401 when unauthenticated, 403 when the role is wrong,
 *                    and the exact rules used by the routes
 *                    (employer for POST /jobs, employer|admin for DELETE)
 *   ✅ controllers — register / login / me / change-password happy paths AND
 *                    their 400 / 401 / 409 branches, with a stubbed User model
 *   ✅ rateLimit   — 5 login attempts per 15 minutes, and the fact that both
 *                    limiter middlewares exist
 */

const assert = require('assert');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const User = require('../models/User');
const Job = require('../models/Job');
const Company = require('../models/Company');
const Application = require('../models/Application');
const authController = require('../controllers/authController');
const jobController = require('../controllers/jobController');
const { protect, authorize, extractBearerToken } = require('../middleware/auth');
const {
  loginLimiter,
  createLimiter,
  LOGIN_MAX_ATTEMPTS,
  LOGIN_WINDOW_MINUTES,
} = require('../middleware/rateLimit');
const { signToken, verifyToken, ISSUER } = require('../utils/jwt');

// A throwaway secret, so the script never depends on .env being complete.
// utils/jwt.js reads process.env on every call, so assigning it here is enough.
const ORIGINAL_SECRET = process.env.JWT_SECRET;
process.env.JWT_SECRET = 'offline-auth-smoke-secret-long-enough-1234567890';

let passed = 0;
let failed = 0;
const failures = [];

function group(name) {
  console.log(`\n── ${name} ${'─'.repeat(Math.max(0, 56 - name.length))}`);
}

function check(name, condition, extra) {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failed += 1;
    failures.push(name);
    console.log(`  ✗ ${name}`);
    if (extra !== undefined) console.log(`      got: ${JSON.stringify(extra)}`);
  }
}

/**
 * Runs `protect` with a fake request and a stubbed User.findById.
 *
 * @param {{ authorization?: string, user?: object|null }} options
 * @returns {Promise<{ req: object, error: Error|null, called: boolean }>}
 */
async function runProtect(options = {}) {
  const { authorization, user = null } = options;

  const originalFindById = User.findById;
  User.findById = async () => user; // <- the database is replaced by this stub

  const headers = {};
  if (authorization !== undefined) headers.authorization = authorization;

  const req = { headers };
  let error = null;
  let called = false;

  try {
    await protect(req, {}, (err) => {
      if (err) error = err;
      else called = true;
    });
  } catch (thrown) {
    error = thrown;
  } finally {
    User.findById = originalFindById;
  }

  return { req, error, called };
}

/**
 * Runs the `authorize(...roles)` gate directly (it is synchronous).
 *
 * @param {object|undefined} user req.user
 * @param {string[]} roles
 * @returns {{ error: Error|null, called: boolean }}
 */
function runAuthorize(user, roles) {
  const req = user === undefined ? {} : { user };
  let error = null;
  let called = false;

  authorize(...roles)(req, {}, (err) => {
    if (err) error = err;
    else called = true;
  });

  return { error, called };
}

/** Minimal Express response double: records the status code and the JSON body. */
function fakeResponse() {
  const captured = { statusCode: null, body: null };

  return {
    captured,
    status(code) {
      captured.statusCode = code;
      return this;
    },
    json(body) {
      captured.body = body;
      return this;
    },
  };
}

/**
 * Calls a controller with a fake request, capturing the response OR the thrown
 * httpError (controllers `throw badRequest(...)` instead of calling next()).
 *
 * @param {Function} controller
 * @param {object} req
 * @returns {Promise<{ status: number|null, body: object|null, error: Error|null }>}
 */
async function callController(controller, req) {
  const res = fakeResponse();
  let error = null;

  try {
    await controller(req, res);
  } catch (thrown) {
    error = thrown;
  }

  return { status: res.captured.statusCode, body: res.captured.body, error };
}

/** A stand-in for a Mongoose User document (only what the controllers touch). */
function makeDoc(data = {}) {
  return {
    _id: '68d1f0a4e2b1c4d5e6f7a8b9',
    name: data.name || 'Stub User',
    email: data.email || 'stub@example.com',
    role: data.role || 'jobseeker',
    createdAt: new Date('2026-09-29T00:00:00.000Z'),
    toAuthJSON() {
      return { id: this._id, name: this.name, email: this.email, role: this.role, createdAt: this.createdAt };
    },
    async comparePassword(plain) {
      return plain === 'CorrectPass123!';
    },
    async save() {},
  };
}

/**
 * Runs `fn` with the given User static methods replaced, always restoring them.
 * Stubs must always be provided for the paths that reach the model, otherwise
 * the real Mongoose method (and therefore the database) would be used.
 *
 * @param {{ exists?: Function, create?: Function, findOne?: Function, findById?: Function }} stubs
 * @param {Function} fn
 */
async function withStubbedUser(stubs, fn) {
  const originals = {
    exists: User.exists,
    create: User.create,
    findOne: User.findOne,
    findById: User.findById,
  };

  User.exists = stubs.exists || originals.exists;
  User.create = stubs.create || originals.create;
  User.findOne = stubs.findOne || originals.findOne;
  User.findById = stubs.findById || originals.findById;

  try {
    return await fn();
  } finally {
    User.exists = originals.exists;
    User.create = originals.create;
    User.findOne = originals.findOne;
    User.findById = originals.findById;
  }
}

/** A stand-in for a Mongoose Job document (only what the controllers touch). */
function makeJobDoc(employer) {
  return {
    _id: '68d1f0a4e2b1c4d5e6f7a8b0',
    title: 'Stub Job',
    employer,
    company: '68d1f0a4e2b1c4d5e6f7a8b1',
    async save() {},
    async populate() {
      return this;
    },
    async deleteOne() {},
  };
}

/**
 * Runs `fn` with the Job/Company/Application model methods replaced so the job
 * controllers can be exercised without a database.
 *
 * @param {{ job?: object|null, companyExists?: boolean }} options
 * @param {Function} fn
 */
async function withStubbedJobModel(options, fn) {
  const { job = null, companyExists = true } = options;

  const originals = {
    findById: Job.findById,
    save: Job.prototype.save,
    populate: Job.prototype.populate,
    deleteOne: Job.prototype.deleteOne,
    deleteMany: Application.deleteMany,
    companyExists: Company.exists,
  };

  Job.findById = async () => job;
  Job.prototype.save = async function stubSave() {};
  Job.prototype.populate = async function stubPopulate() {
    return this;
  };
  Job.prototype.deleteOne = async function stubDeleteOne() {};
  Application.deleteMany = async () => ({ deletedCount: 2 });
  Company.exists = async () => companyExists;

  try {
    return await fn();
  } finally {
    Job.findById = originals.findById;
    Job.prototype.save = originals.save;
    Job.prototype.populate = originals.populate;
    Job.prototype.deleteOne = originals.deleteOne;
    Application.deleteMany = originals.deleteMany;
    Company.exists = originals.companyExists;
  }
}

async function main() {
  const fakeUser = { _id: '68d1f0a4e2b1c4d5e6f7a8b9', name: 'Stub User', role: 'employer' };
  const validToken = signToken(fakeUser);

  // ------------------------------------------------------------------ protect
  group('protect: requests that must be refused');

  const noHeader = await runProtect({});
  check(
    'no Authorization header → 401',
    noHeader.error && noHeader.error.statusCode === 401,
    noHeader.error && noHeader.error.message
  );
  check('  … and the handler is not reached', noHeader.called === false);

  const emptyBearer = await runProtect({ authorization: 'Bearer    ' });
  check(
    '"Bearer" with no token → 401',
    emptyBearer.error && emptyBearer.error.statusCode === 401,
    emptyBearer.error && emptyBearer.error.message
  );

  const wrongScheme = await runProtect({ authorization: `Basic ${validToken}` });
  check(
    'a non-Bearer scheme → 401',
    wrongScheme.error && wrongScheme.error.statusCode === 401,
    wrongScheme.error && wrongScheme.error.message
  );

  const garbage = await runProtect({ authorization: 'Bearer not.a.real.token' });
  check(
    'a garbage token → 401 "Invalid token"',
    garbage.error && garbage.error.statusCode === 401 && /Invalid token/.test(garbage.error.message),
    garbage.error && garbage.error.message
  );

  const wrongSecretToken = jwt.sign({ sub: fakeUser._id, role: 'employer' }, 'a-different-secret-that-is-long-enough', {
    expiresIn: '7d',
    issuer: ISSUER,
  });
  const wrongSecret = await runProtect({ authorization: `Bearer ${wrongSecretToken}`, user: fakeUser });
  check(
    'a token signed with another secret → 401',
    wrongSecret.error && wrongSecret.error.statusCode === 401,
    wrongSecret.error && wrongSecret.error.message
  );

  const expiredToken = jwt.sign({ sub: fakeUser._id, role: 'employer' }, process.env.JWT_SECRET, {
    expiresIn: '-10s',
    issuer: ISSUER,
  });
  const expired = await runProtect({ authorization: `Bearer ${expiredToken}`, user: fakeUser });
  check(
    'an expired token → 401 "expired"',
    expired.error && expired.error.statusCode === 401 && /expired/i.test(expired.error.message),
    expired.error && expired.error.message
  );

  const deletedAccount = await runProtect({ authorization: `Bearer ${validToken}`, user: null });
  check(
    'a valid token whose account was deleted → 401',
    deletedAccount.error &&
      deletedAccount.error.statusCode === 401 &&
      /no longer exists/.test(deletedAccount.error.message),
    deletedAccount.error && deletedAccount.error.message
  );

  // ------------------------------------------------------------------ success
  group('protect: the accepted request');

  const accepted = await runProtect({ authorization: `Bearer ${validToken}`, user: fakeUser });
  check('a valid token calls next()', accepted.called === true && accepted.error === null, accepted.error && accepted.error.message);
  check('req.user is the document loaded from the database', accepted.req.user === fakeUser);
  check('req.token keeps the raw token', accepted.req.token === validToken);

  const lowerCaseScheme = await runProtect({ authorization: `bearer ${validToken}`, user: fakeUser });
  check('the scheme is case-insensitive ("bearer …")', lowerCaseScheme.called === true);

  const extraSpaces = await runProtect({ authorization: `  Bearer   ${validToken}  `, user: fakeUser });
  check('extra whitespace around the header is tolerated', extraSpaces.called === true);

  const roleFromDatabase = await runProtect({
    authorization: `Bearer ${validToken}`,
    user: { _id: fakeUser._id, role: 'jobseeker' },
  });
  check(
    'req.user.role is re-read from the database, not trusted from the token',
    roleFromDatabase.req.user.role === 'jobseeker'
  );

  group('extractBearerToken()');
  check('"Bearer abc" → "abc"', extractBearerToken('Bearer abc') === 'abc');
  check('undefined → null', extractBearerToken(undefined) === null);
  check('"abc" (no scheme) → null', extractBearerToken('abc') === null);
  check('"Bearer" alone → null', extractBearerToken('Bearer') === null);

  // ---------------------------------------------------------------- authorize
  group('authorize: the role gate');

  const employerForEmployer = runAuthorize({ role: 'employer' }, ['employer']);
  check('employer passes authorize("employer")', employerForEmployer.called === true && employerForEmployer.error === null);

  const jobseekerForEmployer = runAuthorize({ role: 'jobseeker' }, ['employer']);
  check(
    'jobseeker fails authorize("employer") → 403 (POST /jobs)',
    jobseekerForEmployer.error && jobseekerForEmployer.error.statusCode === 403,
    jobseekerForEmployer.error && jobseekerForEmployer.error.message
  );

  const adminForEmployer = runAuthorize({ role: 'admin' }, ['employer']);
  check(
    'admin fails authorize("employer") → 403 (only employers advertise)',
    adminForEmployer.error && adminForEmployer.error.statusCode === 403
  );

  const employerForDelete = runAuthorize({ role: 'employer' }, ['employer', 'admin']);
  check('employer passes authorize("employer", "admin") (DELETE /jobs/:id)', employerForDelete.called === true);

  const adminForDelete = runAuthorize({ role: 'admin' }, ['employer', 'admin']);
  check('admin passes authorize("employer", "admin") (admins delete any resource)', adminForDelete.called === true);

  const jobseekerForApply = runAuthorize({ role: 'jobseeker' }, ['jobseeker']);
  check('jobseeker passes authorize("jobseeker") (POST /applications)', jobseekerForApply.called === true);

  const employerForApply = runAuthorize({ role: 'employer' }, ['jobseeker']);
  check(
    'employer fails authorize("jobseeker") → 403 (POST /applications)',
    employerForApply.error && employerForApply.error.statusCode === 403
  );

  const adminUppercase = runAuthorize({ role: 'admin' }, ['ADMIN']);
  check('role names are compared case-insensitively', adminUppercase.called === true);

  const anonymous = runAuthorize(undefined, ['employer']);
  check(
    'no req.user at all → 401 (not 403)',
    anonymous.error && anonymous.error.statusCode === 401,
    anonymous.error && anonymous.error.statusCode
  );

  // ---------------------------------------------------------------- rate limit
  group('rate limit configuration');
  check(
    `login is limited to ${LOGIN_MAX_ATTEMPTS} attempts per ${LOGIN_WINDOW_MINUTES} minutes`,
    LOGIN_MAX_ATTEMPTS === 5 && LOGIN_WINDOW_MINUTES === 15
  );
  check('loginLimiter is a middleware function', typeof loginLimiter === 'function');
  check('createLimiter exists for the other write endpoints', typeof createLimiter === 'function');

  // --------------------------------------------------------- password hashing
  group('User password hashing (pre-save hook)');

  const rawUser = new User({ name: 'Hash Probe', email: 'hash.probe@example.com', password: 'PlainPass123!' });
  check('the plain password is kept until a save runs', rawUser.password === 'PlainPass123!');

  await User.schema.s.hooks.execPre('save', rawUser, []);

  check('the hook replaces it with a bcrypt hash', /^\$2[aby]\$\d{2}\$/.test(String(rawUser.password)), rawUser.password);
  check('the cost factor is 12 (salt rounds)', String(rawUser.password).startsWith('$2b$12$'), String(rawUser.password).slice(0, 7));
  check('bcrypt.compare() accepts the original password', await bcrypt.compare('PlainPass123!', rawUser.password));
  check('bcrypt.compare() rejects a wrong password', (await bcrypt.compare('WrongPass123!', rawUser.password)) === false);
  check('the document remembers the hash it produced', rawUser.$locals.passwordHash === rawUser.password);

  const firstHash = rawUser.password;
  await User.schema.s.hooks.execPre('save', rawUser, []);
  check('running the hook twice does NOT hash the hash (retry after a failed save)', rawUser.password === firstHash, rawUser.password);

  rawUser.role = 'employer';
  await User.schema.s.hooks.execPre('save', rawUser, []);
  check('an unrelated change leaves the hash alone', rawUser.password === firstHash);

  const saltedUser = new User({ name: 'Salt Probe', email: 'salt.probe@example.com', password: 'PlainPass123!' });
  await User.schema.s.hooks.execPre('save', saltedUser, []);
  check('the same password produces a different hash (bcrypt salts every one)', saltedUser.password !== firstHash);

  check('toJSON() never exposes the password', !('password' in rawUser.toJSON()));
  check('toObject() never exposes the password', !('password' in rawUser.toObject()));

  // ------------------------------------------------------------ register
  group('authController.register');

  // Used for every invalid body: reaching the model would be a bug, because
  // validation must always run (and fail) BEFORE any database query.
  const mustNotReachTheDatabase = {
    exists: async () => {
      throw new Error('User.exists() must not be called for an invalid body');
    },
    create: async () => {
      throw new Error('User.create() must not be called for an invalid body');
    },
  };

  let registerPayload = null;
  const registered = await withStubbedUser(
    {
      exists: async () => false,
      create: async (data) => {
        registerPayload = data;
        return makeDoc(data);
      },
    },
    () =>
      callController(authController.register, {
        body: {
          name: '  New Person  ',
          email: 'New.Person@Example.com',
          password: 'StrongPass123!',
          role: 'employer',
        },
      })
  );

  check('a valid body → 201', registered.status === 201, registered.error && registered.error.message);
  check(
    'the response carries a 7-day Bearer token',
    typeof registered.body.token === 'string' && registered.body.tokenType === 'Bearer' && registered.body.expiresIn === '7d'
  );
  check('the response never contains the password', !('password' in registered.body.user), registered.body.user);
  check(
    'the name is trimmed and the e-mail lower-cased before saving',
    registerPayload.name === 'New Person' && registerPayload.email === 'new.person@example.com',
    registerPayload
  );
  check(
    'the plain password is handed to the model (which hashes it in the pre-save hook)',
    registerPayload.password === 'StrongPass123!'
  );
  check('the requested employer role is kept', registered.body.user.role === 'employer');
  check('the token really contains the new role', verifyToken(registered.body.token).role === 'employer');

  const duplicate = await withStubbedUser({ exists: async () => true }, () =>
    callController(authController.register, {
      body: { name: 'Copy Cat', email: 'taken@example.com', password: 'StrongPass123!' },
    })
  );
  check('duplicate e-mail → 409', duplicate.error && duplicate.error.statusCode === 409, duplicate.error && duplicate.error.message);

  const invalidEmail = await withStubbedUser(mustNotReachTheDatabase, () =>
    callController(authController.register, { body: { name: 'Bad Email', email: 'nope', password: 'StrongPass123!' } })
  );
  check(
    'invalid e-mail → 400 with an errors[] array',
    invalidEmail.error && invalidEmail.error.statusCode === 400 && Array.isArray(invalidEmail.error.errors),
    invalidEmail.error && invalidEmail.error.message
  );

  const shortPassword = await withStubbedUser(mustNotReachTheDatabase, () =>
    callController(authController.register, { body: { name: 'Short Pass', email: 'short@example.com', password: '1234567' } })
  );
  check('password shorter than 8 characters → 400', shortPassword.error && shortPassword.error.statusCode === 400);

  const noName = await withStubbedUser(mustNotReachTheDatabase, () =>
    callController(authController.register, { body: { email: 'noname@example.com', password: 'StrongPass123!' } })
  );
  check('missing name → 400', noName.error && noName.error.statusCode === 400);

  const adminSignup = await withStubbedUser(mustNotReachTheDatabase, () =>
    callController(authController.register, {
      body: { name: 'Sneaky Admin', email: 'sneaky@example.com', password: 'StrongPass123!', role: 'admin' },
    })
  );
  check('role "admin" → 400 (cannot be self-assigned)', adminSignup.error && adminSignup.error.statusCode === 400);

  const badRole = await withStubbedUser(mustNotReachTheDatabase, () =>
    callController(authController.register, {
      body: { name: 'Wizard', email: 'wizard@example.com', password: 'StrongPass123!', role: 'wizard' },
    })
  );
  check('unknown role → 400', badRole.error && badRole.error.statusCode === 400);

  // ------------------------------------------------------------- login
  group('authController.login');

  const loginDoc = makeDoc({ role: 'employer' });
  const stubFindOne = { findOne: () => ({ select: async () => loginDoc }) };

  const loggedIn = await withStubbedUser(stubFindOne, () =>
    callController(authController.login, { body: { email: 'Stub@Example.com', password: 'CorrectPass123!' } })
  );
  check('correct credentials → 200 with a token', loggedIn.status === 200 && typeof loggedIn.body.token === 'string', loggedIn.error && loggedIn.error.message);
  check('login never returns the password', !('password' in loggedIn.body.user));
  check('the token carries the user id in sub', verifyToken(loggedIn.body.token).sub === loginDoc._id);

  const wrongPassword = await withStubbedUser(stubFindOne, () =>
    callController(authController.login, { body: { email: loginDoc.email, password: 'WrongPass123!' } })
  );
  check('wrong password → 401', wrongPassword.error && wrongPassword.error.statusCode === 401);

  const unknownEmail = await withStubbedUser({ findOne: () => ({ select: async () => null }) }, () =>
    callController(authController.login, { body: { email: 'ghost@example.com', password: 'Whatever123!' } })
  );
  check('unknown e-mail → 401', unknownEmail.error && unknownEmail.error.statusCode === 401);
  check(
    'both 401s share the same message (no account enumeration)',
    wrongPassword.error.message === unknownEmail.error.message,
    { wrongPassword: wrongPassword.error.message, unknownEmail: unknownEmail.error.message }
  );

  const loginMissingFields = await withStubbedUser(mustNotReachTheDatabase, () =>
    callController(authController.login, { body: { email: '', password: '' } })
  );
  check('missing fields → 400 without touching the database', loginMissingFields.error && loginMissingFields.error.statusCode === 400);

  // ---------------------------------------------------------------- me
  group('authController.me');

  const meDoc = makeDoc();
  const meResult = await callController(authController.me, { user: meDoc });
  check('me → 200 with the document from req.user', meResult.status === 200 && meResult.body.user === meDoc);

  // ---------------------------------------------------- change password
  group('authController.changePassword');

  const missingPasswordFields = await withStubbedUser(mustNotReachTheDatabase, () =>
    callController(authController.changePassword, { user: makeDoc(), body: {} })
  );
  check('missing fields → 400', missingPasswordFields.error && missingPasswordFields.error.statusCode === 400);

  const shortNewPassword = await withStubbedUser(mustNotReachTheDatabase, () =>
    callController(authController.changePassword, {
      user: makeDoc(),
      body: { oldPassword: 'CorrectPass123!', newPassword: '123' },
    })
  );
  check('too-short new password → 400', shortNewPassword.error && shortNewPassword.error.statusCode === 400);

  const samePassword = await withStubbedUser(mustNotReachTheDatabase, () =>
    callController(authController.changePassword, {
      user: makeDoc(),
      body: { oldPassword: 'CorrectPass123!', newPassword: 'CorrectPass123!' },
    })
  );
  check('new password equal to the old one → 400', samePassword.error && samePassword.error.statusCode === 400);

  const wrongOldPassword = await withStubbedUser({ findById: () => ({ select: async () => makeDoc() }) }, () =>
    callController(authController.changePassword, {
      user: makeDoc(),
      body: { oldPassword: 'WrongOld123!', newPassword: 'BrandNew456!' },
    })
  );
  check('wrong current password → 401', wrongOldPassword.error && wrongOldPassword.error.statusCode === 401);

  let passwordSaved = false;
  const passwordDoc = makeDoc();
  passwordDoc.save = async () => {
    passwordSaved = true;
  };

  const changedPassword = await withStubbedUser({ findById: () => ({ select: async () => passwordDoc }) }, () =>
    callController(authController.changePassword, {
      user: { _id: passwordDoc._id },
      body: { oldPassword: 'CorrectPass123!', newPassword: 'BrandNew456!' },
    })
  );
  check(
    'the correct old password → 200 with a fresh token',
    changedPassword.status === 200 && typeof changedPassword.body.token === 'string',
    changedPassword.error && changedPassword.error.message
  );
  check('the new plain password is assigned so the model can re-hash it', passwordDoc.password === 'BrandNew456!');
  check('the document is saved (which triggers the pre-save hook)', passwordSaved === true);
  check('the response never contains the password', !('password' in changedPassword.body.user));

  // ------------------------------------------------------- job ownership
  group('job ownership (jobController with the models stubbed)');

  const employerA = { _id: '68d1f0a4e2b1c4d5e6f7a8b2', role: 'employer' };
  const employerB = { _id: '68d1f0a4e2b1c4d5e6f7a8b3', role: 'employer' };
  const adminUser = { _id: '68d1f0a4e2b1c4d5e6f7a8b4', role: 'admin' };
  const jobId = '68d1f0a4e2b1c4d5e6f7a8b0';

  const updateAs = (user, job) =>
    withStubbedJobModel({ job }, () =>
      callController(jobController.updateJob, { params: { id: jobId }, user, body: { title: 'Updated Title' } })
    );

  const ownerUpdate = await updateAs(employerA, makeJobDoc(employerA._id));
  check('PUT by the owning employer → 200', ownerUpdate.status === 200, ownerUpdate.error && ownerUpdate.error.message);

  const strangerUpdate = await updateAs(employerB, makeJobDoc(employerA._id));
  check(
    'PUT by a DIFFERENT employer → 403',
    strangerUpdate.error && strangerUpdate.error.statusCode === 403,
    strangerUpdate.error && strangerUpdate.error.message
  );

  const adminUpdate = await updateAs(adminUser, makeJobDoc(employerA._id));
  check('PUT by an admin → 403 (admins delete, they do not edit)', adminUpdate.error && adminUpdate.error.statusCode === 403);

  const orphanUpdate = await updateAs(employerA, makeJobDoc(null));
  check(
    'PUT on a job with no employer on record → 403 (only an admin can touch it)',
    orphanUpdate.error && orphanUpdate.error.statusCode === 403
  );

  const missingJob = await withStubbedJobModel({ job: null }, () =>
    callController(jobController.updateJob, { params: { id: jobId }, user: employerA, body: { title: 'Updated Title' } })
  );
  check('PUT on an unknown id → 404', missingJob.error && missingJob.error.statusCode === 404);

  const badId = await withStubbedJobModel({ job: makeJobDoc(employerA._id) }, () =>
    callController(jobController.updateJob, { params: { id: 'not-an-id' }, user: employerA, body: { title: 'Updated Title' } })
  );
  check('PUT with a malformed id → 400', badId.error && badId.error.statusCode === 400);

  const deleteAs = (user, job) =>
    withStubbedJobModel({ job }, () => callController(jobController.deleteJob, { params: { id: jobId }, user }));

  const ownerDelete = await deleteAs(employerA, makeJobDoc(employerA._id));
  check('DELETE by the owning employer → 200', ownerDelete.status === 200, ownerDelete.error && ownerDelete.error.message);
  check('  … and its applications are deleted too', ownerDelete.body.deletedApplications === 2);

  const adminDelete = await deleteAs(adminUser, makeJobDoc(employerA._id));
  check('DELETE by an admin on someone else\u2019s job → 200 (admins delete any resource)', adminDelete.status === 200);

  const strangerDelete = await deleteAs(employerB, makeJobDoc(employerA._id));
  check('DELETE by a DIFFERENT employer → 403', strangerDelete.error && strangerDelete.error.statusCode === 403);

  const orphanDelete = await deleteAs(employerA, makeJobDoc(null));
  check('DELETE on a job with no employer on record → 403', orphanDelete.error && orphanDelete.error.statusCode === 403);

  // --- create: the employer comes from the token, never from the body --------
  group('POST /jobs takes the owner from the token');

  const jobBody = {
    title: 'Ownership Test Job',
    description: 'A job used to prove that the employer is taken from the token and never from the body.',
    requirements: ['Node.js'],
    salaryMin: 1000,
    salaryMax: 2000,
    type: 'remote',
    location: 'Remote',
    company: '68d1f0a4e2b1c4d5e6f7a8b1',
  };

  const createdJob = await withStubbedJobModel({ companyExists: true }, () =>
    callController(jobController.createJob, { user: employerA, body: { ...jobBody, employer: employerB._id } })
  );
  check('createJob → 201', createdJob.status === 201, createdJob.error && createdJob.error.message);
  check(
    'job.employer is the LOGGED-IN employer, not the one in the body',
    String(createdJob.body.job.employer) === employerA._id,
    String(createdJob.body.job.employer)
  );

  const unknownCompany = await withStubbedJobModel({ companyExists: false }, () =>
    callController(jobController.createJob, { user: employerA, body: jobBody })
  );
  check('createJob with a company that does not exist → 404', unknownCompany.error && unknownCompany.error.statusCode === 404);

  const emptyBody = await withStubbedJobModel({}, () => callController(jobController.createJob, { user: employerA, body: {} }));
  check('createJob with an empty body → 400', emptyBody.error && emptyBody.error.statusCode === 400);

  // ------------------------------------------------------------------- wrap up
  assert.ok(passed > 0);

  if (ORIGINAL_SECRET === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = ORIGINAL_SECRET;

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log(`RESULT: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log('Failed checks:\n' + failures.map((item) => ` - ${item}`).join('\n'));
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('AUTH SMOKE TEST CRASHED:', error);
  process.exit(1);
});
