/* eslint-disable @typescript-eslint/no-require-imports */
const { execSync } = require('node:child_process');
const { resolve } = require('node:path');

require('dotenv').config({ path: resolve(__dirname, '../.env.test') });

/**
 * Runs once before all e2e suites. Requires `.env.test` with `DATABASE_URL`.
 */
module.exports = async function globalSetup() {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      'E2E globalSetup: DATABASE_URL missing. Copy .env.test.example to .env.test and set a dedicated test database URL.',
    );
  }

  const root = resolve(__dirname, '..');
  const env = { ...process.env };

  execSync('npx prisma generate', { stdio: 'inherit', cwd: root, env });
  execSync('npx prisma migrate deploy', { stdio: 'inherit', cwd: root, env });
  execSync('npx tsx prisma/seed.ts', { stdio: 'inherit', cwd: root, env });
};
