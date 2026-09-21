/**
 * controllers/companyController.js — request handlers for /companies.
 *
 * Every write goes through Mongoose, so the schema rules (required fields,
 * URL checks, year range, unique name) are always enforced.
 */

const Company = require('../models/Company');
const Job = require('../models/Job');
const Application = require('../models/Application');
const { badRequest, notFound } = require('../utils/httpError');
const { isValidObjectId } = require('../utils/validation');

const COMPANY_WRITABLE_FIELDS = [
  'name',
  'logo',
  'website',
  'description',
  'industry',
  'foundedYear',
];

/**
 * @param {object} body
 * @param {string[]} allowed
 * @returns {object} only the fields the client is allowed to set
 */
function pickWritableFields(body, allowed) {
  const source = body && typeof body === 'object' ? body : {};

  return allowed.reduce((picked, field) => {
    if (source[field] !== undefined) picked[field] = source[field];
    return picked;
  }, {});
}

/**
 * GET /companies
 * Returns every company, alphabetically.
 */
async function listCompanies(req, res) {
  const companies = await Company.find().sort({ name: 1 });

  return res.status(200).json({
    success: true,
    count: companies.length,
    companies,
  });
}

/**
 * GET /companies/:id
 */
async function getCompanyById(req, res) {
  const { id } = req.params;

  if (!isValidObjectId(id)) {
    throw badRequest(`"${id}" is not a valid company id. A company id is a 24-character ObjectId.`);
  }

  const company = await Company.findById(id);

  if (!company) {
    throw notFound(`Company with id ${id} not found.`);
  }

  // Bonus: how many jobs this company has posted (useful on a details page)
  const jobCount = await Job.countDocuments({ company: company._id });

  return res.status(200).json({
    success: true,
    jobCount,
    company,
  });
}

/**
 * POST /companies
 * A duplicate name is refused by the unique index and turned into
 * HTTP 409 Conflict by middleware/errorHandler.js.
 */
async function createCompany(req, res) {
  const companyData = pickWritableFields(req.body, COMPANY_WRITABLE_FIELDS);

  if (Object.keys(companyData).length === 0) {
    throw badRequest(
      'Request body is empty. Send at least name, website, description, industry and foundedYear.'
    );
  }

  const company = await Company.create(companyData);

  return res.status(201).json({
    success: true,
    message: 'Company created successfully.',
    company,
  });
}

/**
 * PUT /companies/:id
 * Uses findById + save() so the schema validators run on the merged document.
 */
async function updateCompany(req, res) {
  const { id } = req.params;

  if (!isValidObjectId(id)) {
    throw badRequest(`"${id}" is not a valid company id. A company id is a 24-character ObjectId.`);
  }

  const company = await Company.findById(id);

  if (!company) {
    throw notFound(`Company with id ${id} not found.`);
  }

  const companyData = pickWritableFields(req.body, COMPANY_WRITABLE_FIELDS);

  if (Object.keys(companyData).length === 0) {
    throw badRequest(
      `No valid company fields provided to update. Allowed fields: ${COMPANY_WRITABLE_FIELDS.join(', ')}.`
    );
  }

  Object.assign(company, companyData);
  await company.save();

  return res.status(200).json({
    success: true,
    message: 'Company updated successfully.',
    company,
  });
}

/**
 * DELETE /companies/:id
 *
 * Deleting a company would leave its jobs pointing at nothing, so the jobs of
 * that company — and the applications sent to those jobs — are deleted too
 * (the same cascade behaviour the blog API uses for posts and comments).
 */
async function deleteCompany(req, res) {
  const { id } = req.params;

  if (!isValidObjectId(id)) {
    throw badRequest(`"${id}" is not a valid company id. A company id is a 24-character ObjectId.`);
  }

  const company = await Company.findById(id);

  if (!company) {
    throw notFound(`Company with id ${id} not found.`);
  }

  const companyJobs = await Job.find({ company: company._id }).select('_id');
  const jobIds = companyJobs.map((job) => job._id);

  const deletedApplications = await Application.deleteMany({ job: { $in: jobIds } });
  const deletedJobs = await Job.deleteMany({ company: company._id });
  await company.deleteOne();

  return res.status(200).json({
    success: true,
    message: 'Company deleted successfully.',
    deletedCompany: company,
    deletedJobs: deletedJobs.deletedCount,
    deletedApplications: deletedApplications.deletedCount,
  });
}

module.exports = {
  listCompanies,
  getCompanyById,
  createCompany,
  updateCompany,
  deleteCompany,
  COMPANY_WRITABLE_FIELDS,
};
