"use client";

import { OpenLobbyButton } from "@/components/host/open-lobby-button";
import { ArrowLeft, Radio, SlidersHorizontal, WifiOff } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { PartyProjection } from "@/lib/supabase/database.types";
import type { PartyMemberProjection } from "@/lib/supabase/database.types";
import { canWriteLobby } from "@/lib/realtime/lobby-subscription";
import { useLobbySynchronization } from "@/lib/realtime/use-lobby-synchronization";

export function PartySetup({
  party: initialParty,
  roster: initialRoster,
}: {
  party: PartyProjection;
  roster: PartyMemberProjection[];
}) {
  const [party, setParty] = useState(initialParty);
  const [roster, setRoster] = useState(initialRoster);

  async function refresh() {
    const response = await fetch(`/api/host/parties/${party.party_id}/lobby`, {
      cache: "no-store",
    });
    if (!response.ok) throw new Error("host_projection_unavailable");
    const projection = (await response.json()) as {
      party: PartyProjection;
      roster: PartyMemberProjection[];
    };
    setParty(projection.party);
    setRoster(projection.roster);
  }

  const connectionState = useLobbySynchronization({
    gameSessionId: party.game_session_id,
    revision: party.revision,
    refetch: refresh,
  });
  const canWrite = canWriteLobby(connectionState);

  return (
    <main className="broadcast-shell">
      <header className="broadcast-header">
        <Link className="broadcast-brand" href="/host">
          <span className="broadcast-mark">Q</span>
          <span>Quizmaster</span>
        </Link>
        <span className="signal-chip">
          <Radio size={16} /> Setup channel
        </span>
      </header>
      <div className="dashboard-grid">
        <section className="dashboard-stage setup-stage">
          <Link className="back-link" href="/host">
            <ArrowLeft size={18} /> All Parties
          </Link>
          <p className="broadcast-kicker">Party control</p>
          <h1>{party.party_code}</h1>
          {connectionState !== "connected" && (
            <div className="status-notice status-error" role="status">
              <WifiOff aria-hidden="true" />{" "}
              {connectionState === "reconnecting"
                ? "Reconnecting and refreshing the committed Lobby..."
                : connectionState === "connecting"
                  ? "Connecting to the Lobby; Host writes are paused."
                  : "Disconnected. Showing the last committed Lobby; Host writes are paused."}
            </div>
          )}
          <div className="broadcast-panel setup-panel">
            <div className="panel-heading">
              <SlidersHorizontal aria-hidden="true" />
              <div>
                <span>Current Game session</span>
                <h2>Setup</h2>
              </div>
            </div>
            <p>
              {party.game_session_state === "setup"
                ? "This Party is ready for players to enter."
                : "Players can now join this Lobby from their phones."}
            </p>
            {party.game_session_state === "setup" && (
              <OpenLobbyButton
                partyId={party.party_id}
                expectedRevision={party.revision}
                disabled={!canWrite}
                onOpened={refresh}
              />
            )}
          </div>
        </section>
        <aside className="dashboard-rail">
          <span className="rail-label">Party telemetry</span>
          <dl className="monitor-list">
            <div>
              <dt>Party code</dt>
              <dd>{party.party_code}</dd>
            </div>
            <div>
              <dt>State</dt>
              <dd>{party.game_session_state}</dd>
            </div>
            <div>
              <dt>Revision</dt>
              <dd>{party.revision}</dd>
            </div>
          </dl>
          <span className="rail-label">Player roster</span>
          <div className="roster-list">
            {roster
              .filter((member) => member.member_id)
              .map((member) => (
                <div className="roster-row" key={member.member_id}>
                  <span
                    className="roster-color"
                    style={{ backgroundColor: member.color }}
                    aria-hidden="true"
                  />
                  <div>
                    <strong>{member.nickname}</strong>
                    <span>
                      {member.ready ? "Ready" : "Waiting"} · Score{" "}
                      {member.score}
                    </span>
                  </div>
                </div>
              ))}
          </div>
        </aside>
      </div>
    </main>
  );
}
