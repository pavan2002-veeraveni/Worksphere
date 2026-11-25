const { execFileSync } = require('child_process');
const path = require('path');

async function main() {
  if (!process.env.VERCEL) {
    console.log('Not running in Vercel build environment; skipping DB bootstrap.');
    return;
  }

  const dbUrl =
    process.env.DATABASE_URL_UNPOOLED ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    '';

  if (!dbUrl || dbUrl === '[SENSITIVE]') {
    console.log('DATABASE_URL not configured; skipping DB bootstrap.');
    return;
  }

  const repoRoot = path.resolve(__dirname, '..');
  const backendDir = path.join(repoRoot, 'backend');
  const knexCli = path.join(repoRoot, 'node_modules', 'knex', 'bin', 'cli.js');
  const env = { ...process.env, TS_NODE_TRANSPILE_ONLY: '1' };

  console.log('Running WorkSphere PostgreSQL migrations on Vercel build...');
  execFileSync(process.execPath, [knexCli, 'migrate:latest', '--env', 'production'], {
    cwd: backendDir,
    env,
    stdio: 'inherit',
  });

  const { Client } = require(require.resolve('pg', { paths: [backendDir, repoRoot] }));
  const isLocal = /localhost|127\.0\.0\.1/.test(dbUrl);
  const client = new Client({
    connectionString: dbUrl,
    ssl: isLocal ? false : { rejectUnauthorized: false },
  });

  await client.connect();
  try {
    const res = await client.query('SELECT COUNT(*)::int AS cnt FROM users');
    const userCount = res.rows[0]?.cnt ?? 0;
    if (userCount === 0) {
      console.log('Empty users table detected; running initial seed data...');
      execFileSync(process.execPath, [knexCli, 'seed:run', '--env', 'production'], {
        cwd: backendDir,
        env,
        stdio: 'inherit',
      });
    } else {
      console.log(`Database already has ${userCount} user(s); skipping seed.`);
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('Vercel DB bootstrap failed:', err.message);
  process.exit(1);
});
