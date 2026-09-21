/**
 * tests/api-smoke.js — end-to-end checks against the real MongoDB database.
 *
 * Requires a working MONGODB_URI in backend/.env (MongoDB Atlas).
 *
 * Run:  npm run test:api
 *
 * What it does:
 *   1. Connects with config/db.js
 *   2. Runs seed.js (⚠️  this CLEARS the five collections and re-inserts the
 *      sample data, so the expected counts are predictable)
 *   3. Boots the Express app on a random port
 *   4. Sends real HTTP requests to every endpoint and checks status codes,
 *      response bodies, populated company references and validation errors
 *   5. Cleans up the temporary records it created and closes the connection
 *
 * There are no extra dependencies: it only uses Node's built-in fetch.
 */

require('dotenv').config();

const { connectDB, disconnectDB, getConnectionState } = require('../config/db');

let passed = 0;
let failed = 0;
const failures = [];
let currentGroup = '';

function group(name) {
  currentGroup = name;
  console.log(`\n── ${name} ${'─'.repeat(Math.max(0, 60 - name.length))}`);
}

function check(name, condition, extra) {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failed += 1;
    failures.push(`[${currentGroup}] ${name}`);
    console.log(`  ✗ ${name}`);
    if (extra !== undefined) console.log(`      got: ${JSON.stringify(extra).slice(0, 400)}`);
  }
}

