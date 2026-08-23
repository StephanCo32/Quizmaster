import { OpenLobbyButton } from "@/components/host/open-lobby-button";
import { ArrowLeft, Radio, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import type { PartyProjection } from "@/lib/supabase/database.types";
import type { PartyMemberProjection } from "@/lib/supabase/database.types";

export function PartySetup({ party, roster }: { party: PartyProjection; roster: PartyMemberProjection[] }) {
    return (
        <main className="broadcast-shell">
            <header className="broadcast-header">
                <Link className="broadcast-brand" href="/host">
                    <span className="broadcast-mark">Q</span>
                    <span>Quizmaster</span>
                </Link>
                <span className="signal-chip"><Radio size={16} /> Setup channel</span>
            </header>
            <div className="dashboard-grid">
                <section className="dashboard-stage setup-stage">
                    <Link className="back-link" href="/host"><ArrowLeft size={18} /> All Parties</Link>
                    <p className="broadcast-kicker">Party control</p>
                    <h1>{party.party_code}</h1>
                    <div className="broadcast-panel setup-panel">
                        <div className="panel-heading">
                            <SlidersHorizontal aria-hidden="true" />
                            <div><span>Current Game session</span><h2>Setup</h2></div>
                        </div>
                            <p>{party.game_session_state === "setup" ? "This Party is ready for players to enter." : "Players can now join this Lobby from their phones."}</p>
                            {party.game_session_state === "setup" && <OpenLobbyButton partyId={party.party_id} expectedRevision={party.revision} />}
                    </div>
                </section>
                <aside className="dashboard-rail">
                    <span className="rail-label">Party telemetry</span>
                    <dl className="monitor-list">
                        <div><dt>Party code</dt><dd>{party.party_code}</dd></div>
                        <div><dt>State</dt><dd>{party.game_session_state}</dd></div>
                        <div><dt>Revision</dt><dd>{party.revision}</dd></div>
                    </dl>
                    <span className="rail-label">Player roster</span>
                    <div className="roster-list">{roster.filter((member) => member.member_id).map((member) => <div className="roster-row" key={member.member_id}><span className="roster-color" style={{ backgroundColor: member.color }} aria-hidden="true" /><div><strong>{member.nickname}</strong><span>{member.ready ? "Ready" : "Waiting"} · Score {member.score}</span></div></div>)}</div>
                </aside>
            </div>
        </main>
    );
}