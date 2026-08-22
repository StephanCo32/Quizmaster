# Quizmaster

Real-time party games for people sharing the same room. This baseline exposes
the Host, Player, and Public display route shells and verifies Supabase
connectivity through a public health endpoint.

## Local development

Requirements: Node.js 24, npm, Docker, and the Supabase CLI installed through
the project dependencies.

```bash
npm install
npx supabase start
cp .env.example .env.local
npm run dev
```

Copy the local API URL, publishable key, and service-role key printed by
`supabase start` into `.env.local`. Then open `http://localhost:3000`.

Application routes:

- `/host`: Host dashboard shell
- `/play`: mobile Player shell
- `/display`: Public display shell
- `/api/health`: application and Supabase connectivity

## Verification

```bash
npm run check
```

CI runs the same checks and validates all migrations against local Supabase.

## Production release

Production is deployed only from a verified signed semantic-version tag on the
protected default branch:

```bash
git tag -s v0.1.0 -m "Release v0.1.0"
git push origin v0.1.0
```

The protected `production` GitHub Environment must define:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_DB_PASSWORD`
- `SUPABASE_PROJECT_ID`
- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

The release workflow verifies the tag, runs the full check, applies pending
Supabase migrations, and deploys the exact commit to Vercel Frankfurt. Configure
an external uptime monitor against `/api/health` as soon as the Production URL
exists; alert on any non-200 response. Application failures emit structured JSON
to Vercel logs, while database and Auth events remain available in Supabase logs.

Normal releases accept only backward-compatible, forward-only migrations. Before
an exceptional destructive migration, create and verify a Supabase backup in the
Production project and record its recovery point in the release notes. Do not run
the migration until that manual prerequisite is complete.
