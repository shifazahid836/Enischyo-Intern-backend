/**
 * add-jobs.js — tops up the database with extra job postings.
 *
 * Unlike `npm run seed` (which clears EVERY collection first), this script only
 * inserts. Existing users, companies, jobs and applications are left exactly as
 * they are, which makes it safe to run against a live database.
 *
 *   node add-jobs.js        # adds 20 postings (default)
 *   node add-jobs.js 35     # adds 35 postings
 *
 * The postings are generated dynamically rather than copy-pasted: each one
 * takes the next role template, the next location, the next job type and the
 * salary band of its seniority level, and its description names the company it
 * is attached to. Titles that already exist are skipped, so running the script
 * again adds a fresh batch instead of duplicates.
 *
 * Companies are picked round-robin from the ones already in the database — run
 * `npm run seed` first if the `companies` collection is empty.
 */

require('dotenv').config();

const { connectDB, disconnectDB } = require('./config/db');
const Company = require('./models/Company');
const Job = require('./models/Job');
const User = require('./models/User');

const DEFAULT_COUNT = 20;

/**
 * Role templates. `level` selects the salary band; all titles are deliberately
 * different from the ones `seed.js` already inserts.
 */
const ROLES = [
  {
    title: 'TypeScript Frontend Engineer',
    level: 'mid',
    summary: 'Own a large TypeScript codebase, tightening types where they are loose and shipping UI that stays fast as it grows.',
    requirements: ['3+ years with TypeScript', 'Modern React or Vue', 'Component testing', 'Web performance profiling'],
  },
  {
    title: 'GraphQL API Developer',
    level: 'mid',
    summary: 'Design and evolve the GraphQL schema our clients depend on, with resolvers that stay fast under real query shapes.',
    requirements: ['GraphQL schema design', 'Node.js services', 'N+1 and dataloader experience', 'API versioning strategy'],
  },
  {
    title: 'Site Reliability Engineer',
    level: 'senior',
    summary: 'Keep production healthy with good observability, sensible SLOs and automation that quietly removes toil.',
    requirements: ['Monitoring and alerting', 'Incident response experience', 'Scripting and automation', 'Linux and networking'],
  },
  {
    title: 'Cloud Solutions Architect',
    level: 'lead',
    summary: 'Design cloud architecture that is cost-aware, resilient and simple enough for the team to actually operate.',
    requirements: ['Deep AWS or Azure experience', 'Networking fundamentals', 'Cost optimisation', 'Architecture documentation'],
  },
  {
    title: 'Security Engineer',
    level: 'senior',
    summary: 'Harden our applications and infrastructure, and make security something the team builds in rather than bolts on.',
    requirements: ['Application security experience', 'Threat modelling', 'Secure code review', 'Familiarity with the OWASP Top 10'],
  },
  {
    title: 'Data Analyst',
    level: 'junior',
    summary: 'Turn product and operations data into decisions, building dashboards and answering questions with evidence.',
    requirements: ['Strong SQL', 'Spreadsheet and dashboarding skills', 'Basic statistics', 'Clear written communication'],
  },
  {
    title: 'Business Intelligence Developer',
    level: 'mid',
    summary: 'Build the reporting layer the whole company reads from, making sure the numbers agree with each other.',
    requirements: ['SQL and data modelling', 'A BI tool such as Power BI or Looker', 'Stakeholder requirements gathering', 'ETL basics'],
  },
  {
    title: 'Python Backend Developer',
    level: 'senior',
    summary: 'Build the services behind our data-heavy product, where correctness and throughput matter equally.',
    requirements: ['4+ years with Python', 'Django, FastAPI or Flask', 'PostgreSQL or MongoDB', 'Background job processing'],
  },
  {
    title: 'Go Backend Developer',
    level: 'senior',
    summary: 'Write small, fast Go services with explicit error handling and a bias for readability over cleverness.',
    requirements: ['Production Go experience', 'gRPC or REST services', 'Concurrency patterns', 'Profiling and tuning'],
  },
  {
    title: 'Vue.js Developer',
    level: 'mid',
    summary: 'Build and maintain our Vue 3 front-end, including the shared component library other teams consume.',
    requirements: ['2+ years with Vue', 'Composition API', 'Pinia or Vuex', 'Build tooling with Vite'],
  },
  {
    title: 'Angular Developer',
    level: 'mid',
    summary: 'Extend a large Angular application for an enterprise client, keeping modules clean and upgrades painless.',
    requirements: ['Angular and RxJS', 'TypeScript', 'Reactive forms', 'Testing with Jasmine or Jest'],
  },
  {
    title: 'Next.js Developer',
    level: 'mid',
    summary: 'Ship a fast, SEO-friendly marketing and app surface with server components and good caching.',
    requirements: ['Next.js App Router', 'React and TypeScript', 'Rendering strategies', 'Core Web Vitals'],
  },
  {
    title: 'Database Administrator',
    level: 'senior',
    summary: 'Own the health of our databases: schema evolution, backups, performance tuning and access control.',
    requirements: ['MongoDB or PostgreSQL administration', 'Backup and recovery', 'Query performance tuning', 'Access control design'],
  },
  {
    title: 'Scrum Master',
    level: 'mid',
    summary: 'Help two delivery teams keep a sustainable pace, removing blockers and improving how they work together.',
    requirements: ['Agile coaching experience', 'Facilitation skills', 'Working knowledge of Jira', 'Conflict resolution'],
  },
  {
    title: 'Business Analyst',
    level: 'junior',
    summary: 'Bridge business needs and technical delivery by turning fuzzy requests into clear, testable requirements.',
    requirements: ['Requirements gathering', 'Process mapping', 'Strong documentation', 'Stakeholder workshops'],
  },
  {
    title: 'Embedded Software Engineer',
    level: 'senior',
    summary: 'Write firmware for our connected devices, where correctness, power use and timing all matter.',
    requirements: ['C or C++', 'Microcontroller experience', 'Debugging with logic analysers', 'RTOS basics'],
  },
  {
    title: 'iOS Developer (Swift)',
    level: 'mid',
    summary: 'Build a polished iOS app in Swift, owning performance, accessibility and App Store releases.',
    requirements: ['Swift and SwiftUI or UIKit', '2+ years shipping iOS apps', 'Xcode and Instruments', 'App Store review process'],
  },
  {
    title: 'Android Developer (Kotlin)',
    level: 'mid',
    summary: 'Build our Android app in Kotlin, from architecture decisions down to the small interaction details.',
    requirements: ['Kotlin and Jetpack Compose', 'Android architecture components', 'Play Store releases', 'Unit and UI testing'],
  },
  {
    title: 'Game Developer (Unity)',
    level: 'mid',
    summary: 'Build gameplay systems in Unity that feel responsive, and keep the frame budget under control.',
    requirements: ['Unity and C#', 'Gameplay and physics systems', 'Performance profiling', 'Shipped a title or prototype'],
  },
  {
    title: 'Blockchain Developer',
    level: 'senior',
    summary: 'Write and review smart contracts where bugs are expensive, with a strong testing and audit culture.',
    requirements: ['Solidity and EVM fundamentals', 'Smart contract testing', 'Security best practices', 'Node.js tooling'],
  },
  {
    title: 'Integration Engineer',
    level: 'mid',
    summary: 'Connect our product to third-party systems, handling auth, retries, rate limits and messy real-world data.',
    requirements: ['REST and webhook integration', 'OAuth flows', 'Robust error handling', 'Reading API documentation well'],
  },
  {
    title: 'Technical Support Engineer',
    level: 'junior',
    summary: 'Be the technical voice customers reach first, diagnosing issues and feeding patterns back to engineering.',
    requirements: ['Troubleshooting mindset', 'Basic SQL and log reading', 'Excellent customer communication', 'Ticketing systems'],
  },
  {
    title: 'Software Engineer in Test',
    level: 'mid',
    summary: 'Work inside a product squad to make quality everyone\'s habit rather than a final gate before release.',
    requirements: ['Test design experience', 'Automation frameworks', 'CI pipeline familiarity', 'Good bug reports'],
  },
  {
    title: 'Platform Engineer',
    level: 'senior',
    summary: 'Build the internal developer platform that lets product teams ship without waiting on anyone else.',
    requirements: ['Kubernetes and container tooling', 'Go or TypeScript', 'Developer experience mindset', 'Observability tooling'],
  },
  {
    title: 'Engineering Manager',
    level: 'lead',
    summary: 'Lead a squad of six to eight engineers, balancing delivery, technical health and individual growth.',
    requirements: ['Experience managing engineers', 'Technical background', 'Hiring and onboarding', 'Delivery planning'],
  },
  {
    title: 'Data Scientist',
    level: 'senior',
    summary: 'Frame ambiguous business questions as measurable problems, then answer them with data and honest uncertainty.',
    requirements: ['Python and pandas', 'Statistics and experiment design', 'Machine learning fundamentals', 'Communicating findings'],
  },
  {
    title: 'Computer Vision Engineer',
    level: 'senior',
    summary: 'Build vision models that survive real-world lighting, motion and edge cases, not just clean benchmarks.',
    requirements: ['PyTorch or TensorFlow', 'Image and video pipelines', 'Model optimisation', 'Evaluation and error analysis'],
  },
  {
    title: 'Network Engineer',
    level: 'mid',
    summary: 'Design and operate the networks our services run on, with monitoring that catches problems before users do.',
    requirements: ['Routing and switching', 'Firewalls and VPNs', 'Network monitoring', 'Cloud networking'],
  },
  {
    title: 'Salesforce Developer',
    level: 'mid',
    summary: 'Build and customise Salesforce for a growing sales team without turning the org into an unmaintainable mess.',
    requirements: ['Apex and Lightning', 'Salesforce integrations', 'Declarative automation limits', 'Release management'],
  },
  {
    title: 'Automation Engineer (RPA)',
    level: 'junior',
    summary: 'Automate the repetitive back-office work nobody should be doing by hand, and document how it runs.',
    requirements: ['Scripting (Python or PowerShell)', 'Process documentation', 'Attention to edge cases', 'Comfortable with APIs'],
  },
];

