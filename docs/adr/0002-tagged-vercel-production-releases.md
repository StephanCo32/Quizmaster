# Tagged Vercel Production Releases

Quizmaster uses local Next.js and Supabase CLI environments for development and one hosted Production environment, with Vercel server execution and Supabase co-located in Frankfurt. Pull requests run CI without hosted previews or staging; signed semantic-version tags from protected `main` trigger a protected GitHub Actions workflow that applies versioned, backward-compatible Supabase migrations before deploying the exact tagged commit to Vercel Production. This keeps the initial operating model small while isolating local work from Production and making every release reproducible.

## Consequences

- SQL changes live in `supabase/migrations`, validate from scratch in CI, and are applied forward-only. Production database rollback uses a corrective migration rather than reversing an applied migration.
- Production configuration is scoped between Vercel and protected GitHub Environments. `.env.example` documents variable names without values, and the Supabase service-role key remains server-only.
- The initial deployment proves `/host`, `/play`, `/display`, environment validation, and `/api/health` connectivity before game logic is introduced.
- Operations begin with structured Vercel and Supabase logs, external health monitoring, Vercel deployment promotion for application rollback, Supabase managed backups, and an explicit backup before destructive migrations.