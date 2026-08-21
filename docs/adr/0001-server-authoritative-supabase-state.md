# Server-Authoritative Supabase State With Vercel Projections

Quizmaster stores all canonical Game session state in Supabase Postgres and media in private Supabase Storage, while Vercel owns every browser-facing read and command. Vercel returns role-scoped projections for Hosts, Players, and Display sessions, invokes privileged Postgres RPC transactions for writes, and publishes version-only Realtime invalidations after each committed transaction. This avoids leaking unrevealed or role-private game data through direct table subscriptions while retaining recoverable, revision-checked server authority.

## Consequences

- Postgres persists Game sessions, Player membership, Game rounds and their state, state revisions, deadlines, idempotency receipts, Score adjustments, and content metadata. Storage object keys live in Postgres; clients receive short-lived signed media URLs.
- Browser clients authenticate as magic-link Hosts, anonymous Players, or Display sessions. They cannot directly read or write canonical tables; RLS defaults to deny, and only Vercel's server-side service role accesses Supabase data APIs.
- A Vercel route validates the caller and invokes a narrowly scoped RPC that performs each authoritative transition atomically. The RPC applies membership, state-revision, deadline, and idempotency checks.
- Realtime Broadcast messages contain only a Game-session id and new projection version. They are best-effort invalidations; a client always refetches its authorized projection, so missed messages cannot cause incorrect state.