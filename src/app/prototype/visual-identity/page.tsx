import type { Metadata } from "next";

import { PrototypeSwitcher } from "./prototype-switcher";
import "./prototype.css";

// Three visual-system variants, switchable via ?variant=, across ?role=host|player|display.

export const metadata: Metadata = { title: "Visual identity prototype" };

type Role = "host" | "player" | "display";
type Variant = "A" | "B" | "C";

type PrototypePageProps = {
    searchParams: Promise<{ capture?: string; role?: string; variant?: string }>;
};

const players = [
    ["1", "Maya", "2,450", "mint"],
    ["2", "Ravi", "2,100", "pink"],
    ["3", "Noor", "1,850", "yellow"],
    ["4", "Felix", "1,500", "blue"],
] as const;

function Brand({ label = "Quizmaster" }: { label?: string }) {
    return <div className="proto-brand"><b>Q!</b><span>{label}</span></div>;
}

function ScoreList() {
    return (
        <ol className="score-list">
            {players.map(([place, name, score, color]) => (
                <li key={name}>
                    <span className={`player-dot ${color}`}>{place}</span>
                    <strong>{name}</strong>
                    <b>{score}</b>
                </li>
            ))}
        </ol>
    );
}

function PhotoPrompt() {
    return (
        <div className="photo-prompt" role="img" aria-label="A person jumping into a lake at sunset">
            <span>Caption this!</span>
        </div>
    );
}

function HostContent() {
    return (
        <>
            <section className="host-stage">
                <div className="section-heading"><span>Round 3 of 5</span><b>Caption clash</b></div>
                <PhotoPrompt />
                <div className="answer-grid">
                    <button className="answer selected" type="button"><small>Top vote</small>Gracefully entering Monday</button>
                    <button className="answer" type="button"><small>8 votes</small>Me after one productive email</button>
                    <button className="answer" type="button"><small>5 votes</small>There goes the group budget</button>
                </div>
            </section>
            <aside className="host-rail">
                <div className="timer"><small>Voting closes</small><strong>0:18</strong></div>
                <button className="primary-action" type="button">Reveal winner</button>
                <div className="connection"><i />12 players connected</div>
                <ScoreList />
            </aside>
        </>
    );
}

function PlayerContent() {
    return (
        <section className="player-stage">
            <div className="round-pill">Round 3 · Vote now</div>
            <PhotoPrompt />
            <h1>Pick the funniest caption</h1>
            <div className="answer-stack">
                <button className="answer selected" type="button"><span>A</span>Gracefully entering Monday</button>
                <button className="answer" type="button"><span>B</span>Me after one productive email</button>
                <button className="answer" type="button"><span>C</span>There goes the group budget</button>
            </div>
            <p className="player-status">Vote locked · waiting for 3 players</p>
        </section>
    );
}

function DisplayContent() {
    return (
        <>
            <section className="display-stage">
                <div className="section-heading"><span>Round 3</span><b>Caption clash</b></div>
                <PhotoPrompt />
                <div className="display-answer">“Gracefully entering Monday”<small>Votes are flying in...</small></div>
            </section>
            <aside className="display-score">
                <div className="timer"><small>Time to vote</small><strong>18</strong></div>
                <h2>Scoreboard</h2>
                <ScoreList />
                <div className="connection"><i />12 players are in</div>
            </aside>
        </>
    );
}

function RoleContent({ role }: { role: Role }) {
    if (role === "player") return <PlayerContent />;
    if (role === "display") return <DisplayContent />;
    return <HostContent />;
}

function VariantA({ role }: { role: Role }) {
    return (
        <main className={`visual-prototype variant-a role-${role}`}>
            <header className="proto-header">
                <Brand />
                <div className="session-code"><small>Join at quiz.fun</small><b>MINT-42</b></div>
                <div className="host-state"><i />Live</div>
            </header>
            <div className="proto-layout"><RoleContent role={role} /></div>
        </main>
    );
}

function VariantB({ role }: { role: Role }) {
    return (
        <main className={`visual-prototype variant-b role-${role}`}>
            <header className="proto-header"><Brand label="The Quizmaster" /><span>Live session · MINT-42</span></header>
            <div className="ticker"><b>Round three</b><span>Make the room laugh</span><strong>00:18</strong></div>
            <div className="proto-layout"><RoleContent role={role} /></div>
        </main>
    );
}

function VariantC({ role }: { role: Role }) {
    return (
        <main className={`visual-prototype variant-c role-${role}`}>
            <header className="proto-header"><Brand /><nav>PLAYERS <b>12</b> · ROUND <b>03/05</b> · LIVE</nav></header>
            <div className="color-ribbon"><i /><i /><i /><i /><i /></div>
            <div className="proto-layout"><RoleContent role={role} /></div>
        </main>
    );
}

export default async function VisualIdentityPrototype({ searchParams }: PrototypePageProps) {
    const params = await searchParams;
    const role: Role = params.role === "player" || params.role === "display" ? params.role : "host";
    const variant: Variant = params.variant === "B" || params.variant === "C" ? params.variant : "A";

    return (
        <>
            {variant === "A" && <VariantA role={role} />}
            {variant === "B" && <VariantB role={role} />}
            {variant === "C" && <VariantC role={role} />}
            {params.capture !== "1" && <PrototypeSwitcher currentRole={role} currentVariant={variant} />}
        </>
    );
}