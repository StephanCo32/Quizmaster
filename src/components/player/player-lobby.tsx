"use client";

import { Check, Pencil, Radio, RefreshCw, WifiOff } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { canWriteLobby } from "@/lib/realtime/lobby-subscription";
import { useLobbySynchronization } from "@/lib/realtime/use-lobby-synchronization";
import type { ActivePictureCaptionRound, PartyMemberProjection } from "@/lib/supabase/database.types";

export function PlayerLobby({
  partyCode,
  initialRoster,
  initialActiveRound,
  initialSubmission,
}: {
  partyCode: string;
  initialRoster: PartyMemberProjection[];
  initialActiveRound: ActivePictureCaptionRound | null;
  initialSubmission: { caption: string } | null;
}) {
  const router = useRouter();
  const [roster, setRoster] = useState(initialRoster);
  const [activeRound, setActiveRound] = useState(initialActiveRound);
  const [caption, setCaption] = useState(initialSubmission?.caption ?? "");
  const [nickname, setNickname] = useState(initialRoster[0]?.nickname ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const member = roster[0];
  const revision = member?.session_revision ?? 0;

  const connectionState = useLobbySynchronization({
    gameSessionId: member?.game_session_id ?? "unavailable",
    revision,
    refetch: refresh,
  });
  const canWrite = canWriteLobby(connectionState);

  async function command(body: Record<string, unknown>) {
    if (!member || !canWrite) return;
    setBusy(true);
    setError(null);
    const response = await fetch(`/api/play/${partyCode}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...body,
        memberId: member.member_id,
        expectedRevision: revision,
        commandId: crypto.randomUUID(),
      }),
    });
    if (!response.ok) {
      setError(
        response.status === 409
          ? "The Lobby changed. Refresh and try again."
          : "Your change could not be saved.",
      );
      setBusy(false);
      return;
    }
    const result = (await response.json()).member as PartyMemberProjection;
    setRoster((current) =>
      current.map((item) =>
        item.member_id === result.member_id ? { ...item, ...result } : item,
      ),
    );
    setNickname(result.nickname);
    setBusy(false);
  }

  async function refresh() {
    const response = await fetch(`/api/play/${partyCode}`, {
      cache: "no-store",
    });
    if (!response.ok) throw new Error("player_projection_unavailable");
    const projection = (await response.json()) as {
      canonicalCode: string;
      roster: PartyMemberProjection[];
      activeRound: ActivePictureCaptionRound | null;
      submission: { caption: string } | null;
    };
    if (projection.canonicalCode !== partyCode) {
      router.replace(`/play/${projection.canonicalCode}`);
      return;
    }
    const nextRoster = projection.roster;
    setRoster((currentRoster) =>
      (nextRoster[0]?.session_revision ?? 0) >=
      (currentRoster[0]?.session_revision ?? 0)
        ? nextRoster
        : currentRoster,
    );
    setActiveRound(projection.activeRound);
    setCaption(projection.submission?.caption ?? "");
  }

  async function submitCaption(event: React.FormEvent) {
    event.preventDefault(); if (!activeRound || !canWrite) return;
    setBusy(true); setError(null);
    const response = await fetch(`/api/play/${partyCode}/caption`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ commandId: crypto.randomUUID(), expectedRevision: revision, caption }) });
    if (!response.ok) setError(response.status === 400 ? "Use one to three non-empty lines within the caption limit." : "Captioning changed. Refresh and try again.");
    else await refresh();
    setBusy(false);
  }

  if (!member)
    return (
      <main className="broadcast-shell state-screen">
        <section className="state-block">
          <h1>Player not found</h1>
          <p>Join this Party again to establish your Browser identity.</p>
        </section>
      </main>
    );
  return (
    <main className="broadcast-shell">
      <header className="broadcast-header">
        <span className="broadcast-brand">
          <span className="broadcast-mark">Q</span>
          <span>Quizmaster</span>
        </span>
        <span className="signal-chip">
          <Radio size={16} /> {partyCode}
        </span>
      </header>
      <div className="dashboard-grid">
        <section className="dashboard-stage">
          <p className="broadcast-kicker">Lobby / {member.session_state}</p>
          <h1>Make some noise.</h1>
          <p className="lede">
            You are <strong>{member.nickname}</strong>. Watch the shared screen
            for the next move.
          </p>
          {connectionState !== "connected" && (
            <div className="status-notice status-error" role="status">
              <WifiOff aria-hidden="true" />{" "}
              {connectionState === "reconnecting"
                ? "Reconnecting and refreshing the committed Lobby..."
                : connectionState === "connecting"
                  ? "Connecting to the Lobby; Player writes are paused."
                  : "Disconnected. Showing the last committed Lobby; Player writes are paused."}
            </div>
          )}
          {activeRound && <section className="broadcast-panel player-card"><Image src={`/api/play/${partyCode}/rounds/${activeRound.round_id}/picture`} alt="Picture caption round" width={640} height={360} unoptimized /><div><span className="rail-label">{activeRound.phase}{activeRound.paused_remaining_seconds !== null ? " paused" : ""}</span><h2>{activeRound.prompt ?? "Write a caption."}</h2><p>{activeRound.captioning_deadline ? `Ends ${new Date(activeRound.captioning_deadline).toLocaleTimeString()}` : `${activeRound.paused_remaining_seconds ?? 0} seconds remaining`}</p></div></section>}
          {activeRound?.phase === "captioning" && <form className="broadcast-panel nickname-form" onSubmit={submitCaption}><label>Caption<textarea required maxLength={1000} rows={3} value={caption} onChange={(event) => setCaption(event.target.value)} /></label><button className="broadcast-action" type="submit" disabled={busy || !canWrite || activeRound.captioning_deadline === null}>{initialSubmission ? "Update caption" : "Submit caption"}</button></form>}
          <div className="broadcast-panel player-card">
            <div
              className="player-color"
              style={{ backgroundColor: member.color }}
              aria-label="Your assigned Player color"
            />
            <div>
              <span className="rail-label">Your status</span>
              <h2>{member.ready ? "Ready to play" : "Not ready yet"}</h2>
            </div>
            <button
              className="broadcast-action"
              type="button"
              disabled={busy || !canWrite || member.session_state !== "lobby"}
              onClick={() => command({ ready: !member.ready })}
            >
              <Check aria-hidden="true" />{" "}
              {member.ready ? "Set not ready" : "I am ready"}
            </button>
          </div>
          <form
            className="broadcast-panel nickname-form"
            onSubmit={(event) => {
              event.preventDefault();
              void command({ nickname });
            }}
          >
            <label>
              Nickname
              <input
                required
                minLength={1}
                maxLength={30}
                value={nickname}
                onChange={(event) => setNickname(event.target.value)}
              />
            </label>
            <button
              className="icon-button"
              type="submit"
              disabled={busy || !canWrite || member.session_state !== "lobby"}
              title="Change nickname"
              aria-label="Change nickname"
            >
              <Pencil aria-hidden="true" />
            </button>
          </form>
          <button
            className="back-link refresh-button"
            type="button"
            onClick={() => void refresh()}
          >
            <RefreshCw size={18} /> Refresh Lobby
          </button>
          {error && (
            <div className="status-notice status-error" role="alert">
              {error}
            </div>
          )}
        </section>
        <aside className="dashboard-rail">
          <span className="rail-label">Player roster</span>
          <div className="roster-list">
            {roster.map((item) => (
              <div className="roster-row" key={item.member_id}>
                <span
                  className="roster-color"
                  style={{ backgroundColor: item.color }}
                  aria-hidden="true"
                />
                <div>
                  <strong>{item.nickname}</strong>
                  <span>
                    {item.ready ? "Ready" : "Waiting"} · Score {item.score}
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
