/**
 * seed.js — fills the database with sample data.
 *
 * Usage (from the backend folder):
 *   npm run seed
 *
 * What it does:
 *   1. Connects to MongoDB Atlas using MONGODB_URI from .env
 *   2. Clears the existing Company / Job / Application / Post / Comment records
 *   3. Inserts 5 companies, 15 jobs (each referencing a seeded company),
 *      3 sample applications and the original blog posts + comments
 *   4. Prints a summary and closes the connection
 *
 * Every document below is validated by the Mongoose schemas, so a typo in the
 * seed data fails loudly instead of storing something invalid.
 */

require('dotenv').config();

const { connectDB, disconnectDB } = require('./config/db');

const Company = require('./models/Company');
const Job = require('./models/Job');
const Application = require('./models/Application');
const Post = require('./models/Post');
const Comment = require('./models/Comment');

// ---------------------------------------------------------------------------
// Seed data
// ---------------------------------------------------------------------------

/** @type {object[]} 5 companies — everything the Company schema requires */
const companySeedData = [
  {
    name: 'TechCorp',
    logo: 'https://logo.clearbit.com/techcorp.example.com',
    website: 'https://techcorp.example.com',
    description:
      'TechCorp is a Karachi-based software company building cloud collaboration tools for teams around the world. We value ownership, curiosity and a healthy work-life balance.',
    industry: 'Software Development',
    foundedYear: 2012,
  },
  {
    name: 'ByteBridge',
    logo: 'https://logo.clearbit.com/bytebridge.example.com',
    website: 'https://bytebridge.example.com',
    description:
      'ByteBridge is a remote-first fintech startup with 40+ engineers across 15 countries. We build modern payment infrastructure and believe great work can happen anywhere.',
    industry: 'Financial Technology',
    foundedYear: 2016,
  },
  {
    name: 'CodeLabs',
    logo: 'https://logo.clearbit.com/codelabs.example.com',
    website: 'https://codelabs.example.com',
    description:
      'CodeLabs is a product studio in Lahore with 60+ people. We combine engineering and design to launch digital products for clients across the US and Europe.',
    industry: 'Software Studio',
    foundedYear: 2015,
  },
  {
    name: 'InnovateSoft',
    logo: 'https://logo.clearbit.com/innovatesoft.example.com',
    website: 'https://innovatesoft.example.com',
    description:
      'InnovateSoft is an Islamabad-based company on a mission to modernise healthcare IT in South Asia. We are mission-driven, collaborative and growing quickly.',
    industry: 'Healthcare Technology',
    foundedYear: 2011,
  },
  {
    name: 'PixelWorks',
    logo: 'https://logo.clearbit.com/pixelworks.example.com',
    website: 'https://pixelworks.example.com',
    description:
      'PixelWorks is a distributed design studio helping startups craft delightful products. We work fully remotely with a strong focus on craft, feedback and mentorship.',
    industry: 'Design & Creative',
    foundedYear: 2018,
  },
];

/**
 * 15 jobs. `companyIndex` points at the array above — seed.js replaces it with
 * the real ObjectId of the inserted company, which is what makes the
 * `company` reference work (`populate('company')` on GET /jobs).
 *
 * `daysAgo` / `deadlineInDays` are converted to real dates below, so the seed
 * data never becomes outdated.
 *
 * The first job matches ALL THREE search filters:
 *   GET /jobs?keyword=react&location=remote&type=full-time
 */