async function main() {
  if (!process.env.MONGODB_URI) {
    console.error('❌ MONGODB_URI is not set. Add it to backend/.env first (see .env.example).');
    process.exit(1);
  }

  // 1. Connect + seed through the real scripts
  const { seedDatabase } = require('../seed');
  const summary = await seedDatabase({ keepConnection: true });

  // 2. Boot the real app (port 0 → any free port)
  const app = require('../app');
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;

  async function api(method, path, body) {
    const res = await fetch(base + path, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    let json = null;
    try {
      json = await res.json();
    } catch {
      json = null;
    }

    return { status: res.status, body: json };
  }

  const missingId = '0123456789abcdef01234567'; // valid ObjectId format, not in the database

  // ------------------------------------------------------------- seed counts
  group('Health + seed');
  const health = await api('GET', '/health');
  check('GET /health → 200 with database connected', health.status === 200 && health.body.database === 'connected', health.body);
  check(`seed created 5 companies (got ${summary.companies})`, summary.companies === 5, summary);
  check(`seed created 15 jobs (got ${summary.jobs})`, summary.jobs === 15, summary);

  // ------------------------------------------------------------------- jobs
  group('GET /jobs');
  const list = await api('GET', '/jobs');
  const firstJob = list.body.jobs[0];
  check('GET /jobs → 200', list.status === 200, list.body);
  check(`GET /jobs → 15 jobs (got ${list.body.count})`, list.body.count === 15, list.body.count);
  check('company is populated inside every job', list.body.jobs.every((job) => typeof job.company === 'object' && !!job.company.name), list.body.jobs[0].company);
  check('requirements is a non-empty array', Array.isArray(firstJob.requirements) && firstJob.requirements.length > 0, firstJob.requirements);
  check('postedDate is a valid date', !Number.isNaN(new Date(firstJob.postedDate).getTime()), firstJob.postedDate);

  group('Search filters');
  const keyword = await api('GET', '/jobs?keyword=react');
  check(
    `?keyword=react → ${keyword.body.count} matching job(s)`,
    keyword.body.count > 0 && keyword.body.jobs.every((job) => /react/i.test(job.title) || /react/i.test(job.description)),
    keyword.body.jobs.map((job) => job.title)
  );

  const location = await api('GET', '/jobs?location=remote');
  check(
    `?location=remote → ${location.body.count} remote job(s)`,
    location.body.count > 0 && location.body.jobs.every((job) => /remote/i.test(job.location)),
    location.body.jobs.map((job) => job.location)
  );

  const type = await api('GET', '/jobs?type=full-time');
  check(
    `?type=full-time → ${type.body.count} full-time job(s)`,
    type.body.count > 0 && type.body.jobs.every((job) => job.type === 'full-time'),
    type.body.jobs.map((job) => job.type)
  );

  const combined = await api('GET', '/jobs?keyword=react&location=remote&type=full-time');
  check(`combined filters → ${combined.body.count} job(s) matching all three`, combined.status === 200 && combined.body.count >= 1, combined.body);
  check('combined filters keep company populated', combined.body.jobs.every((job) => typeof job.company === 'object' && !!job.company.name), combined.body.jobs.map((job) => job.company));

  const lowerCase = await api('GET', '/jobs?keyword=react&type=full-time');
  const upperCase = await api('GET', '/jobs?keyword=REACT&type=FULL-TIME');
  check(
    'filters are case-insensitive (same result as lowercase)',
    upperCase.body.count === lowerCase.body.count && upperCase.body.count > 0,
    { upperCase: upperCase.body.count, lowerCase: lowerCase.body.count }
  );

  const badType = await api('GET', '/jobs?type=banana');
  check('invalid ?type → 400 with errors array', badType.status === 400 && Array.isArray(badType.body.errors), badType.body);

  const emptyKeyword = await api('GET', '/jobs?keyword=');
  check('empty ?keyword is ignored (200)', emptyKeyword.status === 200, emptyKeyword.body);

  const inactive = await api('GET', '/jobs?isActive=false');
  check('extra filter ?isActive=false works', inactive.body.jobs.every((job) => job.isActive === false), inactive.body.count);

  const byCompany = await api('GET', `/jobs?company=${firstJob.company._id}`);
  check('extra filter ?company=<id> works', byCompany.body.count > 0, byCompany.body.count);

  group('GET /jobs/:id');
  const one = await api('GET', `/jobs/${firstJob._id}`);
  check('GET /jobs/:id → 200', one.status === 200, one.body);
  check('company populated in a single job', typeof one.body.job.company.name === 'string', one.body.job.company);
  check('malformed id → 400', (await api('GET', '/jobs/not-an-id')).status === 400);
  check('unknown id → 404', (await api('GET', `/jobs/${missingId}`)).status === 404);

  // ---------------------------------------------------------------- job CRUD
  group('POST /jobs');
  const companies = await api('GET', '/companies');
  const payload = {
    title: 'Smoke Test Engineer',
    description: 'A temporary job created by the automated smoke test to prove POST /jobs works.',
    requirements: ['Node.js', 'MongoDB', ' Testing '],
    salaryMin: 50000,
    salaryMax: 70000,
    type: 'remote',
    location: 'Remote (Worldwide)',
    company: companies.body.companies[0]._id,
    deadline: new Date(Date.now() + 30 * 86400000).toISOString(),
    isActive: true,
  };

  const created = await api('POST', '/jobs', payload);
  const createdJob = created.body.job;
  check('POST /jobs → 201', created.status === 201, created.body);
  check('company populated in the response', createdJob && typeof createdJob.company === 'object' && !!createdJob.company.name, createdJob && createdJob.company);
  check('postedDate defaulted automatically', !!createdJob.postedDate, createdJob.postedDate);
  check('requirements trimmed + de-duplicated', JSON.stringify(createdJob.requirements) === JSON.stringify(['Node.js', 'MongoDB', 'Testing']), createdJob.requirements);
  const missingJobFields = await api('POST', '/jobs', { title: 'x' });
  check(
    'missing fields → 400 with one error per invalid field',
    missingJobFields.status === 400 &&
      Array.isArray(missingJobFields.body.errors) &&
      missingJobFields.body.errors.length >= 8,
    missingJobFields.body
  );
  check('salaryMax < salaryMin → 400', (await api('POST', '/jobs', { ...payload, salaryMin: 90000, salaryMax: 10000 })).status === 400);
  check('invalid type enum → 400', (await api('POST', '/jobs', { ...payload, type: 'freelance' })).status === 400);
  check('malformed company id → 400', (await api('POST', '/jobs', { ...payload, company: 'nope' })).status === 400);
  check('unknown company id → 404', (await api('POST', '/jobs', { ...payload, company: missingId })).status === 404);
  check('empty requirements array → 400', (await api('POST', '/jobs', { ...payload, requirements: [] })).status === 400);

  group('PUT + DELETE /jobs/:id');
  const updated = await api('PUT', `/jobs/${createdJob._id}`, { salaryMax: 95000, title: 'Updated Smoke Test Engineer' });
  check('PUT /jobs/:id → 200 and value changed', updated.status === 200 && updated.body.job.salaryMax === 95000, updated.body);
  check('PUT revalidates the whole document (salaryMin) → 400', (await api('PUT', `/jobs/${createdJob._id}`, { salaryMin: 200000 })).status === 400);
  check('PUT with no valid fields → 400', (await api('PUT', `/jobs/${createdJob._id}`, { nonsense: 1 })).status === 400);
  check('PUT unknown id → 404', (await api('PUT', `/jobs/${missingId}`, { title: 'Whatever Name' })).status === 404);
  check('DELETE /jobs/:id → 200', (await api('DELETE', `/jobs/${createdJob._id}`)).status === 200);
  check('deleted job is gone (404)', (await api('GET', `/jobs/${createdJob._id}`)).status === 404);
  check('DELETE unknown id → 404', (await api('DELETE', `/jobs/${missingId}`)).status === 404);

  // ----------------------------------------------------------- company CRUD
  group('Companies');
  check(`GET /companies → 5 companies (got ${companies.body.count})`, companies.body.count === 5, companies.body.count);

  const companyOne = await api('GET', `/companies/${companies.body.companies[0]._id}`);
  check('GET /companies/:id → 200 with jobCount', companyOne.status === 200 && typeof companyOne.body.jobCount === 'number', companyOne.body);
  check('malformed company id → 400', (await api('GET', '/companies/xyz')).status === 400);
  check('unknown company id → 404', (await api('GET', `/companies/${missingId}`)).status === 404);

  const companyPayload = {
    name: 'Smoke Test Labs',
    logo: 'https://logo.example.com/smoke.png',
    website: 'https://smoketestlabs.example.com',
    description: 'A temporary company created by the automated smoke test.',
    industry: 'Software Testing',
    foundedYear: 2021,
  };

  const createdCompany = await api('POST', '/companies', companyPayload);
  check('POST /companies → 201', createdCompany.status === 201, createdCompany.body);
  check('duplicate company name → 409 Conflict', (await api('POST', '/companies', companyPayload)).status === 409);
  check('invalid website URL → 400', (await api('POST', '/companies', { ...companyPayload, name: 'Bad URL Inc', website: 'not-a-url' })).status === 400);
  check('foundedYear in the future → 400', (await api('POST', '/companies', { ...companyPayload, name: 'Future Corp', foundedYear: 2999 })).status === 400);
  check('missing required fields → 400', (await api('POST', '/companies', { name: 'Only A Name' })).status === 400);

  const updatedCompany = await api('PUT', `/companies/${createdCompany.body.company._id}`, { industry: 'Quality Assurance' });
  check('PUT /companies/:id → 200 and value changed', updatedCompany.status === 200 && updatedCompany.body.company.industry === 'Quality Assurance', updatedCompany.body);
  check('DELETE /companies/:id → 200', (await api('DELETE', `/companies/${createdCompany.body.company._id}`)).status === 200);

  // ------------------------------------------------------- application CRUD
  group('Applications');
  const applications = await api('GET', '/applications');
  check(`GET /applications → 3 seeded applications (got ${applications.body.count})`, applications.body.count === 3, applications.body);
  const firstApplication = applications.body.applications[0];
  check('job populated on applications', typeof firstApplication.job === 'object' && !!firstApplication.job.title, firstApplication.job);
  check('job.company populated too', typeof firstApplication.job.company === 'object' && !!firstApplication.job.company.name, firstApplication.job.company);
  check('GET /applications/:id → 200', (await api('GET', `/applications/${firstApplication._id}`)).status === 200);
  check('malformed application id → 400', (await api('GET', '/applications/123')).status === 400);
  check('unknown application id → 404', (await api('GET', `/applications/${missingId}`)).status === 404);

  const applicationPayload = {
    job: firstJob._id,
    applicantName: 'Smoke Tester',
    email: 'smoke.tester@example.com',
    phone: '+92 300 1112223',
    coverLetter: 'This application was created by the automated smoke test to verify POST /applications.',
    resumeURL: 'https://drive.example.com/resumes/smoke-tester.pdf',
  };

  const createdApplication = await api('POST', '/applications', applicationPayload);
  check('POST /applications → 201', createdApplication.status === 201, createdApplication.body);
  check('status defaults to "pending"', createdApplication.body.application.status === 'pending', createdApplication.body.application.status);
  check('appliedAt defaults to now', !!createdApplication.body.application.appliedAt, createdApplication.body.application.appliedAt);
  check('missing job → 400', (await api('POST', '/applications', { ...applicationPayload, job: undefined })).status === 400);
  check('unknown job id → 404', (await api('POST', '/applications', { ...applicationPayload, job: missingId })).status === 404);
  check('invalid email → 400', (await api('POST', '/applications', { ...applicationPayload, email: 'not-an-email' })).status === 400);
  check('invalid phone → 400', (await api('POST', '/applications', { ...applicationPayload, phone: 'call me' })).status === 400);
  check('too-short cover letter → 400', (await api('POST', '/applications', { ...applicationPayload, coverLetter: 'too short' })).status === 400);
  check('invalid status enum → 400', (await api('POST', '/applications', { ...applicationPayload, status: 'maybe' })).status === 400);

  const updatedApplication = await api('PUT', `/applications/${createdApplication.body.application._id}`, { status: 'reviewed' });
  check('PUT /applications/:id → 200 and status changed', updatedApplication.status === 200 && updatedApplication.body.application.status === 'reviewed', updatedApplication.body);

  const filtered = await api('GET', `/applications?job=${firstJob._id}`);
  check('GET /applications?job=<id> filters correctly', filtered.body.count >= 1 && filtered.body.applications.every((item) => item.job._id === firstJob._id), filtered.body.count);
  check('invalid ?status → 400', (await api('GET', '/applications?status=maybe')).status === 400);
  check('DELETE /applications/:id → 200', (await api('DELETE', `/applications/${createdApplication.body.application._id}`)).status === 200);

  // ------------------------------------------------------------ blog + misc
  group('Blog endpoints (MongoDB backed)');
  const posts = await api('GET', '/posts');
  check(`GET /posts → 12 posts (got ${posts.body.totalPosts})`, posts.body.totalPosts === 12, posts.body.totalPosts);
  check('pagination intact (2 pages of 10)', posts.body.totalPages === 2 && posts.body.postsPerPage === 10, posts.body);
  check('numeric ids preserved and _id hidden', posts.body.posts[0].id === 1 && posts.body.posts[0]._id === undefined, posts.body.posts[0]);
  check('GET /posts?page=2 → 2 posts', (await api('GET', '/posts?page=2')).body.count === 2);
  check('GET /posts/1 → 200', (await api('GET', '/posts/1')).status === 200);
  check('GET /posts/999 → 404', (await api('GET', '/posts/999')).status === 404);

  const comments = await api('GET', '/posts/1/comments');
  check('GET /posts/1/comments → 2 comments', comments.status === 200 && comments.body.totalComments === 2, comments.body);

  const newComment = await api('POST', '/posts/1/comments', { body: 'A comment created by the smoke test.', author: 'Smoke Tester' });
  check('POST /posts/1/comments → 201', newComment.status === 201, newComment.body);
  check('DELETE /comments/:id → 200', (await api('DELETE', `/comments/${newComment.body.comment.id}`)).status === 200);

  group('Routing + error handling');
  const namespaced = await api('GET', '/api/jobs');
  check('GET /api/jobs → 200 (namespaced mount)', namespaced.status === 200 && namespaced.body.count === 15, namespaced.body.count);
  const unknownRoute = await api('GET', '/does-not-exist');
  check('unknown route → 404 JSON', unknownRoute.status === 404 && unknownRoute.body.success === false, unknownRoute.body);

  const brokenJsonResponse = await fetch(`${base}/jobs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{ "title": "broken json" ',
  });
  check('malformed JSON → 400', brokenJsonResponse.status === 400);

  // ------------------------------------------------------ sample responses
  console.log('\n════════════ SAMPLE RESPONSES ════════════');

  const sampleFiltered = await api('GET', '/jobs?keyword=react&location=remote&type=full-time');
  console.log('\nGET /jobs?keyword=react&location=remote&type=full-time');
  console.log(
    JSON.stringify(
      { success: sampleFiltered.body.success, count: sampleFiltered.body.count, filters: sampleFiltered.body.filters, firstJob: sampleFiltered.body.jobs[0] },
      null,
      2
    ).slice(0, 2000)
  );

  console.log('\nGET /jobs/:id');
  console.log(JSON.stringify((await api('GET', `/jobs/${firstJob._id}`)).body, null, 2).slice(0, 1600));

  console.log('\nPOST /jobs with an invalid body → 400');
  console.log(JSON.stringify((await api('POST', '/jobs', { title: 'x' })).body, null, 2));

  console.log('\nGET /applications (first item)');
  console.log(JSON.stringify(firstApplication, null, 2).slice(0, 1500));

  // ------------------------------------------------------------- summary
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log(`RESULT: ${passed} passed, ${failed} failed (database: ${getConnectionState()})`);
  if (failed > 0) console.log('Failed checks:\n' + failures.map((item) => ` - ${item}`).join('\n'));

  await new Promise((resolve) => server.close(resolve));
  await disconnectDB();

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (error) => {
  console.error('\n❌ SMOKE TEST CRASHED:', error.message);
  if (error.name === 'MongooseServerSelectionError') {
    console.error('   Atlas could not be reached — check Network Access (0.0.0.0/0) and your password.');
  }
  try {
    await disconnectDB();
  } catch {
    // ignore: we are already failing
  }
  process.exit(1);
});
