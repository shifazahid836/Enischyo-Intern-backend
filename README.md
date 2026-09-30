# Job Board API — Express + MongoDB Atlas + Mongoose

A REST API for a job board, built with **Node.js**, **Express.js**, **MongoDB Atlas** and
**Mongoose**. It provides complete CRUD for **companies**, **jobs** and **applications**,
a dynamic job search endpoint, schema-level validation, centralised error handling and a
seed script that fills the database with realistic sample data.

Authentication is JWT based: accounts have a role (`jobseeker`, `employer` or `admin`),
passwords are hashed with **bcrypt** (12 salt rounds) and the write endpoints are guarded
by `protect` + `authorize(...)` middleware — see
[Authentication, roles & protected routes](#-authentication-roles--protected-routes).

> 🗄️ **All data lives in MongoDB Atlas.** The in-memory JavaScript arrays that used to sit in
> `data/` are gone: `models/` are Mongoose models and `config/db.js` is the only place that
> knows the connection string. The original blog endpoints (`/posts`, `/comments`) are still
> available and now also use MongoDB.

---

## 📖 Project overview

| Item | Value |
| --- | --- |
| Base URL | `http://localhost:5000` |
| Available at | `http://localhost:5000/jobs` **and** `http://localhost:5000/api/jobs` |
| Database | MongoDB Atlas (free tier) via Mongoose |
| Seed data | 4 users, 5 companies, 15 jobs, 3 applications, 12 posts, 6 comments |
| User roles | `jobseeker`, `employer`, `admin` |
| Auth | JWT Bearer token (`Authorization: Bearer <token>`), 7-day expiry, bcrypt hashes (12 rounds) |
| Job types | `full-time`, `part-time`, `remote` |
| Application statuses | `pending`, `reviewed`, `accepted`, `rejected` |

---

## 🧰 Technologies used

| Technology | Why it is used |
| --- | --- |
| **Node.js** | JavaScript runtime for the server |
| **Express.js** | Routing and middleware framework for the API |
| **MongoDB Atlas** | Cloud-hosted MongoDB database |
| **Mongoose** | Schemas, validation, references (`populate`) and queries |
| **bcrypt** | Hashes passwords before they are stored (salt rounds = 12) |
| **jsonwebtoken** | Signs the token on register/login and verifies it on every protected request |
| **express-rate-limit** | Login brute-force protection: 5 attempts per 15 minutes |
| **dotenv** | Loads `MONGODB_URI`, `JWT_SECRET` and `PORT` from `.env` (never hard-coded) |
| **morgan** | HTTP request logging (method, URL, status, response time) |
| **nodemon** | Development tool that restarts the server on file changes |
| **Postman** | Manual testing of every endpoint |

---

## 📁 Project structure

```
backend/
├── config/
│   └── db.js                     # connectDB / disconnectDB (the only Mongo entry point)
├── models/
│   ├── User.js                   # name, email (unique), password (bcrypt hash), role, createdAt
│   ├── Company.js                # name, logo, website, description, industry, foundedYear
│   ├── Job.js                    # title, description, requirements[], salaryMin/Max, type,
│   │                             #   location, company (ObjectId ref), employer (ObjectId ref),
│   │                             #   postedDate, deadline
│   ├── Application.js            # job (ObjectId ref), applicantName, email, phone,
│   │                             #   coverLetter, resumeURL, status, appliedAt
│   ├── Post.js                   # blog posts (kept for the original API, numeric ids)
│   └── Comment.js                # blog comments (kept for the original API, numeric ids)
├── controllers/
│   ├── authController.js         # register / login / me / change-password (+ admin user list)
│   ├── jobController.js          # list / read / create / update / delete + search filters
│   ├── companyController.js      # CRUD (+ cascade delete of its jobs)
│   ├── applicationController.js  # CRUD (+ verifies the job exists, populates it)
│   ├── postController.js         # blog posts (MongoDB backed)
│   └── commentController.js      # blog comments (MongoDB backed)
├── routes/
│   ├── auth.js                   # /auth (register, login, me, change-password)
│   ├── jobs.js                   # /jobs
│   ├── companies.js              # /companies
│   ├── applications.js           # /applications
│   ├── posts.js                  # /posts (+ nested /posts/:postId/comments)
│   └── comments.js               # /comments/:id
├── middleware/
│   ├── cors.js                   # allows the frontend dev server to call the API
│   ├── logger.js                 # morgan + custom response-time logger
│   ├── auth.js                   # protect (Bearer token → req.user) + authorize(...roles)
│   ├── rateLimit.js              # loginLimiter: 5 attempts / 15 minutes per IP
│   ├── validation.js             # post/comment body validation
│   ├── errorHandler.js           # 404 handler + central 400/401/403/429/500/503 translation
│   └── requireDatabase.js        # replies 503 instead of hanging when Atlas is down
├── utils/
│   ├── validation.js             # email / phone / URL / ObjectId helpers (shared)
│   ├── jwt.js                    # signToken / verifyToken (secret + 7-day expiry in one place)
│   ├── httpError.js              # errors that carry an HTTP status code (401 / 403 included)
│   └── asyncHandler.js           # forwards async errors to the error handler
├── app.js                        # express app: middleware + route mounting
├── server.js                     # entry point: connect to MongoDB, then listen
├── seed.js                       # `npm run seed` → fills the database (users included)
├── postman/
│   ├── Blog-API.postman_collection.json   # the original blog / jobs collection
│   └── Auth-API.postman_collection.json   # JWT + roles: every protected route
├── tests/
│   ├── validation-smoke.js       # `npm run test:validation` (no database needed)
│   ├── auth-smoke.js             # `npm run test:auth` (stubs User.findById, no database)
│   └── api-smoke.js              # `npm run test:api` (real HTTP + MongoDB)
├── .env                          # MONGODB_URI + JWT_SECRET + PORT (git-ignored)
├── .env.example                  # template with placeholders only
├── .gitignore                    # keeps .env and node_modules out of Git
└── package.json
```

**Why this structure?** `server.js` only starts the process, `app.js` configures Express,
`routes/` maps URLs to controllers, `controllers/` holds the logic, `models/` own the data
and `config/db.js` owns the connection. Nothing else touches MongoDB.

---

## 🚀 Quick start (5 commands)

```bash
cd backend
npm install                 # 1. install dependencies (express, mongoose, bcrypt, jsonwebtoken, …)
copy .env.example .env      # 2. create your env file (Windows: copy  |  macOS/Linux: cp)
#   3. open .env and set MONGODB_URI + JWT_SECRET (see the next sections)
npm run seed                # 4. fill the database with sample data (users included)
npm run dev                 # 5. start the server with nodemon
```

Then open <http://localhost:5000/jobs> — you should see the 15 seeded jobs.

Log in right away with a seeded account to get a token:

```bash
curl -X POST http://localhost:5000/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"admin@enischyo.test\",\"password\":\"Admin12345!\"}"
```

---

## ☁️ MongoDB Atlas setup (step by step)

1. **Create an account** — go to <https://www.mongodb.com/cloud/atlas/register> and sign up
   (the free tier needs no credit card).
2. **Create a free cluster** — *Build a Database* → choose **M0 / Free** → pick the provider
   and the region closest to you → *Create*.
3. **Create a database user** — left menu *Database Access* → *Add New Database User*:
   - Authentication: **Password**
   - Username: for example `jobboard_user`
   - Password: click *Autogenerate Secure Password* and **save it somewhere safe**
     (you will paste it into `.env` in step 7 — you will not be able to see it again)
   - Database User Privileges: **Read and write to any database** → *Add User*
4. **Allow network access** — left menu *Network Access* → *Add IP Address*:
   - Click **Allow Access from Anywhere** → this fills in `0.0.0.0/0`
   - *Confirm*. (Fine for development; for production restrict it to your server's IP.)
5. **Wait for the cluster** to finish provisioning (green status), then *Connect* →
   **Drivers** → **Node.js**.
6. **Copy the connection string.** It looks like this (placeholders shown in `< >`):

   ```
   mongodb+srv://<db_username>:<db_password>@<cluster_name>.xxxxx.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0
   ```

7. **Create the `.env` file** in the `backend/` folder:

   ```bash
   copy .env.example .env      # Windows
   cp .env.example .env        # macOS / Linux
   ```

8. **Paste the connection string** into it, replacing the placeholders and adding a database
   name (`jobboard`) before the `?`:

   ```ini
   MONGODB_URI=mongodb+srv://jobboard_user:YOUR_PASSWORD@cluster0.abcde.mongodb.net/jobboard?retryWrites=true&w=majority&appName=Cluster0
   ```

   Tips:
   - Replace `<db_password>` with the password from step 3.
   - Add `/jobboard` before the `?` so the app uses a database called `jobboard`
     (MongoDB creates it automatically on the first insert).
   - If your password contains `@`, `/` or `#`, URL-encode it
     (`@` → `%40`, `/` → `%2F`, `#` → `%23`).
   - **Never** commit this value. `.env` is already listed in `.gitignore`.

9. **Seed the database**:

   ```bash
   npm run seed
   ```

10. **Start the server**:

    ```bash
    npm run dev      # nodemon (auto-restart) — or: npm start
    ```

---

## 🌱 Seeding the database (`npm run seed`)

`seed.js` connects to Atlas, **clears** the Company, Job, Application, Post and Comment
collections, inserts fresh sample data and closes the connection.

Expected output:

```
⏳ Connecting to MongoDB...
✅ MongoDB connected (database: jobboard)
🧹 Clearing existing collections...
   removed → companies: 5, jobs: 15, applications: 3, posts: 12, comments: 6
🏢 Created 5 companies.
💼 Created 15 jobs.
📨 Created 3 applications.
📝 Created 12 posts and 6 comments.

✅ Seed complete
   Companies:    5
   Jobs:         15
   Applications: 3
   Posts:        12
   Comments:     6
🔌 MongoDB connection closed.
```

The seed script is your proof that the required data exists:

- **5 companies** — TechCorp, ByteBridge, CodeLabs, InnovateSoft, PixelWorks
- **15 jobs** — each one stores the real `ObjectId` of one of those companies
  (that is what makes `populate('company')` work on `GET /jobs`)
- **3 applications** — each one referencing one of the seeded jobs

Every document passes the same Mongoose validation the API uses, so the seed data can never
be "less valid" than data sent over HTTP.

> ⚠️ `npm run seed` **deletes** the existing records in those five collections. Run it on a
> development/demo database, not on production data.

---

## ▶️ Running the server

```bash
npm run dev     # nodemon, restarts on every file change
npm start       # plain node
```

Expected output:

```
✅ MongoDB connected (database: jobboard)
------------------------------------------------------------
🚀  Job Board API is running
    Mode:         development
    Base URL:     http://localhost:5000
    Jobs:         http://localhost:5000/jobs
    Companies:    http://localhost:5000/companies
    Applications: http://localhost:5000/applications
    Health:       http://localhost:5000/health
    Stop server:  Ctrl + C
------------------------------------------------------------
```

The server connects to MongoDB **before** it starts listening, so database-dependent
requests are never served while the connection is still being established. `Ctrl + C`
closes both the HTTP server and the database connection.

If the connection fails you get a checklist instead of a stack trace:

```
❌ Could not connect to MongoDB.
   Reason: ...
   How to fix it:
     1. Create backend/.env (copy .env.example) and set MONGODB_URI ...
     2. In Atlas → Network Access, allow your IP (0.0.0.0/0 for development).
     3. Make sure the database user password in the URI is correct.
```

---

## 🔌 API endpoints

Every route is available both at the root (`/jobs`) and under `/api` (`/api/jobs`).

🔒 = needs `Authorization: Bearer <token>` · 👤 = additionally needs a specific role or ownership.

### Auth

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| `POST` | `/auth/register` | public | Create a `jobseeker` / `employer` account and get a JWT. `role: "admin"` is refused |
| `POST` | `/auth/login` | public · **5 per 15 min** | Verify the password with bcrypt, get a 7-day JWT |
| `GET` | `/auth/me` | 🔒 | The logged-in profile (from the token) |
| `PATCH` | `/auth/change-password` | 🔒 | `{ oldPassword, newPassword }` → re-hashes, returns a fresh token |
| `GET` | `/auth/users` | 🔒👤 admin | List accounts (never includes password hashes) |
| `DELETE` | `/auth/users/:id` | 🔒👤 admin | Delete an account (cannot delete your own) |

### Jobs

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/jobs` | public | All jobs, newest first, company populated. Supports the search filters below |
| `GET` | `/jobs?keyword=react&location=remote&type=full-time` | public | Dynamic search (see below) |
| `GET` | `/jobs/:id` | public | One job (company populated) · `404` when it does not exist |
| `POST` | `/jobs` | 🔒👤 employer | Create a job (validates the body + verifies the company exists) |
| `PUT` | `/jobs/:id` | 🔒👤 owning employer | Update a job (re-validates the merged document) |
| `DELETE` | `/jobs/:id` | 🔒👤 owner **or** admin | Delete a job (also deletes its applications) |

### Search: `GET /jobs`

All three filters are optional and combine with AND:

| Parameter | Matching | Example |
| --- | --- | --- |
| `keyword` | case-insensitive, partial, in **title or description** | `?keyword=react` |
| `location` | case-insensitive, partial | `?location=remote` → "Remote (Asia)", "Remote (Worldwide)" |
| `type` | exact, one of `full-time` / `part-time` / `remote` | `?type=full-time` |

Two extra filters are supported for convenience: `?company=<ObjectId>` and
`?isActive=true|false`.

```http
GET /jobs?keyword=react
GET /jobs?location=remote
GET /jobs?type=full-time
GET /jobs?keyword=react&location=remote&type=full-time
```

The response always echoes the filters that were applied and always populates the company
(`createdAt`, `updatedAt` and the string `id` are omitted below for brevity):

```json
{
  "success": true,
  "count": 2,
  "filters": { "keyword": "react", "location": "remote", "type": "full-time" },
  "jobs": [
    {
      "_id": "68c1f0a4e2b1c4d5e6f7a8b9",
      "title": "React Frontend Developer",
      "type": "full-time",
      "location": "Remote (Worldwide)",
      "salaryMin": 60000,
      "salaryMax": 80000,
      "requirements": ["3+ years of experience with React", "..."],
      "company": {
        "_id": "68c1f0a4e2b1c4d5e6f7a8b0",
        "name": "TechCorp",
        "website": "https://techcorp.example.com",
        "industry": "Software Development",
        "foundedYear": 2012
      },
      "postedDate": "2026-09-17T09:12:44.031Z",
      "deadline": "2026-10-30T09:12:44.031Z",
      "isActive": true
    }
  ]
}
```

### Companies

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/companies` | public | All companies (alphabetical) |
| `GET` | `/companies/:id` | public | One company + `jobCount` |
| `POST` | `/companies` | public | Create a company (duplicate name → `409`) |
| `PUT` | `/companies/:id` | public | Update a company |
| `DELETE` | `/companies/:id` | 🔒👤 admin | Delete a company **and** its jobs and their applications |

### Applications

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/applications` | public | All applications, job + company populated. Filters: `?job=<id>`, `?status=pending` |
| `GET` | `/applications/:id` | public | One application |
| `POST` | `/applications` | 🔒👤 jobseeker | Create an application (verifies the job exists, status defaults to `pending`) |
| `PUT` | `/applications/:id` | 🔒👤 admin | Update an application (typically the `status`) |
| `DELETE` | `/applications/:id` | 🔒👤 admin | Delete an application |

### Blog (original API, now MongoDB backed)

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/posts` | public | Paginated posts (10 per page) |
| `POST` | `/posts` | public | Create a post |
| `GET` / `PUT` | `/posts/:id` | public | Read / update a post |
| `DELETE` | `/posts/:id` | 🔒👤 admin | Delete a post |
| `GET` / `POST` | `/posts/:postId/comments` | public | Comments of a post |
| `DELETE` | `/comments/:id` | 🔒👤 admin | Delete a comment |

> **Note on the spec.** The task listed four rules: employers only for `POST /jobs`, the
> owning employer for `PUT`/`DELETE /jobs/:id`, jobseekers only for `POST /applications`,
> and admins for deleting any resource. Those are implemented exactly as written. The blog
> write endpoints (`POST /posts`, `PUT /posts/:id`, `POST /posts/:postId/comments`) and
> `POST`/`PUT /companies` were left open so the original frontend flow keeps working — they
> can be locked down the same way by adding `protect, authorize('employer', 'admin')`
> to those handlers in `routes/posts.js` and `routes/companies.js`.

### Health

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/health` | Server status + **database state** (works even when Atlas is down) |

---

## 🔐 Authentication, roles & protected routes

### 1. The `User` model

`models/User.js` stores `name`, `email` (unique + lower-cased), `password` (bcrypt hash),
`role` (`jobseeker` | `employer` | `admin`) and `createdAt`.

Three layers keep the password safe:

1. a `pre('save')` hook hashes it with **bcrypt (12 salt rounds)** every time it changes;
2. the field is `select: false`, so a normal query does not even load it;
3. a `toJSON` / `toObject` transform deletes it from every response.

Passwords are compared with `user.comparePassword(plain)` (`bcrypt.compare`) — never `===`,
because bcrypt hashes are salted and the same password produces a different hash each time.

### 2. Register and log in

```http
POST /auth/register
Content-Type: application/json

{ "name": "Ali Raza", "email": "ali@example.com", "password": "StrongPass123!", "role": "employer" }
```

```json
{
  "success": true,
  "message": "Account created successfully.",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "tokenType": "Bearer",
  "expiresIn": "7d",
  "user": {
    "id": "68d1f0a4e2b1c4d5e6f7a8b9",
    "name": "Ali Raza",
    "email": "ali@example.com",
    "role": "employer",
    "createdAt": "2026-09-27T10:15:02.031Z"
  }
}
```

```http
POST /auth/login
Content-Type: application/json

{ "email": "ali@example.com", "password": "StrongPass123!" }
```

Both endpoints return the same body shape. The token payload is `{ sub: <user id>, role }`
and it is valid for **7 days** (`JWT_EXPIRES_IN` in `.env`, default `7d`).

Registration validation order: required fields → e-mail format → password length (8–72) →
role → duplicate e-mail (`409`) → Mongoose schema. `role: "admin"` is refused unless
`ALLOW_ADMIN_REGISTRATION=true` is set deliberately.

### 3. Sending the token

```http
GET /auth/me
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

`middleware/auth.js` (`protect`) then:

1. reads the token from the `Authorization: Bearer <token>` header;
2. verifies signature **and** expiry with `jsonwebtoken` (`utils/jwt.js`);
3. re-loads the user from MongoDB, so a deleted account or a changed role takes effect
   immediately instead of being trusted from a 7-day-old token;
4. attaches the document to `req.user`.

| Situation | Result |
| --- | --- |
| Missing / malformed header | `401 Authentication required. Send an "Authorization: Bearer <token>" header …` |
| Bad signature | `401 Invalid token. Please log in again.` |
| Expired token | `401 Your token has expired. Please log in again.` |
| Valid token, wrong role | `403 Access denied. This action requires the role: …` |

### 4. Who may do what

```js
// routes/jobs.js
router.route('/')
  .get(asyncHandler(jobController.listJobs))                                   // public
  .post(protect, authorize('employer'), asyncHandler(jobController.createJob));

router.route('/:id')
  .get(asyncHandler(jobController.getJobById))                                 // public
  .put(protect, authorize('employer'), asyncHandler(jobController.updateJob))  // + owner check
  .delete(protect, authorize('employer', 'admin'), asyncHandler(jobController.deleteJob));
```

| Action | Rule | Enforced in |
| --- | --- | --- |
| `POST /jobs` | `employer` only (a jobseeker **or** an admin gets `403`) | `routes/jobs.js` → `authorize('employer')` |
| `PUT /jobs/:id` | only the employer stored in `job.employer` | `controllers/jobController.js` → `assertCanEditJob()` |
| `DELETE /jobs/:id` | the owning employer **or** any admin | `controllers/jobController.js` → `assertCanDeleteJob()` |
| `POST /applications` | `jobseeker` only | `routes/applications.js` → `authorize('jobseeker')` |
| `PUT` / `DELETE /applications/:id` | `admin` only | `routes/applications.js` → `authorize('admin')` |
| `DELETE /companies/:id`, `POST`/`DELETE /posts/:id`, `DELETE /comments/:id` | `admin` only | those route files → `authorize('admin')` |
| `GET /auth/users`, `DELETE /auth/users/:id` | `admin` only | `routes/auth.js` → `authorize('admin')` |

`job.employer` is **never** taken from the request body (it is not in `JOB_WRITABLE_FIELDS`):
`createJob` copies `req.user._id`, so nobody can publish a vacancy in somebody else's name.

### 5. Change password

```http
PATCH /auth/change-password
Authorization: Bearer <token>
Content-Type: application/json

{ "oldPassword": "StrongPass123!", "newPassword": "EvenStronger456!" }
```

The current password is verified with bcrypt, the new one is re-hashed by the same pre-save
hook, and a fresh token is returned. ⚠️ Tokens issued **before** the change stay valid until
they expire (a JWT is stateless). To invalidate them, add a `passwordChangedAt` date to the
user and compare it with the token's `iat` claim inside `middleware/auth.js`.

### 6. Rate limiting the login route

`middleware/rateLimit.js` uses **express-rate-limit**: 5 attempts per 15 minutes per IP.
The 6th request is refused **before** bcrypt runs, so an attacker cannot even make the
server do work:

```json
{
  "success": false,
  "message": "Too many login attempts. Try again in 15 minutes.",
  "errors": ["login is limited to 5 attempts per 15 minutes."],
  "retryAfterSeconds": 842
}
```

`RateLimit-Limit`, `RateLimit-Remaining` and `RateLimit-Reset` response headers are sent as
well. The counter is kept in memory, so it resets on restart and is **not** shared between
several instances (use the Redis store for that). `POST /auth/register` has a looser limiter
(30 requests / 15 minutes).

### 7. Try it in Postman

Import `postman/Auth-API.postman_collection.json` (7 folders, 45 requests). It covers every
rule above — including the `401`, `403` and `429` cases — and stores each token in a
collection variable automatically, so the protected requests already send the right header.

Demo accounts created by `npm run seed`:

| Role | Email | Password |
| --- | --- | --- |
| admin | `admin@enischyo.test` | `Admin12345!` |
| employer | `employer1@enischyo.test` | `Employer12345!` |
| employer | `employer2@enischyo.test` | `Employer12345!` |
| jobseeker | `jobseeker1@enischyo.test` | `Jobseeker12345!` |

> ⚠️ Development-only credentials. They live in `seed.js` on purpose, so never ship this seed
> data to a real deployment.

---

## 🧪 Example requests

PowerShell (Windows). `curl.exe` is used so the JSON is easy to read; you can also use
[Postman](https://www.postman.com/) with the same URLs.

```powershell
# Health + database state
curl.exe -s http://localhost:5000/health

# All jobs (company is embedded in every job)
curl.exe -s http://localhost:5000/jobs

# Search: keyword / location / type — individually and together
curl.exe -s "http://localhost:5000/jobs?keyword=react"
curl.exe -s "http://localhost:5000/jobs?location=remote"
curl.exe -s "http://localhost:5000/jobs?type=full-time"
curl.exe -s "http://localhost:5000/jobs?keyword=react&location=remote&type=full-time"

# One job (404 for an unknown id, 400 for a malformed id)
curl.exe -s http://localhost:5000/jobs/<JOB_ID>
curl.exe -s http://localhost:5000/jobs/not-an-id

# Companies
curl.exe -s http://localhost:5000/companies

# Create a company
curl.exe -s -X POST http://localhost:5000/companies -H "Content-Type: application/json" -d "{\"name\":\"Acme Devices\",\"logo\":\"https://logo.example.com/acme.png\",\"website\":\"https://acme.example.com\",\"description\":\"Acme Devices builds connected hardware for smart homes.\",\"industry\":\"Internet of Things\",\"foundedYear\":2019}"

# Create a job (company must be the ObjectId of an existing company)
curl.exe -s -X POST http://localhost:5000/jobs -H "Content-Type: application/json" -d "{\"title\":\"Backend Developer (Node.js)\",\"description\":\"Build and maintain REST APIs with Express and MongoDB for our platform.\",\"requirements\":[\"2+ years with Node.js\",\"Experience with MongoDB\"],\"salaryMin\":55000,\"salaryMax\":75000,\"type\":\"full-time\",\"location\":\"Karachi, Pakistan\",\"company\":\"<COMPANY_ID>\",\"deadline\":\"2026-12-31\",\"isActive\":true}"

# Update / delete a job
curl.exe -s -X PUT http://localhost:5000/jobs/<JOB_ID> -H "Content-Type: application/json" -d "{\"salaryMax\":90000,\"isActive\":false}"
curl.exe -s -X DELETE http://localhost:5000/jobs/<JOB_ID>

# Applications
curl.exe -s http://localhost:5000/applications
curl.exe -s -X POST http://localhost:5000/applications -H "Content-Type: application/json" -d "{\"job\":\"<JOB_ID>\",\"applicantName\":\"Ayesha Khan\",\"email\":\"ayesha.khan@example.com\",\"phone\":\"+92 300 1234567\",\"coverLetter\":\"I have four years of React experience and would love to join your team.\",\"resumeURL\":\"https://drive.example.com/resumes/ayesha-khan.pdf\"}"

# Move an application to another status
curl.exe -s -X PUT http://localhost:5000/applications/<APPLICATION_ID> -H "Content-Type: application/json" -d "{\"status\":\"reviewed\"}"
```

> Replace `<JOB_ID>`, `<COMPANY_ID>` and `<APPLICATION_ID>` with ids returned by the API.

### Example: `POST /jobs` (successful)

```json
{
  "success": true,
  "message": "Job created successfully.",
  "job": {
    "_id": "68c1f0a4e2b1c4d5e6f7a8c1",
    "title": "Backend Developer (Node.js)",
    "type": "full-time",
    "location": "Karachi, Pakistan",
    "salaryMin": 55000,
    "salaryMax": 75000,
    "company": { "_id": "68c1f0a4e2b1c4d5e6f7a8b0", "name": "TechCorp" },
    "postedDate": "2026-09-20T10:15:02.114Z",
    "isActive": true
  }
}
```

### Example: validation error (`400`)

`POST /jobs` with `{"title": "x"}` returns one line per invalid field:

```json
{
  "success": false,
  "message": "Validation failed. Please check the highlighted fields.",
  "errors": [
    "company is required (use the company ObjectId).",
    "Location is required.",
    "Job type is required.",
    "Maximum salary is required.",
    "Minimum salary is required.",
    "Job description is required.",
    "requirements must contain at least one item.",
    "Job title must be at least 3 characters long."
  ]
}
```

---

## 🧪 Automated tests

Three dependency-free scripts are included (they only use Node's built-in `fetch`):

| Command | What it checks | Needs a database? |
| --- | --- | --- |
| `npm run test:validation` | 66 offline checks: every Mongoose rule (required fields, enums, URL / e-mail / phone formats, salary range, deadline order, the `User` role + password rules) **and** the JWT helpers (sign / verify / expiry / wrong secret) **and** every error-handler mapping (400 / 404 / 409 / 500 / 503) | ❌ no |
| `npm run test:auth` | 85 offline checks of the whole auth layer: the bcrypt pre-save hook (cost 12, idempotent, never leaks the password), `protect` (missing / malformed / invalid / expired token, deleted account, `req.user` attached), `authorize` (401 vs 403, the exact role rules), the controllers (register / login / me / change-password happy paths **and** their 400 / 401 / 409 branches) and the job-ownership rules (`PUT`/`DELETE` by owner vs stranger vs admin). `User.findById` is stubbed, so **no database is needed** | ❌ no |
| `npm run test:api` | every endpoint over real HTTP: register / login / `me` / change-password, the 401 + 403 rules on every protected route, the 429 login limit, the job search filters, CRUD for jobs / companies / applications, populated company references and the blog endpoints | ✅ yes (Atlas) |

`npm run test:validation` output (excerpt):

```
── models/Job.js ─────────────────────────────────────────────
  ✓ accepts a valid job
  ✓ rejects an empty requirements array
  ✓ rejects salaryMax < salaryMin
  ✓ rejects a deadline before postedDate
── models/User.js ────────────────────────────────────────────
  ✓ accepts a valid user
  ✓ rejects a password shorter than 8 characters
  ✓ rejects an unknown role
  ✓ comparePassword() explains how to load the hash
── utils/jwt.js ──────────────────────────────────────────────
  ✓ the signed token expires in 7 days
  ✓ an expired token raises TokenExpiredError
  ✓ a token signed with another secret is rejected
═══════════════════════════════════════════════════════════
RESULT: 66 passed, 0 failed
```

`npm run test:api` prints a `✓`/`✗` line per check, then real sample responses
(`GET /jobs?keyword=react&location=remote&type=full-time`, `GET /jobs/:id`,
an invalid `POST /jobs`, `GET /applications`) that you can copy into your report.

> ⚠️ `npm run test:api` runs `seed.js` first, which **clears** the User, Company, Job,
> Application, Post and Comment collections before inserting the sample data (including the
> 4 demo accounts). Point it at the same development database you seed.

---

## ✅ Validation rules

Validation lives in the Mongoose schemas, so it runs for **every** write (API, seed script,
console) and cannot be bypassed.

| Model | Field | Rules |
| --- | --- | --- |
| **User** | `name` | required, trimmed, 2–80 chars |
| | `email` | required, valid e-mail format, stored lowercase, **unique** (duplicate → `409`) |
| | `password` | required, 8–72 chars, **hashed with bcrypt (12 salt rounds)** before saving, never returned by the API |
| | `role` | one of `jobseeker`, `employer`, `admin` — defaults to `jobseeker` |
| | `createdAt` | defaults to the current date/time |
| **Company** | `name` | required, trimmed, 2–100 chars, **unique** (duplicate → `409`) |
| | `logo` | optional, but must be a valid URL when provided |
| | `website` | required, valid URL |
| | `description` | required, 20–2000 chars |
| | `industry` | required, 2–60 chars |
| | `foundedYear` | required, whole number between 1800 and the current year |
| **Job** | `title` | required, trimmed, 3–120 chars |
| | `description` | required, 20–5000 chars |
| | `requirements` | required, array with at least one non-empty string (trimmed, de-duplicated) |
| | `salaryMin` | required, number ≥ 0 |
| | `salaryMax` | required, number ≥ 0, **cannot be lower than `salaryMin`** |
| | `type` | required, one of `full-time`, `part-time`, `remote` |
| | `location` | required, 2–100 chars |
| | `company` | required **ObjectId** referencing a Company that exists |
| | `postedDate` | valid date, defaults to "now" |
| | `deadline` | valid date, must be after `postedDate` |
| | `isActive` | boolean, defaults to `true` |
| **Application** | `job` | required **ObjectId** referencing a Job that exists |
| | `applicantName` | required, trimmed, 2–80 chars |
| | `email` | required, valid e-mail format (stored lowercase) |
| | `phone` | required, digits/spaces/`+`/`-`/parentheses, 7–20 characters |
| | `coverLetter` | required, 30–3000 chars |
| | `resumeURL` | required, valid URL |
| | `status` | one of `pending`, `reviewed`, `accepted`, `rejected` — defaults to `pending` |
| | `appliedAt` | defaults to the current date/time |

`createdAt` / `updatedAt` are added automatically (`timestamps: true`).

---

## 🚨 Error handling

All errors use the same JSON shape, produced by `middleware/errorHandler.js`:

```json
{ "success": false, "message": "…", "errors": ["…"] }
```

| Situation | Status | Example message |
| --- | --- | --- |
| Invalid MongoDB ObjectId | `400` | `"abc" is not a valid job id. A job id is a 24-character ObjectId.` |
| Invalid query parameter | `400` | `type must be one of: full-time, part-time, remote.` |
| Schema validation failure | `400` | `Validation failed. Please check the highlighted fields.` (+ `errors`) |
| Missing required fields | `400` | same as above, one entry per field |
| Malformed JSON body | `400` | `Invalid JSON in request body. Please check the syntax.` |
| Referenced company / job does not exist | `404` | `Company with id … does not exist. Create the company first.` |
| Resource not found | `404` | `Job with id … not found.` |
| Unknown route | `404` | `Route not found` |
| Missing / invalid / expired token | `401` | `Authentication required. Send an "Authorization: Bearer <token>" header …` |
| Wrong login credentials | `401` | `Invalid email or password.` (same message for an unknown email and a wrong password) |
| Wrong role for the action | `403` | `Access denied. This action requires the role: employer.` |
| Editing somebody else's job | `403` | `Only the employer who posted this job can edit it.` |
| More than 5 login attempts in 15 minutes | `429` | `Too many login attempts. Try again in 15 minutes.` |
| Duplicate value (unique index) | `409` | `A record with this name already exists ("TechCorp").` |
| Unexpected server error | `500` | `Internal Server Error` (details hidden in production) |
| Database unreachable | `503` | `Database is not connected, so this request cannot be served right now.` |

---

## 🔒 Environment & security

- The connection string lives **only** in `backend/.env` — there is no hard-coded URI
  anywhere in the source code (`config/db.js` reads `process.env.MONGODB_URI`).
- `JWT_SECRET` also lives only in `.env` (`utils/jwt.js` reads `process.env.JWT_SECRET`).
  Anyone who knows it can mint a token for **any** user, so treat it like a password:
  at least 32 random characters, different per environment. Generate one with:
  `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`.
- Passwords are stored as bcrypt hashes (12 salt rounds) and the `password` field is
  `select: false` **and** stripped by a `toJSON` transform, so it cannot leak in a response.
- `POST /auth/register` refuses `role: "admin"`; admins come from `seed.js` or another admin.
- `.env` is listed in both `.gitignore` files, so it is never committed.
- `.env.example` contains **placeholders only** and is safe to commit.
- If a credential ever leaks, rotate the password in Atlas → *Database Access* →
  *Edit User* → *Edit Password*, and change `JWT_SECRET` (which invalidates every existing
  token, because the signature no longer matches).

`.env` (git-ignored):

```ini
PORT=5000
NODE_ENV=development
CORS_ORIGIN=*
MONGODB_URI=mongodb+srv://<db_username>:<db_password>@<cluster>.mongodb.net/jobboard?retryWrites=true&w=majority
JWT_SECRET=<at least 32 random characters — never reuse the placeholder>
JWT_EXPIRES_IN=7d
ALLOW_ADMIN_REGISTRATION=false
```

Before pushing to GitHub, confirm the file is ignored:

```bash
git status --ignored          # .env should appear under "Ignored files"
git ls-files | findstr .env   # should print nothing (Windows)
```

---

## 🧯 Troubleshooting

| Problem | Cause & fix |
| --- | --- |
| `MONGODB_URI is missing or invalid` | `.env` is missing or the variable is empty. Copy `.env.example` → `.env` and paste your string. |
| `MongooseServerSelectionError` / `Could not connect to MongoDB` | Atlas **Network Access** does not allow your IP. Add `0.0.0.0/0` (development) and wait ~1 minute. |
| `Authentication failed` | Wrong username/password in the URI, or the password is not URL-encoded (`@` → `%40`). |
| Every request returns `503` | The server started without a database connection. Fix `.env`, then restart. |
| `EADDRINUSE: address already in use :::5000` | Another process uses port 5000: stop it or set `PORT=5001` in `.env`. |
| `GET /jobs` is empty | Run `npm run seed`. |
| Changes to `.env` have no effect | Restart the server — environment variables are read once at startup. |

---

## 🧭 Notes on the migration from in-memory data

- `data/posts.js` and `data/comments.js` were **removed**. Their content now lives in
  `seed.js` and is stored in MongoDB.
- The blog API keeps **numeric ids** (`/posts/1`) even though MongoDB uses ObjectIds, so the
  existing frontend and Postman collection keep working unchanged.
- Job, company and application ids are real Mongo ObjectIds (`_id`), which is what allows
  references and `populate()`.
- Deleting a job removes its applications, and deleting a company removes its jobs and their
  applications, so no orphaned documents are left behind.