const jobSeedData = [
  {
    companyIndex: 0,
    title: 'React Frontend Developer',
    description:
      'Build beautiful, high-performance interfaces for our flagship SaaS dashboard using React and TypeScript. You will own features end to end, from Figma design to production release, and help shape our component library.',
    requirements: [
      '3+ years of experience with React',
      'Strong JavaScript / TypeScript fundamentals',
      'Experience with REST APIs and state management',
      'Understanding of accessibility and performance',
    ],
    salaryMin: 60000,
    salaryMax: 80000,
    type: 'full-time',
    location: 'Remote (Worldwide)',
    daysAgo: 3,
    deadlineInDays: 40,
    isActive: true,
  },
  {
    companyIndex: 1,
    title: 'Node.js Backend Engineer',
    description:
      'Design and scale reliable REST and real-time APIs powering millions of requests per day for our payments platform. You will work async-first with a global team and make architectural decisions that keep our systems fast and safe.',
    requirements: [
      '4+ years building Node.js services',
      'Experience with Express and MongoDB',
      'Knowledge of testing and CI/CD',
      'Familiarity with Docker and Redis',
    ],
    salaryMin: 85000,
    salaryMax: 110000,
    type: 'remote',
    location: 'Remote (Asia)',
    daysAgo: 6,
    deadlineInDays: 45,
    isActive: true,
  },
  {
    companyIndex: 2,
    title: 'Full Stack Developer (MERN)',
    description:
      'Own full-stack features across a React frontend and a Node.js/MongoDB backend for international client projects. You will move confidently between database schema design and polished user interfaces.',
    requirements: [
      '3+ years with React and Node.js',
      'Strong MongoDB data modelling skills',
      'Experience with authentication and RBAC',
      'Familiarity with Git-based workflows',
    ],
    salaryMin: 70000,
    salaryMax: 95000,
    type: 'full-time',
    location: 'Lahore, Pakistan',
    daysAgo: 9,
    deadlineInDays: 30,
    isActive: true,
  },
  {
    companyIndex: 3,
    title: 'React Native Developer',
    description:
      'Help us ship our patient companion app to Android and iOS. You will work in small squads alongside clinicians and designers to improve how patients manage their care.',
    requirements: [
      '2+ years of React Native experience',
      'Published apps on the Play Store or App Store',
      'Solid JavaScript and debugging skills',
    ],
    salaryMin: 45000,
    salaryMax: 60000,
    type: 'part-time',
    location: 'Islamabad, Pakistan',
    daysAgo: 12,
    deadlineInDays: 25,
    isActive: true,
  },
  {
    companyIndex: 4,
    title: 'UI/UX Designer',
    description:
      'Craft delightful interfaces for early-stage startups. You will run discovery workshops, design in Figma and work closely with engineers to keep the shipped product faithful to your designs.',
    requirements: [
      'A portfolio showing product work',
      'Strong Figma skills',
      'Experience with design systems',
      'Good written English for remote collaboration',
    ],
    salaryMin: 40000,
    salaryMax: 65000,
    type: 'remote',
    location: 'Remote (Worldwide)',
    daysAgo: 15,
    deadlineInDays: 35,
    isActive: true,
  },
  {
    companyIndex: 0,
    title: 'DevOps Engineer (AWS)',
    description:
      'Own our deployment pipelines and observability. You will automate infrastructure with Terraform, keep our Kubernetes clusters healthy and make releases boring and predictable.',
    requirements: [
      '3+ years in DevOps or SRE roles',
      'Hands-on AWS experience',
      'Terraform and Kubernetes knowledge',
      'Scripting in Bash or Python',
    ],
    salaryMin: 90000,
    salaryMax: 120000,
    type: 'full-time',
    location: 'Karachi, Pakistan',
    daysAgo: 18,
    deadlineInDays: 42,
    isActive: true,
  },
  {
    companyIndex: 2,
    title: 'Junior JavaScript Developer',
    description:
      'A great first role: you will fix real bugs, write tests and grow into feature work with a mentor reviewing your pull requests every week.',
    requirements: [
      'Solid JavaScript basics',
      'Any personal or course projects',
      'Willingness to learn React and Node.js',
    ],
    salaryMin: 30000,
    salaryMax: 45000,
    type: 'full-time',
    location: 'Lahore, Pakistan',
    daysAgo: 20,
    deadlineInDays: 20,
    isActive: false, // closed position, kept for history
  },
  {
    companyIndex: 1,
    title: 'Product Manager',
    description:
      'Shape the roadmap of our payments platform. You will talk to customers, write crisp specs and work with engineering to ship measurable improvements every month.',
    requirements: [
      '3+ years in product roles',
      'Experience with B2B or fintech products',
      'Strong analytical and writing skills',
    ],
    salaryMin: 95000,
    salaryMax: 130000,
    type: 'full-time',
    location: 'Remote (Europe)',
    daysAgo: 22,
    deadlineInDays: 50,
    isActive: true,
  },
  {
    companyIndex: 3,
    title: 'Data Engineer (Python)',
    description:
      'Build the pipelines that turn clinical data into insights. You will model data in MongoDB and PostgreSQL and keep our nightly jobs reliable.',
    requirements: [
      '3+ years with Python',
      'Experience with ETL pipelines',
      'Comfortable with SQL and NoSQL databases',
    ],
    salaryMin: 80000,
    salaryMax: 105000,
    type: 'full-time',
    location: 'Islamabad, Pakistan',
    daysAgo: 25,
    deadlineInDays: 38,
    isActive: true,
  },
  {
    companyIndex: 4,
    title: 'Mobile Developer (Flutter)',
    description:
      'Build cross-platform mobile apps for our clients. You will own the app architecture and work directly with designers on animations and micro-interactions.',
    requirements: [
      '2+ years with Flutter or Dart',
      'Experience publishing to app stores',
      'Good eye for animation and detail',
    ],
    salaryMin: 65000,
    salaryMax: 85000,
    type: 'remote',
    location: 'Remote (Worldwide)',
    daysAgo: 28,
    deadlineInDays: 33,
    isActive: true,
  },
  {
    companyIndex: 0,
    title: 'QA Automation Engineer',
    description:
      'Protect our releases with automated tests. You will build Playwright suites, triage failures and work with developers to fix flaky tests at the source.',
    requirements: [
      'Experience with Playwright or Cypress',
      'Solid understanding of the testing pyramid',
      'Basic JavaScript or TypeScript',
    ],
    salaryMin: 35000,
    salaryMax: 50000,
    type: 'part-time',
    location: 'Karachi, Pakistan',
    daysAgo: 30,
    deadlineInDays: 28,
    isActive: true,
  },
  {
    companyIndex: 1,
    title: 'Senior React Architect',
    description:
      'Set the frontend direction for our fintech dashboard. You will define patterns, mentor engineers and keep our bundle small and our rendering fast.',
    requirements: [
      '6+ years of frontend experience, including React',
      'Experience designing large-scale frontends',
      'Strong performance and accessibility knowledge',
      'Mentoring experience',
    ],
    salaryMin: 120000,
    salaryMax: 160000,
    type: 'full-time',
    location: 'Remote (Worldwide)',
    daysAgo: 33,
    deadlineInDays: 55,
    isActive: true,
  },
  {
    companyIndex: 2,
    title: 'Backend Developer (Express & MongoDB)',
    description:
      'Extend the REST APIs behind our client projects. You will design Mongoose schemas, write validation and keep endpoints fast and well documented.',
    requirements: [
      '2+ years with Node.js and Express',
      'Confident with Mongoose schemas and queries',
      'Understanding of HTTP status codes and error handling',
    ],
    salaryMin: 60000,
    salaryMax: 85000,
    type: 'full-time',
    location: 'Lahore, Pakistan',
    daysAgo: 36,
    deadlineInDays: 44,
    isActive: true,
  },
  {
    companyIndex: 4,
    title: 'Technical Writer',
    description:
      'Document our design system and developer tooling. You will interview engineers, write guides and keep our public documentation accurate and friendly.',
    requirements: [
      'Excellent written English',
      'Ability to read JavaScript at a basic level',
      'Experience with docs-as-code tools',
    ],
    salaryMin: 25000,
    salaryMax: 40000,
    type: 'part-time',
    location: 'Remote (Asia)',
    daysAgo: 40,
    deadlineInDays: 26,
    isActive: false, // closed position
  },
  {
    companyIndex: 3,
    title: 'Machine Learning Engineer',
    description:
      'Turn clinical data into helpful predictions. You will build, evaluate and deploy models, and work with clinicians to make sure the outputs are safe and explainable.',
    requirements: [
      '3+ years in machine learning roles',
      'Strong Python and scikit-learn or PyTorch',
      'Experience deploying models to production',
      'Understanding of model evaluation and bias',
    ],
    salaryMin: 100000,
    salaryMax: 140000,
    type: 'full-time',
    location: 'Islamabad, Pakistan',
    daysAgo: 45,
    deadlineInDays: 60,
    isActive: true,
  },
];

