"use client";

import { Clock3, Radio, UsersRound } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useEffectEvent, useState } from "react";
import { canWriteLobby } from "@/lib/realtime/lobby-subscription";
import { useLobbySynchronization } from "@/lib/realtime/use-lobby-synchronization";
import type { ActivePictureCaptionRound, DisplayMemberProjection, DisplayPartyProjection, DisplayPictureCaptionCandidate, PictureCaptionCompletion, PictureCaptionResult, PictureCaptionRevealCandidate } from "@/lib/supabase/database.types";

type DisplayProjection = {
    canonicalCode: string;
    party: DisplayPartyProjection;
    roster: DisplayMemberProjection[];
    activeRound: ActivePictureCaptionRound | null;
    completion: PictureCaptionCompletion | null;
    candidates: DisplayPictureCaptionCandidate[];
    revealCandidates: PictureCaptionRevealCandidate[];
    results: PictureCaptionResult[];
};

const LOBBY_MEMBER_LIMIT = 8;
const GAME_ITEM_LIMIT = 5;

export function DisplayOverview({ initialParty, initialRoster, initialActiveRound, initialCompletion, initialCandidates, initialRevealCandidates, initialResults }: { initialParty: DisplayPartyProjection; initialRoster: DisplayMemberProjection[]; initialActiveRound: ActivePictureCaptionRound | null; initialCompletion: PictureCaptionCompletion | null; initialCandidates: DisplayPictureCaptionCandidate[]; initialRevealCandidates: PictureCaptionRevealCandidate[]; initialResults: PictureCaptionResult[] }) {
    const router = useRouter();
    const [party, setParty] = useState(initialParty);
    const [roster, setRoster] = useState(initialRoster);
    const [activeRound, setActiveRound] = useState(initialActiveRound);
    const [completion, setCompletion] = useState(initialCompletion);
    const [candidates, setCandidates] = useState(initialCandidates);
    const [revealCandidates, setRevealCandidates] = useState(initialRevealCandidates);
    const [results, setResults] = useState(initialResults);
    const [now, setNow] = useState<number | null>(null);

    async function refresh() {
        const response = await fetch(`/api/display/${party.party_code}`, { cache: "no-store" });
        if (response.status === 404) {
            router.replace("/display");
            throw new Error("display_session_unavailable");
        }
        if (!response.ok) throw new Error("display_projection_unavailable");
        const projection = await response.json() as DisplayProjection;
        if (projection.canonicalCode !== party.party_code) {
            router.replace(`/display/${projection.canonicalCode}`);
            return;
        }
        setParty(projection.party);
        setRoster(projection.roster);
        setActiveRound(projection.activeRound);
        setCompletion(projection.completion);
        setCandidates(projection.candidates);
        setRevealCandidates(projection.revealCandidates);
        setResults(projection.results);
    }

    const connectionState = useLobbySynchronization({ gameSessionId: party.game_session_id, revision: party.session_revision, refetch: refresh });
    const deadline = activeRound?.captioning_deadline ?? activeRound?.turn_deadline ?? null;
    const secondsRemaining = deadline && now !== null ? Math.max(0, Math.ceil((new Date(deadline).getTime() - now) / 1000)) : activeRound?.paused_remaining_seconds ?? activeRound?.turn_paused_remaining_seconds ?? null;
    const refreshForCountdown = useEffectEvent(() => void refresh());
    const readyCount = roster.filter((member) => member.ready).length;
    const visibleRoster = roster.slice(0, LOBBY_MEMBER_LIMIT);
    const hiddenRosterCount = roster.length - visibleRoster.length;
    const visibleCandidates = candidates.slice(0, GAME_ITEM_LIMIT);
    const hiddenCandidateCount = candidates.length - visibleCandidates.length;
    const visibleResults = results.slice(0, GAME_ITEM_LIMIT);
    const hiddenResultCount = results.length - visibleResults.length;

    useEffect(() => {
        if (!deadline) return;
        const initialTimer = window.setTimeout(() => setNow(Date.now()), 0);
        const timer = window.setInterval(() => setNow(Date.now()), 1000);
        return () => { window.clearTimeout(initialTimer); window.clearInterval(timer); };
    }, [deadline]);

    useEffect(() => {
        if (secondsRemaining !== 0) return;
        const timer = window.setTimeout(refreshForCountdown, 0);
        return () => window.clearTimeout(timer);
    }, [secondsRemaining]);

    const header = <header className="display-overview-header"><span className="broadcast-brand"><span className="broadcast-mark">Q</span><span>Quizmaster</span></span><span className="signal-chip"><Radio size={16} /> Party {party.party_code}</span><span className="display-live-state">{canWriteLobby(connectionState) ? "Live" : "Reconnecting"}</span></header>;

    if (!activeRound && party.game_session_state !== "finished") {
        return <main className="display-overview display-lobby-mode">{header}<section className="display-lobby-hero"><div><span className="broadcast-kicker">Lobby open</span><h1>Join the party</h1><p>Enter this code on your phone.</p></div><div className="display-party-code" aria-label={`Party code ${party.party_code}`}>{party.party_code}</div></section><section className="display-lobby-roster"><div className="display-lobby-summary"><UsersRound aria-hidden="true" /><div><span>{roster.length} Players</span><strong>{readyCount} ready</strong></div></div><div className="display-roster">{visibleRoster.map((member) => <div className="display-member" key={member.member_id}><span className="roster-color" style={{ backgroundColor: member.color }} aria-hidden="true" /><strong>{member.nickname}</strong><span>{member.ready ? "Ready" : "Joining"}</span></div>)}{hiddenRosterCount > 0 && <div className="display-member display-overflow"><strong>+{hiddenRosterCount}</strong><span>more Players</span></div>}</div></section></main>;
    }

    if (party.game_session_state === "finished") {
        return <main className="display-overview display-lobby-mode">{header}<section className="display-lobby-hero"><div><span className="broadcast-kicker">Session complete</span><h1>That is a wrap.</h1><p>Waiting for the Host to start the next game.</p></div></section></main>;
    }

    if (!activeRound) return null;

    return <main className="display-overview display-game-mode">{header}<section className="display-game-heading"><div><span className="broadcast-kicker">Picture-caption round</span><h1>{activeRound.phase === "voting" ? (activeRound.current_turn_nickname ? `${activeRound.current_turn_nickname}'s turn` : "Voting") : activeRound.phase === "revealing" ? "Reveal" : activeRound.phase === "results" ? "Results" : "Write a caption."}</h1></div>{secondsRemaining !== null && <div className="display-timer"><Clock3 aria-hidden="true" /><strong>{secondsRemaining}</strong><span>seconds</span></div>}</section>{activeRound.phase === "captioning" && <section className="display-caption-stage"><Image className="display-round-image" src={`/api/display/${party.party_code}/rounds/${activeRound.round_id}/picture`} alt="Picture caption round" width={1280} height={720} unoptimized /><div className="display-response-count"><span className="broadcast-kicker">Captions received</span><strong>{completion?.submission_count ?? 0}<small> / {completion?.eligible_count ?? 0}</small></strong></div></section>}{activeRound.phase === "voting" && <section className="display-candidate-stage">{visibleCandidates.map((candidate) => <article className="display-candidate" key={candidate.candidate_id}><span>{candidate.letter}</span><p>{candidate.caption}</p><div className="display-candidate-votes">{(candidate.voter_colors ?? []).map((color, index) => <span key={index} className="roster-color" style={{ backgroundColor: color }} aria-hidden="true" />)}</div></article>)}{hiddenCandidateCount > 0 && <article className="display-candidate display-overflow"><strong>+{hiddenCandidateCount}</strong><span>more captions</span></article>}</section>}{activeRound.phase === "revealing" && <section className="display-candidate-stage">{revealCandidates.map((candidate) => <article className={`display-candidate${candidate.revealed ? " display-revealed" : ""}`} key={candidate.candidate_id} style={candidate.revealed && candidate.author_color ? { backgroundColor: candidate.author_color } : undefined}><span>{candidate.letter}</span>{candidate.revealed ? <><p>{candidate.caption}</p><strong>{candidate.is_official ? "Official" : candidate.author_nickname}</strong></> : <p>Not yet revealed</p>}</article>)}</section>}{activeRound.phase === "results" && <section className="display-candidate-stage">{visibleResults.map((result) => <article className="display-candidate display-result" key={`${result.caption}-${result.author_nickname ?? "official"}`}>{!result.is_official && <span className="roster-color" style={{ backgroundColor: result.author_color ?? undefined }} aria-hidden="true" />}<div><strong>{result.is_official ? "Official" : result.author_nickname}</strong><p>{result.caption}</p></div><b>{result.points}</b></article>)}{hiddenResultCount > 0 && <article className="display-candidate display-overflow"><strong>+{hiddenResultCount}</strong><span>more results</span></article>}</section>}</main>;
}
