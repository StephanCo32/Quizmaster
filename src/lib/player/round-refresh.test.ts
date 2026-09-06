import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ActivePictureCaptionRound } from "@/lib/supabase/database.types";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => ({ rpc }) }));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));

import { getPlayerPictureCaptionRound } from "./parties";
import { getDisplayPictureCaptionRound } from "@/lib/display/sessions";

describe.each([
    ["Player", getPlayerPictureCaptionRound],
    ["Display", getDisplayPictureCaptionRound],
] as const)("%s round refresh request budget", (_role, getRound) => {
    let round: ActivePictureCaptionRound;

    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-09-06T12:00:00Z"));
        round = {
            round_id: "round-1", game_session_id: "session-1", session_revision: 4,
            phase: "captioning", official_caption: null, caption_grapheme_limit: 75,
            captioning_deadline: "2026-09-06T12:05:00Z", paused_remaining_seconds: null,
            turn_deadline: null, turn_paused_remaining_seconds: null,
        };
        rpc.mockReset();
        rpc.mockImplementation(async () => ({ data: [round], error: null }));
    });

    afterEach(() => vi.useRealTimers());

    it.each(["captioning", "voting"] as const)("does not resolve a live %s deadline on every refresh", async (phase) => {
        round.phase = phase;
        round.turn_deadline = phase === "voting" ? round.captioning_deadline : null;
        if (phase === "voting") round.captioning_deadline = null;
        await Promise.all(Array.from({ length: 20 }, () => getRound("viewer-1", "ABC123")));
        expect(rpc).toHaveBeenCalledTimes(20);
        expect(rpc.mock.calls.some(([name]) => name === "resolve_picture_caption_deadline")).toBe(false);
    });

    it("does not resolve paused rounds", async () => {
        round.captioning_deadline = null;
        round.paused_remaining_seconds = 30;
        await getRound("viewer-1", "ABC123");
        expect(rpc).toHaveBeenCalledOnce();
    });

    it.each(["captioning", "voting"] as const)("still resolves an expired %s deadline and rereads the projection", async (phase) => {
        round.phase = phase;
        round.captioning_deadline = phase === "captioning" ? "2026-09-06T11:59:59Z" : null;
        round.turn_deadline = phase === "voting" ? "2026-09-06T11:59:59Z" : null;
        await getRound("viewer-1", "ABC123");
        expect(rpc).toHaveBeenCalledTimes(3);
        expect(rpc).toHaveBeenNthCalledWith(2, "resolve_picture_caption_deadline", { p_game_session_id: "session-1" });
    });
});