import { beforeEach, describe, expect, it, vi } from "vitest";

const exchangeCodeForSession = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
    createSupabaseServerClient: vi.fn(async () => ({
        auth: { exchangeCodeForSession },
    })),
}));

import { GET } from "./route";

describe("GET /auth/callback", () => {
    beforeEach(() => {
        exchangeCodeForSession.mockReset();
        exchangeCodeForSession.mockResolvedValue({ error: null });
    });

    it("exchanges the code but rejects an external return destination", async () => {
        const response = await GET(
            new Request(
                "https://quizmaster.test/auth/callback?code=magic-code&next=https://attacker.test/steal",
            ),
        );

        expect(exchangeCodeForSession).toHaveBeenCalledWith("magic-code");
        expect(response.status).toBe(307);
        expect(response.headers.get("location")).toBe("https://quizmaster.test/host");
    });
});