/** Rotated so consecutive postings never repeat a value back-to-back. */
const LOCATIONS = [
  'Remote (Worldwide)',
  'Karachi, Pakistan',
  'Lahore, Pakistan',
  'Remote (Asia)',
  'Islamabad, Pakistan',
  'Dubai, UAE',
  'Bangalore, India',
  'London, UK',
  'Remote (Europe)',
  'Berlin, Germany',
  'Toronto, Canada',
  'Singapore',
];

const TYPES = ['full-time', 'remote', 'part-time'];

/** Monthly salary range per seniority level, in the seed data's currency. */
const SALARY_BANDS = {
  junior: [35000, 55000],
  mid: [60000, 90000],
  senior: [95000, 140000],
  lead: [130000, 180000],
};

/**
 * Title suffix for the second and third pass through ROLES, so asking for more
 * postings than there are templates still produces natural titles.
 */
const LAP_SUFFIXES = ['', ' (Contract)', ' (Fixed Term)'];

/** @returns {Date} `days` days in the past */
function daysAgo(days) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date;
}

/** @returns {Date} `days` days in the future */
function daysFromNow(days) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date;
}

/**
 * Builds up to `count` job documents, skipping titles that already exist.
 *
 * @param {number} count
 * @param {{ _id: unknown, name: string }[]} companies
 * @param {{ _id: unknown }[]} employers
 * @param {Set<string>} takenTitles lowercase titles already in the database
 * @returns {object[]}
 */
