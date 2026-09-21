/**
 * controllers/jobController.js — request handlers for /jobs.
 *
 * Controllers only orchestrate: read the request → talk to Mongoose →
 * send JSON. Mongoose validation is the single source of truth, so an invalid
 * document is rejected even if a controller forgets to check something.
 *
 * Errors are thrown with utils/httpError.js and handled centrally by
 * middleware/errorHandler.js (asyncHandler forwards them).
 */

const Job = require('../models/Job');
const { JOB_TYPES } = require('../models/Job');
const Company = require('../models/Company');
const Application = require('../models/Application');
const { badRequest, notFound } = require('../utils/httpError');
const {
  isValidObjectId,
  isNonEmptyString,
  escapeRegExp,
} = require('../utils/validation');

// Fields a client is allowed to send. Anything else (like _id or createdAt)
// is ignored, which protects the document from accidental tampering.
const JOB_WRITABLE_FIELDS = [
  'title',
  'description',
  'requirements',
  'salaryMin',
  'salaryMax',
  'type',
  'location',
  'company',
  'postedDate',
  'deadline',
  'isActive',
];

/**
 * Copies only the allowed keys that the client actually sent.
 *
 * @param {object} body
 * @param {string[]} allowed
 * @returns {object}
 */
function pickWritableFields(body, allowed) {
  const source = body && typeof body === 'object' ? body : {};

  return allowed.reduce((picked, field) => {
    if (source[field] !== undefined) picked[field] = source[field];
    return picked;
  }, {});
}

/**
 * @param {string} value
 * @returns {RegExp} case-insensitive, regex-safe matcher
 */
function caseInsensitiveMatcher(value) {
  return new RegExp(escapeRegExp(value.trim()), 'i');
}

/**
 * Builds the Mongo filter for GET /jobs from the query string.
 *
 * Every parameter is optional and they combine with AND, so both of these work:
 *   GET /jobs?keyword=react
 *   GET /jobs?keyword=react&location=remote&type=full-time
 *
 * @param {object} query Express query object
 * @returns {{ filter: object, appliedFilters: object, errors: string[] }}
 */
function buildSearchFilter(query) {
  const filter = {};
  const appliedFilters = {};
  const errors = [];

  const { keyword, location, type, company, isActive } = query;

  // keyword → title OR description contains the text
  // An empty value ("?keyword=") is simply ignored: a search box that was
  // cleared should return everything, not an error.
  if (isNonEmptyString(keyword)) {
    const matcher = caseInsensitiveMatcher(keyword);
    filter.$or = [{ title: matcher }, { description: matcher }];
    appliedFilters.keyword = keyword.trim();
  }

  // location → partial, case-insensitive match ("remote" finds "Remote (Asia)")
  if (isNonEmptyString(location)) {
    filter.location = caseInsensitiveMatcher(location);
    appliedFilters.location = location.trim();
  }

  // type → must be one of the JOB_TYPES values
  if (isNonEmptyString(type)) {
    const normalizedType = type.trim().toLowerCase();

    if (!JOB_TYPES.includes(normalizedType)) {
      errors.push(`type must be one of: ${JOB_TYPES.join(', ')}.`);
    } else {
      filter.type = normalizedType;
      appliedFilters.type = normalizedType;
    }
  }

  // Extra (optional) filters that make the endpoint more useful
  if (isNonEmptyString(company)) {
    if (!isValidObjectId(company)) {
      errors.push('company must be a valid company ObjectId.');
    } else {
      filter.company = company.trim();
      appliedFilters.company = company.trim();
    }
  }

  if (isNonEmptyString(isActive)) {
    const normalized = isActive.trim().toLowerCase();

    if (normalized !== 'true' && normalized !== 'false') {
      errors.push('isActive must be "true" or "false".');
    } else {
      filter.isActive = normalized === 'true';
      appliedFilters.isActive = normalized === 'true';
    }
  }

  return { filter, appliedFilters, errors };
}

/**
 * Makes sure the company referenced by a job really exists.
 *
 * @param {unknown} companyId
 * @throws 400 when the id is missing / malformed, 404 when it does not exist
 */
