/**
 * models/Job.js — Mongoose model for a job posting.
 *
 * Two cross-field rules are worth noting:
 *   • salaryMax is validated against salaryMin (a range must make sense)
 *   • deadline is validated against postedDate
 *
 * Both are "document validators": they read the other value from the same
 * document, which is exactly why updates use `doc.save()` instead of
 * `findByIdAndUpdate()` (save() runs the full validation again).
 */

const mongoose = require('mongoose');

const { normalizeStringArray } = require('../utils/validation');

// The three job types allowed by the API (used by the schema AND the search
// endpoint, so they can never get out of sync).
const JOB_TYPES = ['full-time', 'part-time', 'remote'];

const jobSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Job title is required.'],
      trim: true,
      minlength: [3, 'Job title must be at least 3 characters long.'],
      maxlength: [120, 'Job title cannot be longer than 120 characters.'],
    },

    description: {
      type: String,
      required: [true, 'Job description is required.'],
      trim: true,
      minlength: [20, 'Job description must be at least 20 characters long.'],
      maxlength: [5000, 'Job description cannot be longer than 5000 characters.'],
    },

    // Array of strings, e.g. ['React', 'Node.js', '2+ years experience']
    requirements: {
      type: [String],
      required: [true, 'At least one requirement is required.'],
      validate: [
        {
          validator: (value) => Array.isArray(value) && value.length > 0,
          message: 'requirements must contain at least one item.',
        },
        {
          validator: (value) =>
            !Array.isArray(value) ||
            value.every((item) => typeof item === 'string' && item.trim().length > 0),
          message: 'Every requirement must be a non-empty string.',
        },
      ],
      // Trim + drop duplicates before validation runs
      set: (value) => normalizeStringArray(value),
    },

    salaryMin: {
      type: Number,
      required: [true, 'Minimum salary is required.'],
      min: [0, 'Minimum salary cannot be negative.'],
    },

    salaryMax: {
      type: Number,
      required: [true, 'Maximum salary is required.'],
      min: [0, 'Maximum salary cannot be negative.'],
      validate: {
        validator(value) {
          // `this` is the document being validated
          if (this.salaryMin === undefined || this.salaryMin === null) return true;
          return value >= this.salaryMin;
        },
        message: 'Maximum salary (salaryMax) cannot be lower than minimum salary (salaryMin).',
      },
    },

    type: {
      type: String,
      required: [true, 'Job type is required.'],
      lowercase: true, // "Full-Time" is stored as "full-time"
      trim: true,
      enum: {
        values: JOB_TYPES,
        message: `Job type must be one of: ${JOB_TYPES.join(', ')}.`,
      },
    },

    location: {
      type: String,
      required: [true, 'Location is required.'],
      trim: true,
      minlength: [2, 'Location must be at least 2 characters long.'],
      maxlength: [100, 'Location cannot be longer than 100 characters.'],
    },

    // Reference to a document in the "companies" collection.
    // It stores the company's ObjectId — populate() swaps it for the document.
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: [true, 'company is required (use the company ObjectId).'],
    },

    postedDate: {
      type: Date,
      default: Date.now, // sensible default: now
      validate: {
        validator: (value) => value === undefined || value === null || !Number.isNaN(value.getTime()),
        message: 'postedDate must be a valid date.',
      },
    },

    deadline: {
      type: Date,
      validate: {
        validator(value) {
          if (!value) return true; // optional field
          if (Number.isNaN(value.getTime())) return false; // Invalid Date
          if (!this.postedDate) return true;
          return value > this.postedDate;
        },
        message: 'deadline must be a valid date after postedDate.',
      },
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Speeds up "all jobs of this company" and the populate() on GET /jobs
jobSchema.index({ company: 1 });

// Simple text-style searches on title / description (used with case-insensitive
// regex in controllers/jobController.js) and newest-first listing.
jobSchema.index({ postedDate: -1 });
jobSchema.index({ title: 1 });

module.exports = mongoose.model('Job', jobSchema);
module.exports.JOB_TYPES = JOB_TYPES;