function buildJobs(count, companies, employers, takenTitles) {
  const documents = [];

  for (let lap = 0; lap < LAP_SUFFIXES.length && documents.length < count; lap += 1) {
    ROLES.forEach((role) => {
      if (documents.length >= count) return;

      const title = `${role.title}${LAP_SUFFIXES[lap]}`;
      if (takenTitles.has(title.toLowerCase())) return;

      const index = documents.length;
      const company = companies[index % companies.length];
      const [salaryMin, salaryMax] = SALARY_BANDS[role.level];

      documents.push({
        title,
        description:
          `${role.summary} As the ${title} at ${company.name} you will own your work end to end — ` +
          'from design discussions and implementation through testing, code review and release. ' +
          'The team works async-first, with a strong review culture and a bias for small, reversible changes.',
        requirements: role.requirements,
        salaryMin,
        salaryMax,
        type: TYPES[index % TYPES.length],
        location: LOCATIONS[index % LOCATIONS.length],
        company: company._id,
        employer: employers[index % employers.length]._id,
        postedDate: daysAgo(index % 14),
        deadline: daysFromNow(30 + (index % 5) * 9),
        isActive: true,
      });

      takenTitles.add(title.toLowerCase());
    });
  }

  return documents;
}

/**
 * Inserts `count` extra postings.
 *
 * @param {number} [count]
 * @param {{ keepConnection?: boolean, silent?: boolean }} [options]
 * @returns {Promise<{ before: number, inserted: number, after: number }>}
 */
