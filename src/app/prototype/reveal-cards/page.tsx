// PROTOTYPE — throwaway. Mock data for the reveal-card variants, no live party/session needed.
// Visit /prototype/reveal-cards?variant=A|B|C. Host and Display columns share state so
// clicking reveal on the Host side updates what Display shows, like the real broadcast does.
"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PrototypeSwitcher } from "@/components/prototype-switcher";
import { REVEAL_CARD_VARIANTS, RevealCard, type RevealCardVariantKey } from "@/components/reveal-card-variants.prototype";
import type { PictureCaptionRevealCandidate } from "@/lib/supabase/database.types";

const MOCK_CANDIDATES: PictureCaptionRevealCandidate[] = [
  {
    candidate_id: "1",
    letter: "A",
    caption: "Me realizing Monday is tomorrow",
    is_official: false,
    revealed: true,
    author_nicknames: ["Maya"],
    author_colors: ["#75e6b5"],
    voter_nicknames: ["Ravi", "Noor"],
    voter_colors: ["#f895c4", "#f6dc6f"],
    game_session_id: "mock",
    session_revision: 1,
  },
  {
    candidate_id: "2",
    letter: "B",
    caption: "A perfectly ordinary Tuesday, statistically speaking",
    is_official: true,
    revealed: true,
    author_nicknames: null,
    author_colors: null,
    voter_nicknames: ["Felix"],
    voter_colors: ["#6ec6f4"],
    game_session_id: "mock",
    session_revision: 1,
  },
  {
    candidate_id: "3",
    letter: "C",
    caption: "The group chat, three years later",
    is_official: false,
    revealed: false,
    author_nicknames: ["Ravi", "Noor"],
    author_colors: ["#f895c4", "#f6dc6f"],
    voter_nicknames: [],
    voter_colors: [],
    game_session_id: "mock",
    session_revision: 1,
  },
  {
    candidate_id: "4",
    letter: "D",
    caption: "Nobody: ... Me at 2am:",
    is_official: false,
    revealed: false,
    author_nicknames: ["Felix"],
    author_colors: ["#6ec6f4"],
    voter_nicknames: ["Maya", "Ravi", "Noor"],
    voter_colors: ["#75e6b5", "#f895c4", "#f6dc6f"],
    game_session_id: "mock",
    session_revision: 1,
  },
];

export default function RevealCardsPrototypePage() {
  return (
    <Suspense fallback={null}>
      <RevealCardsPrototype />
    </Suspense>
  );
}

function RevealCardsPrototype() {
  const variant = (useSearchParams().get("variant") as RevealCardVariantKey | null) ?? "A";
  const [candidates, setCandidates] = useState(MOCK_CANDIDATES);

  function reveal(candidateId: string) {
    setCandidates((current) => current.map((candidate) => (candidate.candidate_id === candidateId ? { ...candidate, revealed: true } : candidate)));
  }

  // Mirrors the real gap between projections: Host always sees author identity; Display only
  // gets it once revealed_at is set, everything else (caption, votes) is shared unconditionally.
  const displayCandidates = candidates.map((candidate) =>
    candidate.revealed ? candidate : { ...candidate, is_official: null, author_nicknames: null, author_colors: null },
  );

  return (
    <main className="broadcast-shell" style={{ padding: 32, display: "grid", gap: 32 }}>
      <p style={{ color: "#bfc0cd" }}>Mock data, no live session. Host reveals broadcast to the shared Display column below.</p>
      <section>
        <h2 style={{ marginBottom: 12 }}>Host view</h2>
        <div className="roster-list reveal-grid">
          {candidates.map((candidate) => (
            <RevealCard key={candidate.candidate_id} variant={variant} candidate={candidate} onReveal={() => reveal(candidate.candidate_id)} />
          ))}
        </div>
      </section>
      <section className="display-overview" style={{ height: "auto", background: "var(--broadcast-deep)", padding: 24 }}>
        <h2 style={{ marginBottom: 12 }}>Display view</h2>
        <div className="display-candidate-stage" style={{ gridTemplateColumns: `repeat(${Math.max(1, Math.ceil(Math.sqrt(displayCandidates.length)))}, minmax(0, 1fr))` }}>
          {displayCandidates.map((candidate) => (
            <RevealCard key={candidate.candidate_id} variant={variant} candidate={candidate} />
          ))}
        </div>
      </section>
      <PrototypeSwitcher variants={REVEAL_CARD_VARIANTS} />
    </main>
  );
}
