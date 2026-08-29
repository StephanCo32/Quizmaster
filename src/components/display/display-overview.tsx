"use client";

import { Radio, WifiOff } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { canWriteLobby } from "@/lib/realtime/lobby-subscription";
import { useLobbySynchronization } from "@/lib/realtime/use-lobby-synchronization";
import type { ActivePictureCaptionRound, DisplayMemberProjection, DisplayPartyProjection, DisplayPictureCaptionCandidate, PictureCaptionCompletion } from "@/lib/supabase/database.types";

export function DisplayOverview({ initialParty, initialRoster, initialActiveRound, initialCompletion, initialCandidates }: { initialParty: DisplayPartyProjection; initialRoster: DisplayMemberProjection[]; initialActiveRound: ActivePictureCaptionRound | null; initialCompletion: PictureCaptionCompletion | null; initialCandidates: DisplayPictureCaptionCandidate[] }) {
    const router = useRouter();
    const [party, setParty] = useState(initialParty);
    const [roster, setRoster] = useState(initialRoster);
    const [activeRound, setActiveRound] = useState(initialActiveRound);
    const [completion, setCompletion] = useState(initialCompletion);
    const [candidates, setCandidates] = useState(initialCandidates);
    const connectionState = useLobbySynchronization({ gameSessionId: party.game_session_id, revision: party.session_revision, refetch: refresh });

    async function refresh() {
        const response = await fetch(`/api/display/${party.party_code}`, { cache: "no-store" });
        if (response.status === 404) {
            router.replace("/display");
            throw new Error("display_session_unavailable");
        }
        if (!response.ok) throw new Error("display_projection_unavailable");
        const projection = await response.json() as { canonicalCode: string; party: DisplayPartyProjection; roster: DisplayMemberProjection[]; activeRound: ActivePictureCaptionRound | null; completion: PictureCaptionCompletion | null; candidates: DisplayPictureCaptionCandidate[] };
        if (projection.canonicalCode !== party.party_code) {
            router.replace(`/display/${projection.canonicalCode}`);
            return;
        }
        setParty(projection.party);
        setRoster(projection.roster);
        setActiveRound(projection.activeRound);
        setCompletion(projection.completion);
        setCandidates(projection.candidates);
    }

    return <main className="display-overview"><header className="display-overview-header"><span className="broadcast-brand"><span className="broadcast-mark">Q</span><span>Quizmaster</span></span><span className="signal-chip"><Radio size={16} /> Party {party.party_code}</span><span>{party.game_session_state}</span></header>{activeRound && <section className="display-scoreboard"><Image src={`/api/display/${party.party_code}/rounds/${activeRound.round_id}/picture`} alt="Picture caption round" width={960} height={540} unoptimized /><div><span className="broadcast-kicker">{activeRound.phase}{activeRound.paused_remaining_seconds !== null ? " paused" : ""}</span><h1>{activeRound.prompt ?? "Write a caption."}</h1><span>{completion ? `${completion.submission_count} of ${completion.eligible_count} captions received` : "Waiting for captions"}</span></div></section>}{activeRound?.phase === "voting" && <section className="display-scoreboard"><div><span className="broadcast-kicker">Candidates</span>{candidates.map((candidate) => <p key={candidate.candidate_id}>{candidate.caption}</p>)}</div></section>}<section className="display-scoreboard"><div><span className="broadcast-kicker">Shared Lobby</span><h1>{roster.length} Players</h1></div><div className="display-connection" role="status">{canWriteLobby(connectionState) ? "Live" : <><WifiOff aria-hidden="true" /> {connectionState === "reconnecting" ? "Reconnecting" : "Disconnected"}</>}</div></section><section className="display-roster" aria-label="Player roster">{roster.map((member) => <article className="display-member" key={member.member_id}><span className="roster-color" style={{ backgroundColor: member.color }} aria-hidden="true" /><strong>{member.nickname}</strong><span>{member.ready ? "Ready" : "Waiting"}</span><b>{member.score}</b></article>)}</section></main>;
}