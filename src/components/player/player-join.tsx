"use client";

import { ArrowRight, Radio } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function PlayerJoin({ initialCode = "" }: { initialCode?: string }) {
    const router = useRouter();
    const [partyCode, setPartyCode] = useState(initialCode);
    const [nickname, setNickname] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    async function submit(event: React.FormEvent) {
        event.preventDefault(); setBusy(true); setError(null);
        const code = partyCode.trim().toUpperCase();
        const statusResponse = await fetch(`/api/play/status/${code}`);
        if (!statusResponse.ok) { setError("That Party could not be found."); setBusy(false); return; }
        const { status } = await statusResponse.json() as { status: { session_revision: number; joining_open: boolean; session_state: string } };
        if (status.session_state !== "lobby" || !status.joining_open) { setError("This Party is not accepting new Players."); setBusy(false); return; }
        const response = await fetch("/api/play/join", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ partyCode: code, nickname, expectedRevision: status.session_revision, commandId: crypto.randomUUID() }) });
        if (!response.ok) { setError(response.status === 409 ? "That nickname is already in use, or the Lobby changed. Try again." : "Could not join this Party."); setBusy(false); return; }
        router.push(`/play/${code}`);
    }

    return <main className="broadcast-shell auth-screen"><header className="broadcast-header"><span className="broadcast-brand"><span className="broadcast-mark">Q</span><span>Quizmaster</span></span><span className="signal-chip"><Radio size={16} /> Player join</span></header><div className="auth-grid"><section className="auth-intro"><p className="broadcast-kicker">Enter the room</p><h1>Join a Party</h1><p>Use the code on the shared screen, choose your name, and take your place in the Lobby.</p><Link className="back-link" href="/host">Host sign-in</Link></section><form className="broadcast-panel auth-panel" onSubmit={submit}><label>Party code<input required minLength={6} maxLength={6} pattern="[A-Za-z0-9]{6}" value={partyCode} onChange={(event) => setPartyCode(event.target.value)} /></label><label>Nickname<input required minLength={1} maxLength={30} value={nickname} onChange={(event) => setNickname(event.target.value)} /></label>{error && <div className="status-notice status-error" role="alert">{error}</div>}<button className="broadcast-action" disabled={busy} type="submit">{busy ? "Joining..." : "Join Lobby"}<ArrowRight aria-hidden="true" /></button></form></div></main>;
}