async function ensureCompanyExists(companyId) {
  if (companyId === undefined || companyId === null || companyId === '') {
    throw badRequest('company is required. Send the ObjectId of an existing company.');
  }

  if (!isValidObjectId(companyId)) {
    throw badRequest(
      `"${companyId}" is not a valid company id. Use the ObjectId returned by POST /companies.`
    );
  }

  const companyExists = await Company.exists({ _id: companyId });
  if (!companyExists) {
    throw notFound(`Company with id ${companyId} does not exist. Create the company first.`);
  }
}

/**
 * GET /jobs
 * GET /jobs?keyword=react&location=remote&type=full-time
 *
 * Always populates the company so the client does not need a second request.
 */
async function listJobs(req, res) {
  const { filter, appliedFilters, errors } = buildSearchFilter(req.query);

  if (errors.length > 0) {
    throw badRequest('Invalid query parameters.', errors);
  }

  const jobs = await Job.find(filter)
    .populate('company') // replaces the ObjectId with the company document
    .sort({ postedDate: -1, _id: 1 });

  return res.status(200).json({
    success: true,
    count: jobs.length,
    filters: appliedFilters, // echo of what was applied — handy while testing
    jobs,
  });
}

/**
 * GET /jobs/:id
 * 400 for a malformed id, 404 when the job does not exist.
 */
async function getJobById(req, res) {
  const { id } = req.params;

  if (!isValidObjectId(id)) {
    throw badRequest(`"${id}" is not a valid job id. A job id is a 24-character ObjectId.`);
  }

  const job = await Job.findById(id).populate('company');

  if (!job) {
    throw notFound(`Job with id ${id} not found.`);
  }

  return res.status(200).json({ success: true, job });
}

/**
 * POST /jobs
 * Validates the body through the schema and verifies the company reference.
 */
async function createJob(req, res) {
  const jobData = pickWritableFields(req.body, JOB_WRITABLE_FIELDS);

  if (Object.keys(jobData).length === 0) {
    throw badRequest(
      'Request body is empty. Send at least title, description, requirements, salaryMin, salaryMax, type, location and company.'
    );
  }

  // Verify a company reference that WAS provided (friendly 400 / 404 messages).
  // A missing "company" is left to the schema below, so the client gets ONE
  // complete list of validation errors instead of a single message.
  if (jobData.company !== undefined) {
    await ensureCompanyExists(jobData.company);
  }

  const job = new Job(jobData);
  await job.save(); // full schema validation runs here
  await job.populate('company');

  return res.status(201).json({
    success: true,
    message: 'Job created successfully.',
    job,
  });
}

/**
 * PUT /jobs/:id
 *
 * Loads the document, applies only the fields that were sent and calls
 * save(), so ALL validators run again — including the cross-field rules
 * (salaryMax >= salaryMin, deadline after postedDate).
 */
async function updateJob(req, res) {
  const { id } = req.params;

  if (!isValidObjectId(id)) {
    throw badRequest(`"${id}" is not a valid job id. A job id is a 24-character ObjectId.`);
  }

  const job = await Job.findById(id);

  if (!job) {
    throw notFound(`Job with id ${id} not found.`);
  }

  const jobData = pickWritableFields(req.body, JOB_WRITABLE_FIELDS);

  if (Object.keys(jobData).length === 0) {
    throw badRequest(
      `No valid job fields provided to update. Allowed fields: ${JOB_WRITABLE_FIELDS.join(', ')}.`
    );
  }

  if (jobData.company !== undefined) {
    await ensureCompanyExists(jobData.company);
  }

  Object.assign(job, jobData);
  await job.save();
  await job.populate('company');

  return res.status(200).json({
    success: true,
    message: 'Job updated successfully.',
    job,
  });
}

/**
 * DELETE /jobs/:id
 * Also removes the applications that were sent for this job (no orphans).
 */
async function deleteJob(req, res) {
  const { id } = req.params;

  if (!isValidObjectId(id)) {
    throw badRequest(`"${id}" is not a valid job id. A job id is a 24-character ObjectId.`);
  }

  const job = await Job.findById(id);

  if (!job) {
    throw notFound(`Job with id ${id} not found.`);
  }

  const deletedApplications = await Application.deleteMany({ job: job._id });
  await job.deleteOne();

  return res.status(200).json({
    success: true,
    message: 'Job deleted successfully.',
    deletedJob: job,
    deletedApplications: deletedApplications.deletedCount,
  });
}

module.exports = {
  listJobs,
  getJobById,
  createJob,
  updateJob,
  deleteJob,
  JOB_WRITABLE_FIELDS,
};
