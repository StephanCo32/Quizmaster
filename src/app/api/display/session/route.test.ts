import { beforeEach, describe, expect, it, vi } from "vitest";

const { authorizeDisplaySession, getHost, signOut } = vi.hoisted(() => ({
    authorizeDisplaySession: vi.fn(),
    getHost: vi.fn(),
    signOut: vi.fn(),
}));

vi.mock("@/lib/display/sessions", () => ({ authorizeDisplaySession, displaySessionCookieName: "quizmaster_display_session" }));
vi.mock("@/lib/host/session", () => ({ getHost }));
vi.mock("@/lib/supabase/server", () => ({
    createSupabaseServerClient: vi.fn().mockResolvedValue({ auth: { signOut } }),
}));

import { POST } from "./route";

describe("POST /api/display/session", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getHost.mockResolvedValue({ id: "host-1" });
        authorizeDisplaySession.mockResolvedValue({ party_code: "ABC123" });
        signOut.mockResolvedValue({ error: null });
    });

    it("exchanges Host authority for an opaque Display session and signs out locally", async () => {
        const response = await POST(new Request("http://localhost/api/display/session", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ partyId: "11111111-1111-4111-8111-111111111111", commandId: "22222222-2222-4222-8222-222222222222" }),
        }));

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ partyCode: "ABC123" });
        expect(authorizeDisplaySession).toHaveBeenCalledWith(expect.objectContaining({ hostId: "host-1" }));
        expect(signOut).toHaveBeenCalledOnce();
        expect(response.headers.get("set-cookie")).toContain("quizmaster_display_session=");
        expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    });

    it("does not reveal whether a Party is available without a Host session", async () => {
        getHost.mockResolvedValue(null);

        const response = await POST(new Request("http://localhost/api/display/session", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ partyId: "11111111-1111-4111-8111-111111111111", commandId: "22222222-2222-4222-8222-222222222222" }),
        }));

        expect(response.status).toBe(404);
        expect(authorizeDisplaySession).not.toHaveBeenCalled();
    });
});