"use client";

import { OpenLobbyButton } from "@/components/host/open-lobby-button";
import { ArrowDown, ArrowLeft, ArrowUp, Copy, KeyRound, Pause, Pencil, Play, Plus, Radio, SlidersHorizontal, Trash2, UserRoundX, WifiOff } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DialogFrame } from "@/components/ui/dialog-frame";
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
  const router = useRouter();
  const [party, setParty] = useState(initialParty);
  const [roster, setRoster] = useState(initialRoster);
  const [rounds, setRounds] = useState(initialRounds);
  const [templates, setTemplates] = useState(initialTemplates);
  const [submissions, setSubmissions] = useState(initialSubmissions);
  const [completion, setCompletion] = useState(initialCompletion);
  const [ballots, setBallots] = useState(initialBallots);
  const [busyMemberId, setBusyMemberId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{ title: string; message: string; confirmLabel: string; onConfirm: () => void } | null>(null);
  const [editingRound, setEditingRound] = useState<PictureCaptionRound | null>(null);

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
  const currentRoundIndex = rounds.findIndex((round) => round.state === "active");
  const nextRoundIndex = rounds.findIndex((round) => round.state === "pending");
  const joinedPlayerCount = roster.filter((member) => member.access_status === "joined").length;
  const selectedTemplateIds = new Set(rounds.flatMap((round) => round.template_id ? [round.template_id] : []));
  const availableTemplates = templates.filter((template) => !selectedTemplateIds.has(template.template_id));

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
    if (!restoring) { setConfirmation({ title: "Remove Player", message: `Remove ${member.nickname} from this Party?`, confirmLabel: "Remove Player", onConfirm: async () => { setBusyMemberId(member.member_id); await command({ action: "set-member-access", memberId: member.member_id, accessStatus: "removed" }); setBusyMemberId(null); } }); return; }
    setBusyMemberId(member.member_id);
    await command({ action: "set-member-access", memberId: member.member_id, accessStatus: restoring ? "joined" : "removed" });
    setBusyMemberId(null);
  }

  async function rotateCode() {
    setConfirmation({ title: "Rotate Party code", message: "Rotate this Party code? New callers will need the new code.", confirmLabel: "Rotate code", onConfirm: () => void command({ action: "rotate-code" }) });
  }

  async function roundCommand(body: Record<string, unknown>, path = "rounds") {
    setBusy(true); setError(null);
    const response = await fetch(`/api/host/parties/${party.party_id}/${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ commandId: crypto.randomUUID(), expectedRevision: party.revision, ...body }) });
    if (!response.ok) setError(response.status === 409 ? "The session changed. Refresh and try again." : "The round command could not be saved.");
    else await refresh();
    setBusy(false);
  }

  function editRound(round: PictureCaptionRound) { setEditingRound(round); }

  function saveRoundEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingRound) return;
    const values = new FormData(event.currentTarget);
    setEditingRound(null);
    void roundCommand({ action: "edit", roundId: editingRound.round_id, captioningSeconds: Number(values.get("captioningSeconds")), votingSeconds: Number(values.get("votingSeconds")), captionGraphemeLimit: Number(values.get("captionGraphemeLimit")) });
  }

  async function captionCommand(body: Record<string, unknown>) { await roundCommand(body, "captions"); }
  async function lifecycleCommand(body: Record<string, unknown>) {
    setBusy(true); setError(null);
    const response = await fetch(`/api/host/parties/${party.party_id}/lifecycle`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ commandId: crypto.randomUUID(), expectedRevision: party.revision, ...body }) });
    if (!response.ok) setError(response.status === 409 ? "The session changed. Refresh and try again." : "The lifecycle command could not be saved.");
    else if (body.action === "close") router.push("/host");
    else await refresh();
    setBusy(false);
  }

  return (
    <main className="broadcast-shell">
      {confirmation && <ConfirmDialog title={confirmation.title} message={confirmation.message} confirmLabel={confirmation.confirmLabel} onClose={() => setConfirmation(null)} onConfirm={() => { const confirm = confirmation.onConfirm; setConfirmation(null); confirm(); }} />}
      {editingRound && <DialogFrame title={`Edit ${editingRound.name ?? "round"}`} onClose={() => setEditingRound(null)}><form className="round-edit-form" onSubmit={saveRoundEdit}><label>Captioning seconds<input name="captioningSeconds" type="number" min="5" max="600" required defaultValue={editingRound.captioning_seconds} /></label><label>Voting seconds<input name="votingSeconds" type="number" min="5" max="600" required defaultValue={editingRound.voting_seconds} /></label><label>Caption limit<input name="captionGraphemeLimit" type="number" min="1" max="120" required defaultValue={editingRound.caption_grapheme_limit} /></label><div className="dialog-actions"><button className="back-link" type="button" onClick={() => setEditingRound(null)}>Cancel</button><button className="broadcast-action" type="submit">Save changes</button></div></form></DialogFrame>}
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
          <div className="party-code-header">
            <h1>{party.party_code}</h1>
            {party.game_session_state !== "finished" && <button className="back-link" type="button" disabled={busy} onClick={() => setConfirmation({ title: "Close Party", message: "Close this Party now? Any active round will end immediately.", confirmLabel: "Close Party", onConfirm: () => void lifecycleCommand({ action: "close" }) })}>Close Party</button>}
          </div>
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
          <div className="broadcast-panel setup-panel session-panel">
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
            <div className="session-actions">
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
            </div>
            {error && <div className="status-notice status-error" role="alert">{error}</div>}
          </div>
          <div className="broadcast-panel setup-panel">
            <div className="panel-heading"><SlidersHorizontal aria-hidden="true" /><div><span>Picture-caption rounds</span><h2>{rounds.filter((round) => round.state === "pending").length} Pending</h2></div></div>
            <div className="round-template-workspace"><section><div className="round-pane-heading"><span>Selected rounds</span><strong>{rounds.length}</strong></div><div className="round-selection-list">{rounds.length === 0 ? <p className="round-pane-empty">Choose templates from the catalog.</p> : rounds.map((round, index) => <article className="round-selection-item" key={round.round_id}>{round.template_id && <Image className="template-thumbnail" src={`/api/pictures/${round.template_id}`} alt="" width={88} height={64} unoptimized />}<div><div className="round-name"><strong>{round.name ?? "Started round"}</strong>{index === currentRoundIndex && <span className="round-state-badge round-state-current">Current</span>}{index === nextRoundIndex && <span className="round-state-badge">Next</span>}</div><span>{round.prompt ?? "No prompt"} · {round.captioning_seconds}s caption / {round.voting_seconds}s vote</span></div>{round.state === "pending" && <div className="round-item-actions"><button className="icon-button" type="button" disabled={busy || !canWrite} title="Edit round settings" onClick={() => void editRound(round)}><Pencil aria-hidden="true" /></button><button className="icon-button" type="button" disabled={busy || !canWrite || index === 0} title="Move round up" onClick={() => void roundCommand({ action: "reorder", roundId: round.round_id, position: index - 1 })}><ArrowUp aria-hidden="true" /></button><button className="icon-button" type="button" disabled={busy || !canWrite || index === rounds.length - 1} title="Move round down" onClick={() => void roundCommand({ action: "reorder", roundId: round.round_id, position: index + 1 })}><ArrowDown aria-hidden="true" /></button><button className="icon-button" type="button" disabled={busy || !canWrite} title="Duplicate round" onClick={() => void roundCommand({ action: "duplicate", roundId: round.round_id })}><Copy aria-hidden="true" /></button><button className="icon-button" type="button" disabled={busy || !canWrite} title="Delete round" onClick={() => void roundCommand({ action: "delete", roundId: round.round_id })}><Trash2 aria-hidden="true" /></button></div>}</article>)}</div></section>{(party.game_session_state === "setup" || party.game_session_state === "lobby" || (party.game_session_state === "live" && !rounds.some((round) => round.state === "active"))) && <section><div className="round-pane-heading"><span>Template catalog</span><strong>{availableTemplates.length}</strong></div><div className="round-catalog-list">{availableTemplates.map((template) => <article className="round-catalog-item" key={template.template_id}><Image className="template-thumbnail" src={`/api/pictures/${template.template_id}`} alt={`Preview of ${template.name}`} width={88} height={64} unoptimized /><div><strong>{template.name}</strong><span>{template.prompt || "No prompt"}</span></div><button className="icon-button" disabled={busy || !canWrite} type="button" title={`Add ${template.name}`} aria-label={`Add ${template.name}`} onClick={() => void roundCommand({ action: "add", templateId: template.template_id })}><Plus aria-hidden="true" /></button></article>)}</div></section>}</div>
            {party.game_session_state === "lobby" && <button className="broadcast-action" type="button" disabled={busy || !canWrite || joinedPlayerCount === 0 || !rounds.some((round) => round.state === "pending")} onClick={() => void roundCommand({}, "session/start")}>Start captioning</button>}
            {party.game_session_state === "live" && rounds.some((round) => round.state === "active") && <button className="broadcast-action" type="button" disabled={busy || !canWrite} onClick={() => void roundCommand({ paused: rounds.find((round) => round.state === "active")?.captioning_deadline !== null }, "session/pause")}>{rounds.find((round) => round.state === "active")?.captioning_deadline ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />} {rounds.find((round) => round.state === "active")?.captioning_deadline ? "Pause timer" : "Resume timer"}</button>}
            {party.game_session_state === "live" && rounds.some((round) => round.phase === "captioning") && <><p>{completion?.submission_count ?? 0} of {completion?.eligible_count ?? 0} captions submitted</p><div className="roster-list">{submissions.map((submission) => <div className="roster-row" key={submission.submission_id}><div><strong>{submission.nickname}</strong><span>{submission.caption}</span></div><button className="icon-button" type="button" title={`Remove ${submission.nickname}'s caption`} disabled={busy || !canWrite} onClick={() => void captionCommand({ action: "remove", submissionId: submission.submission_id })}><Trash2 aria-hidden="true" /></button></div>)}</div><button className="broadcast-action" type="button" disabled={busy || !canWrite} onClick={() => setConfirmation({ title: "Close Captioning", message: "Close Captioning even if responses are missing?", confirmLabel: "Close Captioning", onConfirm: () => void captionCommand({ action: "close", confirmMissing: true }) })}>Close Captioning</button></>}
            {party.game_session_state === "live" && rounds.some((round) => round.phase === "voting") && <><p>{new Set(ballots.filter((ballot) => ballot.voter_nickname).map((ballot) => ballot.voter_nickname)).size} ballots received</p><div className="roster-list">{ballots.map((ballot) => <div className="roster-row" key={`${ballot.candidate_id}-${ballot.voter_nickname ?? "pending"}`}><div><strong>{ballot.caption}</strong><span>{ballot.voter_nickname ?? "No ballot yet"}</span></div><b>{ballot.points}</b></div>)}</div><button className="broadcast-action" type="button" disabled={busy || !canWrite} onClick={() => setConfirmation({ title: "Close Voting", message: "Close Voting with missing ballots?", confirmLabel: "Close Voting", onConfirm: () => void roundCommand({ confirmMissing: true }, "ballots") })}>Close Voting</button></>}
            {party.game_session_state === "live" && rounds.some((round) => round.phase === "revealing") && <button className="broadcast-action" type="button" disabled={busy || !canWrite} onClick={() => void roundCommand({ action: "continue" }, "results")}>Continue</button>}
            {party.game_session_state === "live" && !rounds.some((round) => round.state === "active") && <div className="round-lifecycle-actions">{rounds.some((round) => round.state === "completed") && !rounds.some((round) => round.phase === "revealing") && <button className="broadcast-action" type="button" disabled={busy || !canWrite} onClick={() => void roundCommand({ action: "start-reveal" }, "results")}>Start Reveal</button>}<button className="broadcast-action" type="button" disabled={busy || !canWrite} onClick={() => void lifecycleCommand({ action: "finish" })}>Finish Game session</button></div>}
            {party.game_session_state === "finished" && <><p>Finished. Scores can be corrected before the next Game session.</p><div className="roster-list">{roster.filter((member) => member.access_status === "joined").map((member) => <div className="roster-row" key={`score-${member.member_id}`}><strong>{member.nickname}</strong><span>{member.score} points</span><button className="icon-button" type="button" title={`Subtract one point from ${member.nickname}`} disabled={busy || !canWrite} onClick={() => void lifecycleCommand({ action: "adjust", memberId: member.member_id, delta: -1 })}>-</button><button className="icon-button" type="button" title={`Add one point to ${member.nickname}`} disabled={busy || !canWrite} onClick={() => void lifecycleCommand({ action: "adjust", memberId: member.member_id, delta: 1 })}>+</button></div>)}</div><button className="broadcast-action" type="button" disabled={busy || !canWrite} onClick={() => void lifecycleCommand({ action: "successor" })}>Start next Game session</button></>}
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
              .filter((member) => member.member_id && member.access_status === "joined")
              .map((member) => (
                <div className="roster-row" key={member.member_id}>
                  <span
                    className="roster-color"
                    style={{ backgroundColor: member.color }}
                    aria-hidden="true"
                  />
                  <div>
                    <strong>{member.nickname}</strong>
                    <span>{member.ready ? "Ready" : "Waiting"} · Score {member.score}</span>
                  </div>
                  <button
                    className="icon-button"
                    type="button"
                    disabled={busy || busyMemberId === member.member_id || !canWrite}
                    onClick={() => void setMemberAccess(member)}
                    title={`Remove ${member.nickname}`}
                    aria-label={`Remove ${member.nickname}`}
                  >
                    <UserRoundX aria-hidden="true" />
                  </button>
                </div>
              ))}
          </div>
        </aside>
      </div>
    </main>
  );
}
