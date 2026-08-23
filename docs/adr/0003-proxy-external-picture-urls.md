# Proxy External Picture URLs Without Storage

Quizmaster stores an administrator-entered external HTTPS picture URL for each Picture-caption Round template and does not copy image bytes into Supabase Storage. Browsers load pictures through an opaque bearer Vercel endpoint tied to a stored template or Game-round reference, keeping upstream URLs out of Player and Display-session projections while allowing Content administrators and Hosts to inspect them. Possession of that opaque endpoint is sufficient to fetch the picture; the proxy performs no per-request Party or role authorization. This keeps the MVP catalog URL-only at the cost of depending on external media.

## Consequences

- The proxy refetches upstream media for every request and neither caches nor hashes image bytes. A source may change or disappear without its URL changing.
- Saving validates URL syntax only and requires no successful preview. The proxy trusts an upstream `image/*` Content-Type header and deliberately applies no destination, redirect, timeout, transfer-size, decode, format, animation, or metadata safeguards.
- The accepted design exposes Production to private-network requests, unbounded transfers, MIME deception, SSRF, and bandwidth or compute cost through Content-administrator-controlled URLs.
- A failed picture request produces the same unavailable placeholder for every role while Picture-caption gameplay continues normally.