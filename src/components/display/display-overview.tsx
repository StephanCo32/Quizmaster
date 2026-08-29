"use client";

import { Radio, WifiOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { canWriteLobby } from "@/lib/realtime/lobby-subscription";
import { useLobbySynchronization } from "@/lib/realtime/use-lobby-synchronization";
import type { DisplayMemberProjection, DisplayPartyProjection } from "@/lib/supabase/database.types";

export function DisplayOverview({ initialParty, initialRoster }: { initialParty: DisplayPartyProjection; initialRoster: DisplayMemberProjection[] }) {
    const router = useRouter();
    const [party, setParty] = useState(initialParty);
    const [roster, setRoster] = useState(initialRoster);
    const connectionState = useLobbySynchronization({ gameSessionId: party.game_session_id, revision: party.session_revision, refetch: refresh });

    async function refresh() {
        const response = await fetch(`/api/display/${party.party_code}`, { cache: "no-store" });
        if (response.status === 404) {
            router.replace("/display");
            throw new Error("display_session_unavailable");
        }
        if (!response.ok) throw new Error("display_projection_unavailable");
        const projection = await response.json() as { canonicalCode: string; party: DisplayPartyProjection; roster: DisplayMemberProjection[] };
        if (projection.canonicalCode !== party.party_code) {
            router.replace(`/display/${projection.canonicalCode}`);
            return;
        }
        setParty(projection.party);
        setRoster(projection.roster);
    }

    return <main className="display-overview"><header className="display-overview-header"><span className="broadcast-brand"><span className="broadcast-mark">Q</span><span>Quizmaster</span></span><span className="signal-chip"><Radio size={16} /> Party {party.party_code}</span><span>{party.game_session_state}</span></header><section className="display-scoreboard"><div><span className="broadcast-kicker">Shared Lobby</span><h1>{roster.length} Players</h1></div><div className="display-connection" role="status">{canWriteLobby(connectionState) ? "Live" : <><WifiOff aria-hidden="true" /> {connectionState === "reconnecting" ? "Reconnecting" : "Disconnected"}</>}</div></section><section className="display-roster" aria-label="Player roster">{roster.map((member) => <article className="display-member" key={member.member_id}><span className="roster-color" style={{ backgroundColor: member.color }} aria-hidden="true" /><strong>{member.nickname}</strong><span>{member.ready ? "Ready" : "Waiting"}</span><b>{member.score}</b></article>)}</section></main>;
}