/**
 * Boots the Vercel serverless entry point the way @vercel/node does — with only
 * the root package.json dependencies installed — and checks that it answers.
 *
 * This guards a deployment failure that is invisible locally: the API's
 * dependencies once lived in api-server/package.json, whose node_modules is
 * gitignored and never installed by Vercel, so every /api route returned
 * MODULE_NOT_FOUND in production while working fine on a dev machine.
 */
const path = require('path');

const PORT = 5310;

async function main() {
  // Fake credentials: this checks module resolution and routing, not Supabase.
  process.env.SUPABASE_URL = 'https://boot-check.invalid';
  process.env.SUPABASE_ANON_KEY = 'boot-check';
  process.env.JWT_SECRET = 'boot-check';

  const app = require(path.join(__dirname, '..', 'api', 'index.js'));
  const server = app.listen(PORT);

  try {
    const res = await fetch(`http://127.0.0.1:${PORT}/api/health`);
    const body = await res.json();

    if (res.status !== 200) {
      throw new Error(`/api/health returned ${res.status}, expected 200`);
    }
    if (body.service !== 'ChainJudge API Server') {
      throw new Error(`unexpected health payload: ${JSON.stringify(body)}`);
    }

    console.log('✅ Serverless entry point boots from root dependencies alone.');
    console.log(`   /api/health -> ${res.status} ${JSON.stringify(body)}`);
  } finally {
    server.close();
  }
}

main().catch((err) => {
  console.error('❌ Serverless boot check failed:', err.message);
  console.error('   Every /api/* route would return FUNCTION_INVOCATION_FAILED on Vercel.');
  process.exit(1);
});
