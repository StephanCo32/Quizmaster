import { beforeEach, describe, expect, it, vi } from "vitest";

const signInWithOtp = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
    createSupabaseServerClient: vi.fn(async () => ({
        auth: { signInWithOtp },
    })),
}));

import { POST } from "./route";

describe("POST /api/auth/magic-link", () => {
    beforeEach(() => {
        signInWithOtp.mockReset();
        signInWithOtp.mockResolvedValue({ error: null });
    });

    it("sends a magic link with a validated local Host return", async () => {
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
                    "https://quizmaster.test/auth/callback?next=%2Fhost",
            },
        });
    });
});