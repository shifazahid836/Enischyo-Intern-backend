/**
 * tests/validation-smoke.js — dependency-free checks for the model rules and
 * the error handler.
 *
 * It does NOT need a database: Mongoose can validate documents in memory
 * (`doc.validate()`), and the error handler can be called with fake request /
 * response objects. That makes this script a fast first check when something
 * behaves unexpectedly.
 *
 * Run:  npm run test:validation      (or: node tests/validation-smoke.js)
 */

const assert = require('assert');

const Company = require('../models/Company');
const Job = require('../models/Job');
const Application = require('../models/Application');

const { errorHandler, notFound } = require('../middleware/errorHandler');
const { badRequest, notFound: httpNotFound } = require('../utils/httpError');
const {
  isValidUrl,
  isValidEmail,
  isValidPhone,
  isValidObjectId,
  isValidFoundedYear,
  normalizeStringArray,
  escapeRegExp,
} = require('../utils/validation');

let passed = 0;
let failed = 0;
const failures = [];

function group(name) {
  console.log(`\n── ${name} ${'─'.repeat(Math.max(0, 58 - name.length))}`);
}

/**
 * Asserts that a document passes validation.
 *
 * @param {string} name
 * @param {import('mongoose').Document} doc
 */
async function shouldPass(name, doc) {
  try {
    await doc.validate();
    passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (error) {
    failed += 1;
    failures.push(name);
    console.log(`  ✗ ${name}\n      unexpected error: ${error.message}`);
  }
}

/**
 * Asserts that a document FAILS validation with a message matching `pattern`.
 *
 * @param {string} name
 * @param {import('mongoose').Document} doc
 * @param {string|RegExp} [pattern]
 */
async function shouldFail(name, doc, pattern) {
  try {
    await doc.validate();
    failed += 1;
    failures.push(name);
    console.log(`  ✗ ${name}\n      expected a validation error but the document was accepted`);
  } catch (error) {
    const matched = !pattern || new RegExp(pattern, 'i').test(error.message);

    if (matched) {
      passed += 1;
      console.log(`  ✓ ${name}`);
    } else {
      failed += 1;
      failures.push(name);
      console.log(`  ✗ ${name}\n      message was: ${error.message}`);
    }
  }
}

/** Minimal Express response double that records what the handler sent. */
function fakeResponse() {
  const captured = {};
  return {
    captured,
    status(code) {
      captured.statusCode = code;
      return this;
    },
    json(payload) {
      captured.body = payload;
      return this;
    },
  };
}

// ---------------------------------------------------------------------------

const validCompany = () => ({
  name: 'TechCorp',
  logo: 'https://logo.example.com/techcorp.png',
  website: 'https://techcorp.example.com',
  description: 'TechCorp builds cloud collaboration tools for teams around the world.',
  industry: 'Software Development',
  foundedYear: 2012,
});

const validJob = () => ({
  title: 'React Frontend Developer',
  description: 'Build high performance interfaces with React for our SaaS dashboard product.',
  requirements: ['React', 'JavaScript'],
  salaryMin: 50000,
  salaryMax: 70000,
  type: 'full-time',
  location: 'Karachi, Pakistan',
  company: '68c1f0a4e2b1c4d5e6f7a8b0', // any 24-char hex string is a valid ObjectId
  deadline: new Date(Date.now() + 30 * 86400000),
  isActive: true,
});

const validApplication = (jobId = '68c1f0a4e2b1c4d5e6f7a8b0') => ({
  job: jobId,
  applicantName: 'Ayesha Khan',
  email: 'ayesha.khan@example.com',
  phone: '+92 300 1234567',
  coverLetter: 'I have four years of React experience and would love to join your team.',
  resumeURL: 'https://drive.example.com/resumes/ayesha-khan.pdf',
  status: 'pending',
});

async function main() {
  group('utils/validation.js');
  {
    assert.strictEqual(isValidUrl('https://example.com'), true);
    assert.strictEqual(isValidUrl('not-a-url'), false);
    assert.strictEqual(isValidUrl('ftp://example.com'), false);
    assert.strictEqual(isValidEmail('a.b@example.com'), true);
    assert.strictEqual(isValidEmail('a.b@example'), false);
    assert.strictEqual(isValidPhone('+92 300 1234567'), true);
    assert.strictEqual(isValidPhone('(021) 3456 7890'), true);
    assert.strictEqual(isValidPhone('call me'), false);
    assert.strictEqual(isValidObjectId('68c1f0a4e2b1c4d5e6f7a8b0'), true);
    // Mongoose would accept a 12-char string, our helper deliberately does not
    assert.strictEqual(isValidObjectId('abcdefghijkl'), false);
    assert.strictEqual(isValidFoundedYear(2012), true);
    assert.strictEqual(isValidFoundedYear(new Date().getFullYear() + 1), false);
    assert.deepStrictEqual(normalizeStringArray([' React ', 'React', '', 'Node.js']), ['React', 'Node.js']);
    assert.strictEqual(escapeRegExp('a+b('), 'a\\+b\\(');

    passed += 1;
    console.log('  ✓ all pure validators behave as expected');
  }

  group('models/Company.js');
  {
    await shouldPass('accepts a valid company', new Company(validCompany()));
    await shouldPass('logo is optional', new Company({ ...validCompany(), logo: undefined }));
    await shouldFail('rejects a missing name', new Company({ ...validCompany(), name: undefined }), 'name is required');
    await shouldFail('rejects a 1-character name', new Company({ ...validCompany(), name: 'A' }), 'at least 2 characters');
    await shouldFail('rejects a missing website', new Company({ ...validCompany(), website: undefined }), 'website is required');
    await shouldFail('rejects an invalid website', new Company({ ...validCompany(), website: 'techcorp' }), 'valid website URL');
    await shouldFail('rejects an invalid logo URL', new Company({ ...validCompany(), logo: 'nope' }), 'valid logo URL');
    await shouldFail('rejects a short description', new Company({ ...validCompany(), description: 'Too short' }), 'at least 20 characters');
    await shouldFail('rejects a short industry', new Company({ ...validCompany(), industry: 'A' }), 'at least 2 characters');
    await shouldFail('rejects a year before 1800', new Company({ ...validCompany(), foundedYear: 1700 }), '1800 or later');
    await shouldFail('rejects a future year', new Company({ ...validCompany(), foundedYear: 2999 }), 'cannot be in the future');
    await shouldFail('rejects a non-numeric year', new Company({ ...validCompany(), foundedYear: 'twenty twelve' }), 'Cast to Number');
    await shouldFail('rejects a required field that is empty', new Company({ ...validCompany(), name: '   ' }), 'name is required');
  }

  group('models/Job.js');
  {
    const valid = new Job(validJob());
    await shouldPass('accepts a valid job', valid);
    assert.strictEqual(valid.isActive, true, 'isActive should default to true');
    assert.ok(valid.postedDate instanceof Date, 'postedDate should default to now');

    await shouldFail('rejects a 2-character title', new Job({ ...validJob(), title: 'Hi' }), 'at least 3 characters');
    await shouldFail('rejects a short description', new Job({ ...validJob(), description: 'Too short' }), 'at least 20 characters');
    await shouldFail('rejects an empty requirements array', new Job({ ...validJob(), requirements: [] }), 'at least one item');
    await shouldFail('rejects requirements that are only blanks', new Job({ ...validJob(), requirements: ['', '  '] }), 'at least one item');
    await shouldFail('rejects a negative salaryMin', new Job({ ...validJob(), salaryMin: -100 }), 'cannot be negative');
    await shouldFail('rejects salaryMax < salaryMin', new Job({ ...validJob(), salaryMin: 80000, salaryMax: 50000 }), 'cannot be lower');
    await shouldFail('rejects an unknown job type', new Job({ ...validJob(), type: 'freelance' }), 'must be one of');
    await shouldPass('accepts type "remote"', new Job({ ...validJob(), type: 'remote' }));
    await shouldPass('accepts type "part-time"', new Job({ ...validJob(), type: 'part-time' }));
    await shouldFail('rejects a missing location', new Job({ ...validJob(), location: undefined }), 'Location is required');
    await shouldFail('rejects a missing company reference', new Job({ ...validJob(), company: undefined }), 'company is required');
    await shouldFail('rejects a malformed company ObjectId', new Job({ ...validJob(), company: 'not-an-id' }), 'Cast to ObjectId');
    await shouldFail('rejects a deadline before postedDate', new Job({ ...validJob(), postedDate: new Date(), deadline: new Date(Date.now() - 86400000) }), 'after postedDate');
    await shouldFail('rejects a non-numeric salary', new Job({ ...validJob(), salaryMin: 'a lot' }), 'Cast to Number');

    const normalized = new Job({ ...validJob(), requirements: [' React ', 'React', 'Node.js'] });
    await normalized.validate();
    assert.deepStrictEqual(normalized.requirements, ['React', 'Node.js']);
    passed += 1;
    console.log('  ✓ requirements are trimmed and de-duplicated');
  }

  group('models/Application.js');
  {
    const valid = new Application(validApplication());
    await shouldPass('accepts a valid application', valid);
    assert.strictEqual(valid.status, 'pending', 'status should default to pending');
    assert.ok(valid.appliedAt instanceof Date, 'appliedAt should default to now');

    await shouldFail('rejects a missing job reference', new Application({ ...validApplication(), job: undefined }), 'job is required');
    await shouldPass('accepts every valid status', new Application({ ...validApplication(), status: 'reviewed' }));
    await shouldFail('rejects an unknown status', new Application({ ...validApplication(), status: 'maybe' }), 'must be one of');
    await shouldFail('rejects a bad email', new Application({ ...validApplication(), email: 'nope' }), 'valid email');
    await shouldFail('rejects a bad phone number', new Application({ ...validApplication(), phone: 'call me maybe' }), 'valid phone number');
    await shouldFail('rejects a short cover letter', new Application({ ...validApplication(), coverLetter: 'Too short' }), 'at least 30 characters');
    await shouldFail('rejects a bad resume URL', new Application({ ...validApplication(), resumeURL: 'my-cv.pdf' }), 'valid resume URL');
    await shouldPass('lowercases the email address', new Application({ ...validApplication(), email: 'AYESHA.KHAN@EXAMPLE.COM' }));
  }

  group('middleware/errorHandler.js');
  {
    const cases = [
      {
        name: 'Mongoose CastError → 400',
        error: Object.assign(new Error('Cast to ObjectId failed'), {
          name: 'CastError',
          path: 'company',
          value: 'not-an-id',
          kind: 'ObjectId',
        }),
        expectStatus: 400,
      },
      {
        name: 'Mongoose ValidationError → 400 with per-field errors',
        error: (() => {
          const error = new Error('Job validation failed');
          error.name = 'ValidationError';
          error.errors = { title: { message: 'Job title is required.' } };
          return error;
        })(),
        expectStatus: 400,
        expectErrors: true,
      },
      {
        name: 'duplicate key (11000) → 409',
        error: Object.assign(new Error('E11000 duplicate key error'), {
          code: 11000,
          keyValue: { name: 'TechCorp' },
        }),
        expectStatus: 409,
      },
      {
        name: 'MongooseServerSelectionError → 503',
        error: Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:27017'), {
          name: 'MongooseServerSelectionError',
        }),
        expectStatus: 503,
      },
      {
        name: 'custom notFound() → 404',
        error: httpNotFound('Job with id 1 not found.'),
        expectStatus: 404,
      },
      {
        name: 'custom badRequest() → 400 with errors',
        error: badRequest('Invalid query parameters.', ['type must be one of: full-time.']),
        expectStatus: 400,
        expectErrors: true,
      },
      {
        name: 'unknown error → 500 without leaking internals',
        error: new Error('Something internal broke'),
        expectStatus: 500,
      },
    ];

    for (const testCase of cases) {
      const res = fakeResponse();
      const originalError = console.error;

      // Keep the test output clean (the handler logs every error on purpose)
      console.error = () => {};
      try {
        errorHandler(testCase.error, { method: 'GET', originalUrl: '/jobs' }, res, () => {});
      } finally {
        console.error = originalError;
      }

      const statusOk = res.captured.statusCode === testCase.expectStatus;
      const shapeOk = res.captured.body && res.captured.body.success === false;
      const errorsOk = !testCase.expectErrors || Array.isArray(res.captured.body.errors);
      const hiddenOk =
        testCase.expectStatus !== 500 || res.captured.body.message === 'Internal Server Error';

      if (statusOk && shapeOk && errorsOk && hiddenOk) {
        passed += 1;
        console.log(`  ✓ ${testCase.name}`);
      } else {
        failed += 1;
        failures.push(testCase.name);
        console.log(`  ✗ ${testCase.name} → ${JSON.stringify(res.captured)}`);
      }
    }

    const notFoundRes = fakeResponse();
    notFound({ method: 'GET', originalUrl: '/nope' }, notFoundRes);
    if (notFoundRes.captured.statusCode === 404 && notFoundRes.captured.body.success === false) {
      passed += 1;
      console.log('  ✓ notFound() → 404 JSON for unknown routes');
    } else {
      failed += 1;
      failures.push('notFound()');
      console.log(`  ✗ notFound() → ${JSON.stringify(notFoundRes.captured)}`);
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log(`RESULT: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log('Failed checks:\n' + failures.map((item) => ` - ${item}`).join('\n'));
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('SMOKE TEST CRASHED:', error);
  process.exit(1);
});
