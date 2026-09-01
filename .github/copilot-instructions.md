## Agent skills

### Issue tracker

Issues are tracked in this repository's GitHub Issues via `gh`. See `docs/agents/issue-tracker.md`.

### Triage labels

The canonical triage roles use their default GitHub label names. See `docs/agents/triage-labels.md`.

### Domain docs

Domain documentation follows the single-context layout. See `docs/agents/domain.md`.

### Next.js

This repository uses Next.js 16. Read the relevant local guide under `node_modules/next/dist/docs/` before changing framework APIs or conventions, and heed deprecation notices.

### Environment parity

Local (`supabase/config.toml`) and Production (`supabase/config.production.toml`, Vercel/GitHub Environments) are configured separately; see [0002](../docs/adr/0002-tagged-vercel-production-releases.md). When a change touches config, environment variables, or a Supabase migration, check whether it needs to apply to both environments before considering it complete.

### Supabase CLI

The "local/development" Supabase project is hosted on supabase.com (see `scripts/setup-development.sh`), not a local Docker stack. Never run `npx supabase` commands that assume a local instance (`start`, `stop`, `status`, `test db --local`, `db reset`); they will fail or target the wrong thing. Verify SQL migrations by careful reading instead, and leave running them against the hosted project (`--linked` commands) to the user or CI.

### Git workflow

Implement each issue on its own branch, named after the issue. Once the change is complete and verified, open the pull request yourself.