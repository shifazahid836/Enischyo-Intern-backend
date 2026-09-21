/**
 * routes/companies.js — URL definitions for /companies.
 *
 * | Method | Path            | Handler          |
 * |--------|-----------------|------------------|
 * | GET    | /companies      | listCompanies    |
 * | POST   | /companies      | createCompany    |
 * | GET    | /companies/:id  | getCompanyById   |
 * | PUT    | /companies/:id  | updateCompany    |
 * | DELETE | /companies/:id  | deleteCompany    |
 */

const express = require('express');

const companyController = require('../controllers/companyController');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

router
  .route('/')
  .get(asyncHandler(companyController.listCompanies))
  .post(asyncHandler(companyController.createCompany));

router
  .route('/:id')
  .get(asyncHandler(companyController.getCompanyById))
  .put(asyncHandler(companyController.updateCompany))
  .delete(asyncHandler(companyController.deleteCompany));

module.exports = router;
