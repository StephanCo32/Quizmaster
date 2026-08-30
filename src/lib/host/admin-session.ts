import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { contentAdminSecret } from "@/lib/env";

const COOKIE_NAME = "quizmaster-admin-session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;

type AdminSession = {
    userId: string;
    email: string;
    expiresAt: number;
};

function signature(value: string, secret: string) {
    return createHmac("sha256", secret).update(value).digest("base64url");
}

function encode(session: AdminSession, secret: string) {
    const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
    return `${payload}.${signature(payload, secret)}`;
}

function decode(value: string | undefined, secret: string | null) {
    if (!value || !secret) return null;

    const [payload, candidateSignature, ...rest] = value.split(".");
    if (!payload || !candidateSignature || rest.length > 0) return null;

    const expectedSignature = signature(payload, secret);
    const candidateBytes = Buffer.from(candidateSignature);
    const expectedBytes = Buffer.from(expectedSignature);
    if (candidateBytes.length !== expectedBytes.length || !timingSafeEqual(candidateBytes, expectedBytes)) return null;

    try {
        const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as AdminSession;
        if (!session.userId || !session.email || !Number.isFinite(session.expiresAt) || session.expiresAt <= Date.now()) return null;
        return session;
    } catch {
        return null;
    }
}

export async function getAdminSession() {
    const cookieStore = await cookies();
    return decode(cookieStore.get(COOKIE_NAME)?.value, contentAdminSecret());
}

export function setAdminSession(response: Response, user: { id: string; email: string }) {
    const secret = contentAdminSecret();
    if (!secret) throw new Error("content_admin_secret_unavailable");

    const session = {
        userId: user.id,
        email: user.email,
        expiresAt: Date.now() + SESSION_MAX_AGE_SECONDS * 1000,
    };
    const value = encode(session, secret);
    const attributes = [
        `${COOKIE_NAME}=${value}`,
        "Path=/",
        `Max-Age=${SESSION_MAX_AGE_SECONDS}`,
        "HttpOnly",
        "SameSite=Lax",
    ];
    if (process.env.NODE_ENV === "production") attributes.push("Secure");
    response.headers.append("Set-Cookie", attributes.join("; "));
}

export function clearAdminSession(response: Response) {
    response.headers.append("Set-Cookie", `${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`);
}