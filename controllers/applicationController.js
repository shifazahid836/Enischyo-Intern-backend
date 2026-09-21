/**
 * controllers/applicationController.js — request handlers for /applications.
 *
 * Rules implemented here:
 *   • the referenced job must exist before an application is stored
 *   • status defaults to "pending" (schema default)
 *   • the job (and its company) is populated on read, so a client sees
 *     everything it needs in one response
 */

const Application = require('../models/Application');
const { APPLICATION_STATUSES } = require('../models/Application');
const Job = require('../models/Job');
const { badRequest, notFound } = require('../utils/httpError');
const { isValidObjectId, isNonEmptyString } = require('../utils/validation');

const APPLICATION_WRITABLE_FIELDS = [
  'job',
  'applicantName',
  'email',
  'phone',
  'coverLetter',
  'resumeURL',
  'status',
  'appliedAt',
];

/**
 * Nested populate: application → job → company.
 * @type {object}
 */
const POPULATE_JOB_WITH_COMPANY = {
  path: 'job',
  populate: { path: 'company' },
};

/**
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
 * Makes sure the job an application points at really exists.
 *
 * @param {unknown} jobId
 * @throws 400 when missing / malformed, 404 when the job does not exist
 */
async function ensureJobExists(jobId) {
  if (jobId === undefined || jobId === null || jobId === '') {
    throw badRequest('job is required. Send the ObjectId of an existing job.');
  }

  if (!isValidObjectId(jobId)) {
    throw badRequest(
      `"${jobId}" is not a valid job id. Use the ObjectId returned by GET /jobs.`
    );
  }

  const jobExists = await Job.exists({ _id: jobId });
  if (!jobExists) {
    throw notFound(`Job with id ${jobId} does not exist.`);
  }
}

/**
 * GET /applications
 * Optional filters: ?job=<ObjectId> and ?status=pending|reviewed|accepted|rejected
 */
async function listApplications(req, res) {
  const filter = {};
  const errors = [];
  const { job, status } = req.query;

  if (isNonEmptyString(job)) {
    if (!isValidObjectId(job)) {
      errors.push('job must be a valid job ObjectId.');
    } else {
      filter.job = job.trim();
    }
  }

  if (isNonEmptyString(status)) {
    const normalizedStatus = status.trim().toLowerCase();

    if (!APPLICATION_STATUSES.includes(normalizedStatus)) {
      errors.push(`status must be one of: ${APPLICATION_STATUSES.join(', ')}.`);
    } else {
      filter.status = normalizedStatus;
    }
  }

  if (errors.length > 0) {
    throw badRequest('Invalid query parameters.', errors);
  }

  const applications = await Application.find(filter)
    .populate(POPULATE_JOB_WITH_COMPANY)
    .sort({ appliedAt: -1, _id: 1 });

  return res.status(200).json({
    success: true,
    count: applications.length,
    applications,
  });
}

/**
 * GET /applications/:id
 */
async function getApplicationById(req, res) {
  const { id } = req.params;

  if (!isValidObjectId(id)) {
    throw badRequest(`"${id}" is not a valid application id. An application id is a 24-character ObjectId.`);
  }

  const application = await Application.findById(id).populate(POPULATE_JOB_WITH_COMPANY);

  if (!application) {
    throw notFound(`Application with id ${id} not found.`);
  }

  return res.status(200).json({ success: true, application });
}

/**
 * POST /applications
 * Verifies the job exists, validates the applicant data through the schema and
 * stores the application with status "pending" (schema default).
 */
async function createApplication(req, res) {
  const applicationData = pickWritableFields(req.body, APPLICATION_WRITABLE_FIELDS);

  if (Object.keys(applicationData).length === 0) {
    throw badRequest(
      'Request body is empty. Send job, applicantName, email, phone, coverLetter and resumeURL.'
    );
  }

  await ensureJobExists(applicationData.job);

  const application = await Application.create(applicationData);
  await application.populate(POPULATE_JOB_WITH_COMPANY);

  return res.status(201).json({
    success: true,
    message: 'Application submitted successfully.',
    application,
  });
}

/**
 * PUT /applications/:id
 * Typically used by an employer to move an application to another status,
 * but any allowed field may be updated.
 */
async function updateApplication(req, res) {
  const { id } = req.params;

  if (!isValidObjectId(id)) {
    throw badRequest(`"${id}" is not a valid application id. An application id is a 24-character ObjectId.`);
  }

  const application = await Application.findById(id);

  if (!application) {
    throw notFound(`Application with id ${id} not found.`);
  }

  const applicationData = pickWritableFields(req.body, APPLICATION_WRITABLE_FIELDS);

  if (Object.keys(applicationData).length === 0) {
    throw badRequest(
      `No valid application fields provided to update. Allowed fields: ${APPLICATION_WRITABLE_FIELDS.join(', ')}.`
    );
  }

  if (applicationData.job !== undefined) {
    await ensureJobExists(applicationData.job);
  }

  Object.assign(application, applicationData);
  await application.save();
  await application.populate(POPULATE_JOB_WITH_COMPANY);

  return res.status(200).json({
    success: true,
    message: 'Application updated successfully.',
    application,
  });
}

/**
 * DELETE /applications/:id
 */
async function deleteApplication(req, res) {
  const { id } = req.params;

  if (!isValidObjectId(id)) {
    throw badRequest(`"${id}" is not a valid application id. An application id is a 24-character ObjectId.`);
  }

  const application = await Application.findById(id);

  if (!application) {
    throw notFound(`Application with id ${id} not found.`);
  }

  await application.deleteOne();

  return res.status(200).json({
    success: true,
    message: 'Application deleted successfully.',
    deletedApplication: application,
  });
}

module.exports = {
  listApplications,
  getApplicationById,
  createApplication,
  updateApplication,
  deleteApplication,
  APPLICATION_WRITABLE_FIELDS,
};