/**
 * 3 sample applications. `jobIndex` points at jobSeedData; the real Job
 * ObjectId is filled in after the jobs are inserted.
 */
const applicationSeedData = [
  {
    jobIndex: 0, // React Frontend Developer
    applicantName: 'Ayesha Khan',
    email: 'ayesha.khan@example.com',
    phone: '+92 300 1234567',
    coverLetter:
      'I have spent the last four years building React interfaces for SaaS products and I would love to bring that experience to your dashboard team. I am comfortable owning features from design handoff to release.',
    resumeURL: 'https://drive.example.com/resumes/ayesha-khan.pdf',
    status: 'pending',
  },
  {
    jobIndex: 1, // Node.js Backend Engineer
    applicantName: 'Bilal Ahmed',
    email: 'bilal.ahmed@example.com',
    phone: '+92 321 7654321',
    coverLetter:
      'I have designed and maintained Node.js microservices handling high request volumes, and I enjoy the async, documentation-heavy style of remote work. My last project migrated a payment API to Express with full test coverage.',
    resumeURL: 'https://drive.example.com/resumes/bilal-ahmed.pdf',
    status: 'reviewed',
  },
  {
    jobIndex: 4, // UI/UX Designer
    applicantName: 'Sara Malik',
    email: 'sara.malik@example.com',
    phone: '(021) 3456 7890',
    coverLetter:
      'I am a product designer with a portfolio of shipped mobile and web apps. I work with a tight design-to-development loop and I am used to collaborating remotely with engineers across time zones.',
    resumeURL: 'https://drive.example.com/resumes/sara-malik.pdf',
    status: 'accepted',
  },
];

