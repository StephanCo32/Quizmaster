"use client";

import { OpenLobbyButton } from "@/components/host/open-lobby-button";
import { ArrowLeft, KeyRound, Radio, SlidersHorizontal, UserRoundCheck, UserRoundX, WifiOff } from "lucide-react";
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
  const [busyMemberId, setBusyMemberId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
  const joiningOpen = roster.find((member) => member.joining_open !== undefined)?.joining_open ?? false;

  async function command(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    const response = await fetch(`/api/host/parties/${party.party_id}/lobby`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ commandId: crypto.randomUUID(), expectedRevision: party.revision, ...body }),
    });
    if (!response.ok) {
      setError(response.status === 409 ? "The Lobby changed. Refresh and try again." : "The Host command could not be saved.");
      setBusy(false);
      return null;
    }
    const result = (await response.json()) as { partyCode?: string };
    await refresh();
    setBusy(false);
    return result;
  }

  async function setMemberAccess(member: PartyMemberProjection) {
    const restoring = member.access_status === "removed";
    if (!restoring && !window.confirm(`Remove ${member.nickname} from this Party?`)) return;
    setBusyMemberId(member.member_id);
    await command({ action: "set-member-access", memberId: member.member_id, accessStatus: restoring ? "joined" : "removed" });
    setBusyMemberId(null);
  }

  async function rotateCode() {
    if (!window.confirm("Rotate this Party code? New callers will need the new code.")) return;
    await command({ action: "rotate-code" });
  }

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
            {party.game_session_state === "lobby" && (
              <button className="broadcast-action" type="button" disabled={busy || !canWrite} onClick={() => void command({ action: "set-joining", joiningOpen: !joiningOpen })}>
                {joiningOpen ? "Close joining" : "Open joining"}
              </button>
            )}
            <button className="back-link" type="button" disabled={busy || !canWrite} onClick={() => void rotateCode()}>
              <KeyRound aria-hidden="true" /> Rotate Party code
            </button>
            {error && <div className="status-notice status-error" role="alert">{error}</div>}
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
                      {member.access_status === "removed" ? "Removed" : member.ready ? "Ready" : "Waiting"} · Score{" "}
                      {member.score}
                    </span>
                  </div>
                  <button
                    className="icon-button"
                    type="button"
                    disabled={busy || busyMemberId === member.member_id || !canWrite}
                    onClick={() => void setMemberAccess(member)}
                    title={member.access_status === "removed" ? `Restore ${member.nickname}` : `Remove ${member.nickname}`}
                    aria-label={member.access_status === "removed" ? `Restore ${member.nickname}` : `Remove ${member.nickname}`}
                  >
                    {member.access_status === "removed" ? <UserRoundCheck aria-hidden="true" /> : <UserRoundX aria-hidden="true" />}
                  </button>
                </div>
              ))}
          </div>
        </aside>
      </div>
    </main>
  );
}
