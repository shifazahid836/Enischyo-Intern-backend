/**
 * models/Company.js — Mongoose model for a hiring company.
 *
 * Validation lives in the schema, so it runs for EVERY write (API, seed
 * script, console) no matter who calls it. Controllers therefore never have
 * to re-implement these rules.
 *
 * Note on the validators: `this` inside a validator is the document, and
 * `props.value` is the value that failed — both are used below to build
 * messages that tell the user exactly what is wrong.
 */

const mongoose = require('mongoose');

const {
  isValidUrl,
  MIN_FOUNDED_YEAR,
  CURRENT_YEAR,
} = require('../utils/validation');

const companySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Company name is required.'],
      trim: true,
      minlength: [2, 'Company name must be at least 2 characters long.'],
      maxlength: [100, 'Company name cannot be longer than 100 characters.'],
    },

    // Optional: a company without a logo is perfectly fine
    logo: {
      type: String,
      trim: true,
      validate: {
        validator: (value) =>
          value === undefined || value === null || value === '' || isValidUrl(value),
        message: (props) => `"${props.value}" is not a valid logo URL.`,
      },
    },

    website: {
      type: String,
      required: [true, 'Company website is required.'],
      trim: true,
      validate: {
        validator: isValidUrl,
        message: (props) =>
          `"${props.value}" is not a valid website URL (it must start with http:// or https://).`,
      },
    },

    description: {
      type: String,
      required: [true, 'Company description is required.'],
      trim: true,
      minlength: [20, 'Company description must be at least 20 characters long.'],
      maxlength: [2000, 'Company description cannot be longer than 2000 characters.'],
    },

    industry: {
      type: String,
      required: [true, 'Industry is required.'],
      trim: true,
      minlength: [2, 'Industry must be at least 2 characters long.'],
      maxlength: [60, 'Industry cannot be longer than 60 characters.'],
    },

    foundedYear: {
      type: Number,
      required: [true, 'Founded year is required.'],
      min: [MIN_FOUNDED_YEAR, `Founded year must be ${MIN_FOUNDED_YEAR} or later.`],
      max: [CURRENT_YEAR, `Founded year cannot be in the future (latest: ${CURRENT_YEAR}).`],
      validate: {
        validator: (value) => value === undefined || Number.isInteger(value),
        message: 'Founded year must be a whole number, for example 2015.',
      },
    },
  },
  {
    timestamps: true, // createdAt + updatedAt
    versionKey: false, // do not expose the internal __v field
    toJSON: { virtuals: true }, // adds a string "id" next to "_id"
    toObject: { virtuals: true },
  }
);

// A duplicate company name would silently create a second, confusing record,
// so the database itself refuses it (the API answers 409 Conflict).
companySchema.index({ name: 1 }, { unique: true });

module.exports = mongoose.model('Company', companySchema);
