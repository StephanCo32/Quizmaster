"use client";

// THROWAWAY PROTOTYPE — visualizes the .roster-row-selectable voting contrast fix. Delete after review.
import { useState } from "react";

const candidates = [
    { candidate_id: "a", letter: "A", is_own: true, own_color: "#75e6b5" },
    { candidate_id: "b", letter: "B", is_own: false, own_color: null },
    { candidate_id: "c", letter: "C", is_own: false, own_color: null },
];

export function VotingRowPreview() {
    const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>("a");

    return (
        <main className="broadcast-shell" style={{ padding: 32 }}>
            <section className="broadcast-panel turn-banner turn-banner-active" style={{ maxWidth: 360 }}>
                <h2>Your turn - choose a letter!</h2>
                <div className="roster-list">
                    {candidates.map((candidate) => (
                        <button
                            className="roster-row roster-row-selectable"
                            type="button"
                            key={candidate.candidate_id}
                            aria-pressed={selectedCandidateId === candidate.candidate_id}
                            onClick={() => setSelectedCandidateId(candidate.candidate_id)}
                        >
                            <span className="roster-color" style={{ backgroundColor: candidate.is_own ? candidate.own_color! : "transparent" }} aria-label={candidate.is_own ? "Your caption" : undefined} />
                            <strong>{candidate.letter}</strong>
                        </button>
                    ))}
                </div>
            </section>
        </main>
    );
}
