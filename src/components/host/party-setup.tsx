"use client";

import { OpenLobbyButton } from "@/components/host/open-lobby-button";
import { ArrowDown, ArrowLeft, ArrowUp, Copy, KeyRound, Pause, Pencil, Play, Plus, Radio, SlidersHorizontal, Trash2, UserRoundCheck, UserRoundX, WifiOff } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { HostPictureCaptionBallot, HostPictureCaptionTemplate, PartyMemberProjection, PartyProjection, PictureCaptionCompletion, PictureCaptionRound, PictureCaptionSubmission } from "@/lib/supabase/database.types";
import { canWriteLobby } from "@/lib/realtime/lobby-subscription";
import { useLobbySynchronization } from "@/lib/realtime/use-lobby-synchronization";

export function PartySetup({
  party: initialParty,
  roster: initialRoster,
  rounds: initialRounds,
  templates: initialTemplates,
  initialSubmissions,
  initialCompletion,
  initialBallots,
}: {
  party: PartyProjection;
  roster: PartyMemberProjection[];
  rounds: PictureCaptionRound[];
  templates: HostPictureCaptionTemplate[];
  initialSubmissions: PictureCaptionSubmission[];
  initialCompletion: PictureCaptionCompletion | null;
  initialBallots: HostPictureCaptionBallot[];
}) {
  const [party, setParty] = useState(initialParty);
  const [roster, setRoster] = useState(initialRoster);
  const [rounds, setRounds] = useState(initialRounds);
  const [templates, setTemplates] = useState(initialTemplates);
  const [selectedTemplateId, setSelectedTemplateId] = useState(initialTemplates[0]?.template_id ?? "");
  const [submissions, setSubmissions] = useState(initialSubmissions);
  const [completion, setCompletion] = useState(initialCompletion);
  const [ballots, setBallots] = useState(initialBallots);
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
    const roundsResponse = await fetch(`/api/host/parties/${party.party_id}/rounds`, { cache: "no-store" });
    if (!roundsResponse.ok) throw new Error("round_projection_unavailable");
    const roundProjection = await roundsResponse.json() as { rounds: PictureCaptionRound[]; templates: HostPictureCaptionTemplate[] };
    setRounds(roundProjection.rounds); setTemplates(roundProjection.templates);
    const captionsResponse = await fetch(`/api/host/parties/${party.party_id}/captions`, { cache: "no-store" });
    if (!captionsResponse.ok) throw new Error("caption_projection_unavailable");
    const captions = await captionsResponse.json() as { submissions: PictureCaptionSubmission[]; completion: PictureCaptionCompletion | null };
    setSubmissions(captions.submissions); setCompletion(captions.completion);
    const ballotsResponse = await fetch(`/api/host/parties/${party.party_id}/ballots`, { cache: "no-store" });
    if (!ballotsResponse.ok) throw new Error("ballot_projection_unavailable");
    setBallots((await ballotsResponse.json() as { ballots: HostPictureCaptionBallot[] }).ballots);
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

  async function roundCommand(body: Record<string, unknown>, path = "rounds") {
    setBusy(true); setError(null);
    const response = await fetch(`/api/host/parties/${party.party_id}/${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ commandId: crypto.randomUUID(), expectedRevision: party.revision, ...body }) });
    if (!response.ok) setError(response.status === 409 ? "The session changed. Refresh and try again." : "The round command could not be saved.");
    else await refresh();
    setBusy(false);
  }

  async function editRound(round: PictureCaptionRound) {
    const captioningSeconds = Number(window.prompt("Captioning seconds (5-600)", String(round.captioning_seconds)));
    const votingSeconds = Number(window.prompt("Voting seconds (5-600)", String(round.voting_seconds)));
    const captionGraphemeLimit = Number(window.prompt("Caption limit (1-120)", String(round.caption_grapheme_limit)));
    if ([captioningSeconds, votingSeconds, captionGraphemeLimit].every(Number.isInteger)) void roundCommand({ action: "edit", roundId: round.round_id, captioningSeconds, votingSeconds, captionGraphemeLimit });
  }

  async function captionCommand(body: Record<string, unknown>) { await roundCommand(body, "captions"); }
  async function lifecycleCommand(body: Record<string, unknown>) { await roundCommand(body, "lifecycle"); }

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
          <div className="broadcast-panel setup-panel">
            <div className="panel-heading"><SlidersHorizontal aria-hidden="true" /><div><span>Picture-caption rounds</span><h2>{rounds.filter((round) => round.state === "pending").length} Pending</h2></div></div>
            {(party.game_session_state === "setup" || party.game_session_state === "lobby" || (party.game_session_state === "live" && !rounds.some((round) => round.state === "active"))) && <div className="nickname-form"><select aria-label="Round template" value={selectedTemplateId} onChange={(event) => setSelectedTemplateId(event.target.value)}>{templates.map((template) => <option key={template.template_id} value={template.template_id}>{template.name}</option>)}</select><button className="icon-button" disabled={busy || !canWrite || !selectedTemplateId} type="button" title="Add round" aria-label="Add round" onClick={() => void roundCommand({ action: "add", templateId: selectedTemplateId })}><Plus aria-hidden="true" /></button></div>}
            <div className="roster-list">{rounds.map((round, index) => <div className="roster-row" key={round.round_id}><div><strong>{round.name ?? "Started round"}</strong><span>{round.prompt ?? "No prompt"} · {round.captioning_seconds}s caption / {round.voting_seconds}s vote</span></div>{round.state === "pending" && <><button className="icon-button" type="button" disabled={busy || !canWrite} title="Edit round settings" onClick={() => void editRound(round)}><Pencil aria-hidden="true" /></button><button className="icon-button" type="button" disabled={busy || !canWrite || index === 0} title="Move round up" onClick={() => void roundCommand({ action: "reorder", roundId: round.round_id, position: index - 1 })}><ArrowUp aria-hidden="true" /></button><button className="icon-button" type="button" disabled={busy || !canWrite || index === rounds.length - 1} title="Move round down" onClick={() => void roundCommand({ action: "reorder", roundId: round.round_id, position: index + 1 })}><ArrowDown aria-hidden="true" /></button><button className="icon-button" type="button" disabled={busy || !canWrite} title="Duplicate round" onClick={() => void roundCommand({ action: "duplicate", roundId: round.round_id })}><Copy aria-hidden="true" /></button><button className="icon-button" type="button" disabled={busy || !canWrite} title="Delete round" onClick={() => { if (window.confirm("Delete this pending round?")) void roundCommand({ action: "delete", roundId: round.round_id }); }}><Trash2 aria-hidden="true" /></button></>}</div>)}</div>
            {party.game_session_state === "lobby" && <button className="broadcast-action" type="button" disabled={busy || !canWrite || !rounds.some((round) => round.state === "pending")} onClick={() => void roundCommand({}, "session/start")}>Start captioning</button>}
            {party.game_session_state === "live" && rounds.some((round) => round.state === "active") && <button className="broadcast-action" type="button" disabled={busy || !canWrite} onClick={() => void roundCommand({ paused: rounds.find((round) => round.state === "active")?.captioning_deadline !== null }, "session/pause")}>{rounds.find((round) => round.state === "active")?.captioning_deadline ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />} {rounds.find((round) => round.state === "active")?.captioning_deadline ? "Pause timer" : "Resume timer"}</button>}
            {party.game_session_state === "live" && rounds.some((round) => round.phase === "captioning") && <><p>{completion?.submission_count ?? 0} of {completion?.eligible_count ?? 0} captions submitted</p><div className="roster-list">{submissions.map((submission) => <div className="roster-row" key={submission.submission_id}><div><strong>{submission.nickname}</strong><span>{submission.caption}</span></div><button className="icon-button" type="button" title={`Remove ${submission.nickname}'s caption`} disabled={busy || !canWrite} onClick={() => void captionCommand({ action: "remove", submissionId: submission.submission_id })}><Trash2 aria-hidden="true" /></button></div>)}</div><button className="broadcast-action" type="button" disabled={busy || !canWrite} onClick={() => { if (window.confirm("Close Captioning even if responses are missing?")) void captionCommand({ action: "close", confirmMissing: true }); }}>Close Captioning</button></>}
            {party.game_session_state === "live" && rounds.some((round) => round.phase === "voting") && <><p>{new Set(ballots.filter((ballot) => ballot.voter_nickname).map((ballot) => ballot.voter_nickname)).size} ballots received</p><div className="roster-list">{ballots.map((ballot) => <div className="roster-row" key={`${ballot.candidate_id}-${ballot.voter_nickname ?? "pending"}`}><div><strong>{ballot.caption}</strong><span>{ballot.voter_nickname ?? "No ballot yet"}</span></div><b>{ballot.points}</b></div>)}</div><button className="broadcast-action" type="button" disabled={busy || !canWrite} onClick={() => { if (window.confirm("Close Voting with missing ballots?")) void roundCommand({ confirmMissing: true }, "ballots"); }}>Close Voting</button></>}
            {party.game_session_state === "live" && rounds.some((round) => round.state === "completed") && !rounds.some((round) => round.phase === "revealing") && <button className="broadcast-action" type="button" disabled={busy || !canWrite} onClick={() => void roundCommand({ action: "start-reveal" }, "results")}>Start Reveal</button>}
            {party.game_session_state === "live" && rounds.some((round) => round.phase === "revealing") && <button className="broadcast-action" type="button" disabled={busy || !canWrite} onClick={() => void roundCommand({ action: "continue" }, "results")}>Continue</button>}
            {party.game_session_state === "live" && !rounds.some((round) => round.state === "active") && <button className="broadcast-action" type="button" disabled={busy || !canWrite} onClick={() => void lifecycleCommand({ action: "finish" })}>Finish Game session</button>}
            {party.game_session_state === "finished" && <><p>Finished. Scores can be corrected before the next Game session.</p><div className="roster-list">{roster.filter((member) => member.access_status === "joined").map((member) => <div className="roster-row" key={`score-${member.member_id}`}><strong>{member.nickname}</strong><span>{member.score} points</span><button className="icon-button" type="button" title={`Subtract one point from ${member.nickname}`} disabled={busy || !canWrite} onClick={() => void lifecycleCommand({ action: "adjust", memberId: member.member_id, delta: -1 })}>-</button><button className="icon-button" type="button" title={`Add one point to ${member.nickname}`} disabled={busy || !canWrite} onClick={() => void lifecycleCommand({ action: "adjust", memberId: member.member_id, delta: 1 })}>+</button></div>)}</div><button className="broadcast-action" type="button" disabled={busy || !canWrite} onClick={() => void lifecycleCommand({ action: "successor" })}>Start next Game session</button></>}
            <button className="back-link" type="button" disabled={busy || !canWrite} onClick={() => { if (window.confirm("Permanently delete this Party and all of its Game history?")) void lifecycleCommand({ action: "delete" }); }}>Delete Party</button>
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
