/**
 * models/Application.js — Mongoose model for a job application.
 *
 * `job` is an ObjectId reference to the Job collection, so an application can
 * never be orphaned in practice (the controller checks the job exists first).
 */

const mongoose = require('mongoose');

const {
  isValidEmail,
  isValidPhone,
  isValidUrl,
} = require('../utils/validation');

// Allowed values for the application status
const APPLICATION_STATUSES = ['pending', 'reviewed', 'accepted', 'rejected'];

const applicationSchema = new mongoose.Schema(
  {
    job: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Job',
      required: [true, 'job is required (use the job ObjectId).'],
    },

    applicantName: {
      type: String,
      required: [true, 'Applicant name is required.'],
      trim: true,
      minlength: [2, 'Applicant name must be at least 2 characters long.'],
      maxlength: [80, 'Applicant name cannot be longer than 80 characters.'],
    },

    email: {
      type: String,
      required: [true, 'Email is required.'],
      trim: true,
      lowercase: true, // ali@Example.com is stored as ali@example.com
      validate: {
        validator: isValidEmail,
        message: (props) => `"${props.value}" is not a valid email address.`,
      },
    },

    phone: {
      type: String,
      required: [true, 'Phone number is required.'],
      trim: true,
      validate: {
        validator: isValidPhone,
        message: (props) =>
          `"${props.value}" is not a valid phone number (use digits, spaces, +, -, parentheses).`,
      },
    },

    coverLetter: {
      type: String,
      required: [true, 'Cover letter is required.'],
      trim: true,
      minlength: [30, 'Cover letter must be at least 30 characters long.'],
      maxlength: [3000, 'Cover letter cannot be longer than 3000 characters.'],
    },

    resumeURL: {
      type: String,
      required: [true, 'Resume URL is required.'],
      trim: true,
      validate: {
        validator: isValidUrl,
        message: (props) =>
          `"${props.value}" is not a valid resume URL (it must start with http:// or https://).`,
      },
    },

    status: {
      type: String,
      enum: {
        values: APPLICATION_STATUSES,
        message: `Status must be one of: ${APPLICATION_STATUSES.join(', ')}.`,
      },
      default: 'pending', // new applications always start as pending
    },

    appliedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Fast lookups such as GET /applications?job=<id> and ?status=pending
applicationSchema.index({ job: 1 });
applicationSchema.index({ status: 1 });

module.exports = mongoose.model('Application', applicationSchema);
module.exports.APPLICATION_STATUSES = APPLICATION_STATUSES;
