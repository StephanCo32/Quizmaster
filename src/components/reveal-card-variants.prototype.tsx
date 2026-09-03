// PROTOTYPE — throwaway. Three structurally different visual treatments for the reveal
// candidate card, shared between Host (interactive) and Display (read-only). Switch via
// ?variant=A|B|C on /host/parties/[partyId] and /display/[partyCode]. See PrototypeSwitcher.
"use client";

import type { PictureCaptionRevealCandidate } from "@/lib/supabase/database.types";

export const REVEAL_CARD_VARIANTS = [
  { key: "A", label: "Flip card" },
  { key: "B", label: "Ticket stub" },
  { key: "C", label: "Leaderboard row" },
] as const;

export type RevealCardVariantKey = (typeof REVEAL_CARD_VARIANTS)[number]["key"];

type RevealCardProps = {
  candidate: PictureCaptionRevealCandidate;
  onReveal?: () => void;
  disabled?: boolean;
};

// Gating already happened upstream: Host's projection never nulls this out, Display's does
// until the Host reveals that candidate, so the component never needs to check `revealed` itself.
function authorLabel(candidate: PictureCaptionRevealCandidate) {
  if (candidate.is_official) return "Official";
  if (candidate.author_nicknames?.length) return candidate.author_nicknames.join(", ");
  return "?";
}

function VoterDots({ candidate }: { candidate: PictureCaptionRevealCandidate }) {
  if (!candidate.voter_nicknames?.length) return null;
  return (
    <div className="proto-voters">
      {candidate.voter_nicknames.map((nickname, index) => (
        <span
          key={`${candidate.candidate_id}-${nickname}`}
          className="roster-color"
          style={{ backgroundColor: candidate.voter_colors?.[index] ?? undefined }}
          title={nickname}
        />
      ))}
    </div>
  );
}

// A: literal reveal-as-flip. Face down shows only the letter (like a card back); a click/reveal
// flips it over to the caption + author, playing directly on the round's "Reveal" mechanic.
export function VariantA({ candidate, onReveal, disabled }: RevealCardProps) {
  const accent = candidate.author_colors?.[0];
  return (
    <button
      type="button"
      className={`proto-flip${candidate.revealed ? " proto-flip-revealed" : ""}`}
      onClick={onReveal}
      disabled={disabled || candidate.revealed || !onReveal}
    >
      <span className="proto-flip-inner">
        <span className="proto-flip-face proto-flip-front">
          <span className="proto-flip-letter">{candidate.letter}</span>
          <span className="proto-flip-hint">Tap to reveal</span>
        </span>
        <span className="proto-flip-face proto-flip-back" style={accent ? { borderColor: accent } : undefined}>
          <span className="proto-flip-letter proto-flip-letter-small">{candidate.letter}</span>
          <p>{candidate.caption}</p>
          <strong>{authorLabel(candidate)}</strong>
          <VoterDots candidate={candidate} />
        </span>
      </span>
    </button>
  );
}

// B: a raffle-ticket stub. Letter lives in its own perforated strip, caption is the headline,
// author is a byline underneath, votes trail along the bottom of the content half.
export function VariantB({ candidate, onReveal, disabled }: RevealCardProps) {
  return (
    <button
      type="button"
      className={`proto-ticket${candidate.revealed ? " proto-ticket-revealed" : ""}`}
      onClick={onReveal}
      disabled={disabled || candidate.revealed || !onReveal}
    >
      <span className="proto-ticket-stub">{candidate.letter}</span>
      <span className="proto-ticket-body">
        <p className="proto-ticket-caption">{candidate.caption}</p>
        <span className="proto-ticket-author">
          {candidate.revealed ? authorLabel(candidate) : "Not yet revealed"}
        </span>
        <VoterDots candidate={candidate} />
      </span>
    </button>
  );
}

// C: dense leaderboard row, not a card at all. Optimized for showing many candidates at once:
// index circle, flexible caption, voter avatars, then the author badge pinned to the far right.
export function VariantC({ candidate, onReveal, disabled }: RevealCardProps) {
  return (
    <button
      type="button"
      className={`proto-row${candidate.revealed ? " proto-row-revealed" : ""}`}
      onClick={onReveal}
      disabled={disabled || candidate.revealed || !onReveal}
    >
      <span className="proto-row-letter">{candidate.letter}</span>
      <span className="proto-row-caption">{candidate.caption}</span>
      <VoterDots candidate={candidate} />
      <span className="proto-row-author">{authorLabel(candidate)}</span>
    </button>
  );
}

const VARIANT_COMPONENTS: Record<RevealCardVariantKey, typeof VariantA> = { A: VariantA, B: VariantB, C: VariantC };

export function RevealCard({ variant, ...props }: RevealCardProps & { variant: RevealCardVariantKey }) {
  const Component = VARIANT_COMPONENTS[variant];
  return <Component {...props} />;
}
