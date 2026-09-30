// Load .env variables BEFORE anything else reads process.env
require('dotenv').config();

const app = require('./app');
const { connectDB, disconnectDB } = require('./config/db');
const { isJwtConfigured } = require('./utils/jwt');

// Never hard-code the port: fall back to 5000 only if .env is missing PORT
const PORT = Number(process.env.PORT) || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';

let server = null;

/**
 * Boots the API: connect to MongoDB first, then start accepting requests.
 */
async function start() {
  try {
    await connectDB();
  } catch (error) {
    console.error('------------------------------------------------------------');
    console.error('❌ Could not connect to MongoDB.');
    console.error(`   Reason: ${error.message}`);
    console.error('');
    console.error('   How to fix it:');
    console.error('     1. Create backend/.env (copy .env.example) and set MONGODB_URI');
    console.error('        to your MongoDB Atlas connection string.');
    console.error('     2. In Atlas → Network Access, allow your IP (0.0.0.0/0 for development).');
    console.error('     3. Make sure the database user password in the URI is correct.');
    console.error('------------------------------------------------------------');
    process.exit(1);
  }

  // Fail loudly (but keep running) when the JWT secret is missing: without it
  // /auth/register and /auth/login answer 500 instead of issuing a token.
  if (!isJwtConfigured()) {
    console.warn('------------------------------------------------------------');
    console.warn('⚠️  JWT_SECRET is missing or shorter than 32 characters.');
    console.warn('   /auth/register and /auth/login will fail until it is set in .env.');
    console.warn('   See .env.example for a one-line command that generates a good one.');
    console.warn('------------------------------------------------------------');
  }

  server = app.listen(PORT, () => {
    console.log('------------------------------------------------------------');
    console.log('🚀  Job Board API is running');
    console.log(`    Mode:         ${NODE_ENV}`);
    console.log(`    Base URL:     http://localhost:${PORT}`);
    console.log(`    Auth:         http://localhost:${PORT}/auth/login`);
    console.log(`    Jobs:         http://localhost:${PORT}/jobs`);
    console.log(`    Companies:    http://localhost:${PORT}/companies`);
    console.log(`    Applications: http://localhost:${PORT}/applications`);
    console.log(`    Health:       http://localhost:${PORT}/health`);
    console.log('    Stop server:  Ctrl + C');
    console.log('------------------------------------------------------------');
  });

  // ---------------------------------------------------------------------------
  // Friendly handling of "port already in use" (EADDRINUSE)
  // A port can only be used by ONE process, so starting the server twice
  // (for example two terminals running `npm run dev`) causes this error.
  // ---------------------------------------------------------------------------
  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error('------------------------------------------------------------');
      console.error(`❌ Port ${PORT} is already in use.`);
      console.error('   Another copy of this server (or another program) is using it.');
      console.error('');
      console.error('   How to fix it (pick one):');
      console.error('     1. Stop the other server  → press Ctrl + C in that terminal');
      console.error('     2. Use a different port   → set PORT=5001 in backend/.env');
      console.error('     3. Find the process using the port (Windows):');
      console.error(`        netstat -ano | findstr :${PORT}`);
      console.error('        taskkill /PID <pid> /F');
      console.error('------------------------------------------------------------');
      process.exit(1);
    }

    console.error('❌ Server error:', error.message);
    process.exit(1);
  });

  return server;
}

// ---------------------------------------------------------------------------
// Graceful shutdown: close the HTTP server AND the database connection
// ---------------------------------------------------------------------------
async function shutdown(signal) {
  console.log(`\n🛑 ${signal} received — shutting down...`);

  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }

  await disconnectDB();
  process.exit(0);
}

['SIGINT', 'SIGTERM'].forEach((signal) => {
  process.on(signal, () => {
    shutdown(signal).catch((error) => {
      console.error('❌ Error during shutdown:', error.message);
      process.exit(1);
    });
  });
});

// ---------------------------------------------------------------------------
// Safety nets for unexpected failures (keeps the API from dying silently)
// ---------------------------------------------------------------------------

process.on('unhandledRejection', (reason) => {
  console.error('❌ Unhandled Promise Rejection:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error.message);
  disconnectDB()
    .catch(() => {})
    .finally(() => process.exit(1));
});

// Start the server (unless this file was imported by another script)
if (require.main === module) {
  start();
}

module.exports = { start, shutdown };