/** 12 blog posts — keeps the original /posts API useful after the migration */
const postSeedData = [
  {
    id: 1,
    title: 'Getting Started with Node.js',
    body: 'Node.js lets you run JavaScript outside the browser. In this post we set up a first project, create a package.json file and run a hello-world script with npm.',
    author: 'Aarav Sharma',
  },
  {
    id: 2,
    title: 'Understanding Express Middleware',
    body: 'Middleware functions are the backbone of an Express application. Each one receives the request, can modify it, and decides whether to continue the chain or send a response. This post walks through logging, validation and error middleware.',
    author: 'Priya Nair',
  },
  {
    id: 3,
    title: 'REST API Design Basics',
    body: 'Good REST APIs use nouns for resources, HTTP verbs for actions and meaningful status codes. We compare 200, 201, 400, 404 and 500 and explain when each one should be returned.',
    author: 'Rahul Verma',
  },
  {
    id: 4,
    title: 'MongoDB and Mongoose in Practice',
    body: 'Mongoose adds schemas, validation and a clean query API on top of MongoDB. This post shows how to model related documents and populate references when reading them back.',
    author: 'Priya Nair',
  },
  {
    id: 5,
    title: 'Handling Errors the Right Way',
    body: 'Centralised error handling keeps controllers short. We look at a single error middleware that understands validation errors, cast errors and duplicate keys, and turns them into helpful JSON responses.',
    author: 'Aarav Sharma',
  },
  {
    id: 6,
    title: 'React State Management Explained',
    body: 'From useState to context and reducers: a beginner-friendly tour of the options for sharing state in a React application, with guidance on when each one is a good fit.',
    author: 'Zoya Fatima',
  },
  {
    id: 7,
    title: 'Async and Await Without the Confusion',
    body: 'Promises, then/catch and async/await are the same thing in different clothing. We rewrite one function three ways to show why await reads better and where the try/catch belongs.',
    author: 'Rahul Verma',
  },
  {
    id: 8,
    title: 'Why Environment Variables Matter',
    body: 'Never commit secrets. This post explains how to keep connection strings and API keys in a .env file that stays out of Git, and how to document the required variables in a .env.example file.',
    author: 'Hina Iqbal',
  },
  {
    id: 9,
    title: 'Building a Job Board with MERN',
    body: 'A walkthrough of the data model behind a job board: companies, jobs and applications, how they reference each other in MongoDB and how to filter job listings by keyword, location and type.',
    author: 'Zoya Fatima',
  },
  {
    id: 10,
    title: 'Writing Validation You Can Trust',
    body: 'Client-side checks are for user experience, server-side checks are for safety. We move the rules into the database model so every write path is validated exactly once.',
    author: 'Hina Iqbal',
  },
  {
    id: 11,
    title: 'Postman Tips for Faster API Testing',
    body: 'Collections, environments and variables turn manual clicking into a repeatable test run. Here are the settings that save the most time when checking an API.',
    author: 'Bilal Ahmed',
  },
  {
    id: 12,
    title: 'Deploying an Express API to the Cloud',
    body: 'A short checklist before your API goes live: environment variables, health checks, connection pooling and reading logs when something inevitably breaks at 2am.',
    author: 'Aarav Sharma',
  },
];

