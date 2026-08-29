import { beforeEach, describe, expect, it, vi } from "vitest";

const { getDisplayParty, getDisplayPartyCanonicalCode, getDisplayPartyLobby, getDisplayPictureCaptionCandidates, getDisplayPictureCaptionCompletion, getDisplayPictureCaptionRound, getDisplaySessionId } = vi.hoisted(() => ({
    getDisplayParty: vi.fn(),
    getDisplayPartyCanonicalCode: vi.fn(),
    getDisplayPartyLobby: vi.fn(),
    getDisplayPictureCaptionCandidates: vi.fn(),
    getDisplayPictureCaptionCompletion: vi.fn(),
    getDisplayPictureCaptionRound: vi.fn(),
    getDisplaySessionId: vi.fn(),
}));

vi.mock("@/lib/display/sessions", () => ({ getDisplayParty, getDisplayPartyCanonicalCode, getDisplayPartyLobby, getDisplayPictureCaptionCandidates, getDisplayPictureCaptionCompletion, getDisplayPictureCaptionRound, getDisplaySessionId }));

import { GET } from "./route";

describe("GET /api/display/[partyCode]", () => {
    beforeEach(() => vi.clearAllMocks());

    it("returns generic not found without a Display session", async () => {
        getDisplaySessionId.mockResolvedValue(null);
        const response = await GET(new Request("http://localhost/api/display/ABC123"), { params: Promise.resolve({ partyCode: "ABC123" }) });

        expect(response.status).toBe(404);
        await expect(response.json()).resolves.toEqual({ error: "not_found" });
        expect(getDisplayParty).not.toHaveBeenCalled();
    });

    it("returns only the authorized Display projection", async () => {
        getDisplaySessionId.mockResolvedValue("11111111-1111-4111-8111-111111111111");
        getDisplayPartyCanonicalCode.mockResolvedValue("ABC123");
        getDisplayParty.mockResolvedValue({ party_code: "ABC123", game_session_id: "session-1", game_session_state: "lobby", session_revision: 2 });
        getDisplayPartyLobby.mockResolvedValue([{ member_id: "member-1", nickname: "Ada", color: "#123456", score: 0, ready: true }]);
        getDisplayPictureCaptionRound.mockResolvedValue(null);
        getDisplayPictureCaptionCompletion.mockResolvedValue(null);
        getDisplayPictureCaptionCandidates.mockResolvedValue([]);

        const response = await GET(new Request("http://localhost/api/display/ABC123"), { params: Promise.resolve({ partyCode: "ABC123" }) });

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual(expect.objectContaining({ canonicalCode: "ABC123", roster: [expect.objectContaining({ nickname: "Ada" })] }));
    });
});