async function addJobs(count = DEFAULT_COUNT, options = {}) {
  const { keepConnection = false, silent = false } = options;
  const log = (...args) => {
    if (!silent) console.log(...args);
  };

  log('⏳ Connecting to MongoDB...');
  await connectDB();

  try {
    const [companies, employers, before, existing] = await Promise.all([
      Company.find({}, 'name').sort({ name: 1 }).lean(),
      User.find({ role: 'employer' }, '_id').sort({ email: 1 }).lean(),
      Job.countDocuments(),
      Job.find({}, 'title').lean(),
    ]);

    if (companies.length === 0) {
      throw new Error('No companies found. Run `npm run seed` first — every job needs a company.');
    }
    if (employers.length === 0) {
      throw new Error('No employer accounts found. Run `npm run seed` first.');
    }

    const takenTitles = new Set(existing.map((job) => job.title.toLowerCase()));
    const documents = buildJobs(count, companies, employers, takenTitles);

    if (documents.length === 0) {
      log('ℹ️  Nothing to add — every generated title already exists.');
      return { before, inserted: 0, after: before };
    }

    // Job.create() runs the full schema validation on every document, so
    // anything that slips past the generator is rejected right here.
    const created = await Job.create(documents);

    const after = await Job.countDocuments();
    const active = await Job.countDocuments({ isActive: true });

    log(`✅ Inserted ${created.length} postings (${count} requested).`);
    log(`   Jobs before: ${before}`);
    log(`   Jobs after:  ${after}  (${active} active)`);
    log('');

    created.slice(0, 8).forEach((job) => log(`   • ${job.title} — ${job.location} [${job.type}]`));
    if (created.length > 8) log(`   … and ${created.length - 8} more`);

    return { before, inserted: created.length, after };
  } finally {
    if (!keepConnection) await disconnectDB();
  }
}

// Running the file directly (`node add-jobs.js 20`) executes it; importing it
// from another script only exposes addJobs().
if (require.main === module) {
  const requested = Number(process.argv[2]);
  const count = Number.isInteger(requested) && requested > 0 ? requested : DEFAULT_COUNT;

  addJobs(count).catch(async (error) => {
    console.error('❌', error.message);
    await disconnectDB().catch(() => {});
    process.exit(1);
  });
}

module.exports = { addJobs, buildJobs, ROLES, LOCATIONS, TYPES, SALARY_BANDS, DEFAULT_COUNT };