/** 6 comments — note the numeric postId (the blog API keeps numeric ids) */
const commentSeedData = [
  { id: 1, postId: 1, author: 'Priya Nair', body: 'Great introduction, the npm section cleared up a lot for me.' },
  { id: 2, postId: 1, author: 'Rahul Verma', body: 'Would love a follow-up on the event loop and async code.' },
  { id: 3, postId: 2, author: 'Aarav Sharma', body: 'The order of middleware finally makes sense, thank you for the diagram.' },
  { id: 4, postId: 3, author: 'Zoya Fatima', body: 'The status code table is worth printing and pinning above the desk.' },
  { id: 5, postId: 4, author: 'Hina Iqbal', body: 'The populate example would be perfect for the job board project.' },
  { id: 6, postId: 5, author: 'Bilal Ahmed', body: 'Central error handling really does remove a lot of repetition.' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * @param {number} days
 * @returns {Date} a date `days` days in the past
 */
function daysAgoDate(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

/**
 * @param {number} days
 * @returns {Date} a date `days` days in the future
 */
function daysFromNowDate(days) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

/**
 * Seeds the database.
 *
 * Exported so it can also be called from tests:
 *   const { seedDatabase } = require('./seed');
 *   await seedDatabase({ keepConnection: true });
 *
 * @param {{ keepConnection?: boolean, silent?: boolean }} [options]
 * @returns {Promise<{ companies: number, jobs: number, applications: number, posts: number, comments: number }>}
 */
async function seedDatabase(options = {}) {
  const { keepConnection = false, silent = false } = options;
  const log = (...args) => {
    if (!silent) console.log(...args);
  };

  log('⏳ Connecting to MongoDB...');
  await connectDB();

  try {
    // 1. Remove the previous data (order matters only for readability here)
    log('🧹 Clearing existing collections...');
    const removed = await Promise.all([
      Company.deleteMany({}),
      Job.deleteMany({}),
      Application.deleteMany({}),
      Post.deleteMany({}),
      Comment.deleteMany({}),
    ]);

    log(
      `   removed → companies: ${removed[0].deletedCount}, jobs: ${removed[1].deletedCount}, ` +
        `applications: ${removed[2].deletedCount}, posts: ${removed[3].deletedCount}, ` +
        `comments: ${removed[4].deletedCount}`
    );

    // 2. Companies first — jobs need their ObjectIds
    const companies = await Company.create(companySeedData);
    log(`🏢 Created ${companies.length} companies.`);

    // 3. Jobs, with the company reference resolved to a real ObjectId
    const jobDocuments = jobSeedData.map((job) => {
      const { companyIndex, daysAgo, deadlineInDays, ...jobFields } = job;

      return {
        ...jobFields,
        company: companies[companyIndex]._id,
        postedDate: daysAgoDate(daysAgo),
        deadline: daysFromNowDate(deadlineInDays),
      };
    });

    const jobs = await Job.create(jobDocuments);
    log(`💼 Created ${jobs.length} jobs.`);

    // 4. Applications, each pointing at one of the jobs above
    const applicationDocuments = applicationSeedData.map((application) => {
      const { jobIndex, ...applicationFields } = application;

      return {
        ...applicationFields,
        job: jobs[jobIndex]._id,
        appliedAt: daysAgoDate(jobIndex + 1),
      };
    });

    const applications = await Application.create(applicationDocuments);
    log(`📨 Created ${applications.length} applications.`);

    // 5. Blog posts + comments (the original API, now also in MongoDB)
    const posts = await Post.create(postSeedData);
    const comments = await Comment.create(commentSeedData);
    log(`📝 Created ${posts.length} posts and ${comments.length} comments.`);

    log('');
    log('✅ Seed complete');
    log(`   Companies:    ${companies.length}`);
    log(`   Jobs:         ${jobs.length}`);
    log(`   Applications: ${applications.length}`);
    log(`   Posts:        ${posts.length}`);
    log(`   Comments:     ${comments.length}`);

    return {
      companies: companies.length,
      jobs: jobs.length,
      applications: applications.length,
      posts: posts.length,
      comments: comments.length,
    };
  } finally {
    // Always close the connection, even when something failed (idempotent)
    if (!keepConnection) await disconnectDB();
  }
}

// Only run automatically when this file is executed directly (npm run seed)
if (require.main === module) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('------------------------------------------------------------');
      console.error('❌ Seeding failed:', error.message);

      if (error.name === 'ValidationError') {
        console.error('   The seed data does not satisfy the Mongoose schemas:');
        Object.values(error.errors).forEach((detail) =>
          console.error(`     • ${detail.path}: ${detail.message}`)
        );
      }

      console.error('   Check MONGODB_URI in backend/.env and your Atlas network access.');
      console.error('------------------------------------------------------------');
      process.exit(1);
    });
}

module.exports = { seedDatabase, companySeedData, jobSeedData };
