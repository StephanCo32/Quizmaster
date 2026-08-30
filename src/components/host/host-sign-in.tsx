"use client";

import { Mail, Radio } from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";

type HostSignInProps = {
    nextPath?: string;
    callbackFailed?: boolean;
    initialStatus?: "idle" | "sending" | "sent" | "error";
};

export function HostSignIn({
    nextPath = "/host",
    callbackFailed = false,
    initialStatus = "idle",
}: HostSignInProps) {
    const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
        callbackFailed ? "error" : initialStatus,
    );
    const [adminLogin, setAdminLogin] = useState(false);

    async function requestMagicLink(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setStatus("sending");
        const formData = new FormData(event.currentTarget);

        const response = await fetch("/api/auth/magic-link", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                email: formData.get("email"),
                next: nextPath,
                admin: adminLogin,
                secret: formData.get("secret"),
            }),
        });

        if (!response.ok) {
            setStatus("error");
            return;
        }

        setStatus("sent");
        if (adminLogin) window.location.assign(nextPath);
    }

    return (
        <main className="broadcast-shell auth-screen">
            <header className="broadcast-header">
                <Link className="broadcast-brand" href="/">
                    <span className="broadcast-mark">Q</span>
                    <span>Quizmaster</span>
                </Link>
                <span className="signal-chip"><Radio size={16} /> Host channel</span>
            </header>
            <section className="auth-grid">
                <div className="auth-intro">
                    <p className="broadcast-kicker">Control room access</p>
                    <h1>Bring the room online.</h1>
                    <p>Sign in with a one-time link to create Parties and run the show.</p>
                </div>
                <form className="broadcast-panel auth-panel" onSubmit={requestMagicLink}>
                    <div className="panel-heading">
                        <Mail aria-hidden="true" />
                        <div>
                            <span>Secure access</span>
                            <h2>{adminLogin ? "Admin sign-in" : "Email magic link"}</h2>
                        </div>
                    </div>
                    <label htmlFor="host-email">Host email</label>
                    <input
                        id="host-email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        required
                        disabled={status === "sending" || status === "sent"}
                    />
                    <label htmlFor="admin-secret">Content admin secret</label>
                    <input id="admin-secret" name="secret" type="password" autoComplete="current-password" disabled={status === "sending" || status === "sent"} />
                    <button className="broadcast-action" type="submit" disabled={status === "sending" || status === "sent"}>
                        <Mail size={19} aria-hidden="true" />
                        {status === "sending" ? "Signing in..." : status === "sent" ? "Signed in" : adminLogin ? "Sign in as content admin" : "Send Host magic link"}
                    </button>
                    <button className="back-link" type="button" disabled={status === "sending" || status === "sent"} onClick={() => setAdminLogin((current) => !current)}>{adminLogin ? "Use Host login" : "Use content admin login"}</button>
                    <div className={`status-notice status-${status}`} role="status" aria-live="polite">
                        {status === "idle" && (adminLogin ? "Enter the content admin secret to sign in on this device." : "The link signs in only this browser.")}
                        {status === "sending" && (adminLogin ? "Checking admin access..." : "Requesting a secure sign-in link...")}
                        {status === "sent" && (adminLogin ? "Signed in. Opening the Host dashboard..." : "Check your inbox. You can close this tab after opening the link.")}
                        {status === "error" && "The link could not be issued or completed. Check the address and try again."}
                    </div>
                </form>
            </section>
        </main>
    );
}