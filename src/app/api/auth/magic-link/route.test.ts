import { beforeEach, describe, expect, it, vi } from "vitest";

const signInWithOtp = vi.fn();
const { setAdminSession, listUsers, contentAdminCheck } = vi.hoisted(() => ({
    setAdminSession: vi.fn(),
    listUsers: vi.fn(),
    contentAdminCheck: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
    createSupabaseServerClient: vi.fn(async () => ({
        auth: { signInWithOtp },
    })),
}));

vi.mock("@/lib/env", () => ({
    appUrl: () => "https://quizmaster-ebon-beta.vercel.app",
    contentAdminSecret: () => "correct-secret",
}));

vi.mock("@/lib/host/admin-session", () => ({ setAdminSession }));

vi.mock("@/lib/supabase/admin", () => ({
    createSupabaseAdminClient: () => ({
        auth: { admin: { listUsers } },
        rpc: contentAdminCheck,
    }),
}));

import { POST } from "./route";

describe("POST /api/auth/magic-link", () => {
    beforeEach(() => {
        signInWithOtp.mockReset();
        signInWithOtp.mockResolvedValue({ error: null });
        setAdminSession.mockReset();
        listUsers.mockReset();
        contentAdminCheck.mockReset();
    });

    it("sends a magic link with the canonical application callback URL", async () => {
        const request = new Request("https://quizmaster.test/api/auth/magic-link", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                email: "host@example.com",
                next: "https://attacker.test/steal",
            }),
        });

        const response = await POST(request);

        expect(response.status).toBe(202);
        expect(signInWithOtp).toHaveBeenCalledWith({
            email: "host@example.com",
            options: {
                emailRedirectTo:
                    "https://quizmaster-ebon-beta.vercel.app/auth/callback?next=%2Fhost",
            },
        });
    });

    it("rejects an admin login with an invalid secret", async () => {
        const response = await POST(new Request("https://quizmaster.test/api/auth/magic-link", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ email: "admin@example.com", admin: true, secret: "wrong-secret" }),
        }));

        expect(response.status).toBe(403);
        await expect(response.json()).resolves.toEqual({ error: "invalid_admin_credentials" });
        expect(signInWithOtp).not.toHaveBeenCalled();
    });

    it("signs in an authorized admin without sending a magic link", async () => {
        listUsers.mockResolvedValue({
            data: { users: [{ id: "7db31824-bd2d-4e4e-a03e-22025340ec53", email: "admin@example.com" }] },
            error: null,
        });
        contentAdminCheck.mockResolvedValue({ data: true, error: null });

        const response = await POST(new Request("https://quizmaster.test/api/auth/magic-link", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ email: "admin@example.com", admin: true, secret: "correct-secret" }),
        }));

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({ status: "signed_in" });
        expect(setAdminSession).toHaveBeenCalledWith(response, {
            id: "7db31824-bd2d-4e4e-a03e-22025340ec53",
            email: "admin@example.com",
        });
        expect(signInWithOtp).not.toHaveBeenCalled();
    });
});