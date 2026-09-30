/**
 * routes/companies.js — URL definitions for /companies.
 *
 * | Method | Path            | Auth required     | Handler          |
 * |--------|-----------------|-------------------|------------------|
 * | GET    | /companies      | public            | listCompanies    |
 * | POST   | /companies      | public            | createCompany    |
 * | GET    | /companies/:id  | public            | getCompanyById   |
 * | PUT    | /companies/:id  | public            | updateCompany    |
 * | DELETE | /companies/:id  | Bearer + admin    | deleteCompany    |
 *
 * Deleting a company also deletes its jobs and their applications, which is a
 * destructive operation — hence admin only. The other endpoints are left as
 * they were so the existing frontend flow keeps working; they can be locked
 * down with `protect, authorize('employer', 'admin')` the same way.
 */

const express = require('express');

const companyController = require('../controllers/companyController');
const asyncHandler = require('../utils/asyncHandler');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router
  .route('/')
  .get(asyncHandler(companyController.listCompanies))
  .post(asyncHandler(companyController.createCompany));

router
  .route('/:id')
  .get(asyncHandler(companyController.getCompanyById))
  .put(asyncHandler(companyController.updateCompany))
  .delete(protect, authorize('admin'), asyncHandler(companyController.deleteCompany));

module.exports = router;
