---
name: plan-game-type
description: Produce a build-ready contract for one Quizmaster Game type and hand it off for implementation.
disable-model-invocation: true
---

Plan one Quizmaster **Game type** through adaptive decision rounds. The destination is a build-ready contract: rules, configuration, runtime policy, role projections, round-local outcomes, edge cases, acceptance scenarios, and context pointers. Stop before production implementation.

Use [CONTEXT.md](../../../CONTEXT.md) for canonical domain language. Treat **Picture-caption round** as a structural reference for the dimensions a Game type must resolve, not as a phase or scoring template. Use the issue-tracker operations in [issue-tracker.md](../../../docs/agents/issue-tracker.md) for every map and ticket write.

## Orient

Accept one of three starting points:

- A loose idea: name the Game-type destination and breadth-first map the unresolved decisions. If the whole contract fits one decision ticket, ask whether to proceed without a map. Otherwise create a dedicated Wayfinder map and only the decision tickets that are already sharp.
- A Wayfinder map: load its low-resolution body, choose the first unblocked and unclaimed child unless the user names one, and claim it before working.
- A decision ticket: load its parent map, confirm it is unblocked, and claim it before working.

Refer to maps and tickets by linked title in human-facing text. Resolve at most one decision ticket per invocation. A dedicated map's destination is the approved build-ready Game-type contract and explicit implementation handoff.

## Build the design tree

Interview through the unresolved contract gates below. Ask small interactive rounds containing only decisions whose prerequisites are settled. Recommend an answer for every question, challenge contradictions, summarize approved decisions after each round, and recompute the frontier. Find repository facts yourself; ask the user for decisions.

Checkpoint approved decisions, open questions, and evidence links on the active ticket. Keep the issue useful as a resolution artifact rather than a transcript.

### Experience and loop

Resolve the intended Player experience, eligible participants, inputs, outputs, phase sequence, completion condition, Host pacing, and replay or next-round behavior.

### Configuration

Resolve the typed configuration schema: fields, defaults, constraints, cross-field validation, and lifecycle states in which each field is editable. Define Host create, inspect, edit, duplicate, reorder, and delete behavior for a configured Game round, including invalid and unavailable content.

### Runtime policy

Resolve the Game type's initial state, internal phases, legal commands, transition guards, timers, close conditions, immutable points, and emitted resolution data.

Keep platform invariants platform-owned: server-authoritative atomic transitions, expected revisions and command idempotency, authorization, persistence, pause and resume, disconnect and rejoin, and version-only Realtime invalidation followed by role-projection refetch. A Game type supplies policy inside those invariants; it does not create a parallel architecture.

### Role projections

For every phase, resolve the visible information and legal actions for **Host**, **Player**, and **Public overview**. Include private and public boundaries, waiting and empty states, ineligible participants, late arrival, disconnect, and rejoin.

### Round-local outcomes

Resolve points or other outcomes emitted by this Game type, ties within the round, reveal timing, and the audit data needed to explain the result. Leave aggregation and tie-breaking across Game types outside this contract.

### Edge cases

Resolve or explicitly mark not applicable: zero or too few eligible Players, non-response, disconnect and rejoin, duplicate or stale commands, pause and resume, timer expiry, invalid or removed content, Host intervention, and early termination. Add Game-specific abuse, privacy, fairness, and accessibility cases exposed by the loop.

### Acceptance and handoff

Write concise Given/When/Then scenarios covering the main loop, configuration validation, authorization, timing, each role projection, round-local outcomes, and critical edge cases. Link the canonical domain terms, shared authority decisions, dependencies, and any research or prototype evidence an implementer needs. Record deferred work explicitly without turning it into an implementation plan.

Every gate must be resolved or explicitly marked not applicable. If a branch remains uncertain because behavior or presentation needs evidence, pause with the exact user-invoked command to run (`/prototype`, `/research`, or `/domain-modeling`), state the question it must answer, and resume only from the linked result.

## Finish

Present the complete contract, remaining deferrals, and acceptance scenarios for explicit user approval. After approval:

1. Add stable new domain terms to [CONTEXT.md](../../../CONTEXT.md); keep rules and implementation detail in the ticket resolution.
2. Post the contract as the decision ticket's resolution comment and close the ticket.
3. Append one linked gist to the parent map's **Decisions so far**.
4. Graduate newly sharp planning questions from **Not yet specified** into decision tickets, creating tickets before wiring dependencies. Rule work beyond the destination into **Out of scope**.
5. If no open tickets or in-scope fog remain, mark the map's destination reached and provide the implementation handoff.

The handoff names the approved contract, acceptance scenarios, canonical context, evidence, and dependencies. It does not prescribe files or classes, open implementation tickets, or change production code.