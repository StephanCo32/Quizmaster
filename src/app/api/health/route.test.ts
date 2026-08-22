import { afterEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

describe("GET /api/health", () => {
    afterEach(() => {
        vi.unstubAllEnvs();
        vi.unstubAllGlobals();
    });

    it("reports healthy when Supabase is reachable", async () => {
        vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
        vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "publishable-key");
        vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-key");
        const fetchMock = vi
            .fn()
            .mockResolvedValue(new Response(null, { status: 200 }));
        vi.stubGlobal("fetch", fetchMock);

        const response = await GET();

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({
            status: "ok",
            services: { supabase: "ok" },
        });
        expect(fetchMock).toHaveBeenCalledOnce();
        expect(fetchMock.mock.calls[0]?.[0]).toBe(
            "https://project.supabase.co/rest/v1/",
        );
    });

    it("returns a sanitized degraded response when Supabase cannot be reached", async () => {
        vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
        vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "publishable-key");
        vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-key");
        vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("secret detail")));

        const response = await GET();

        expect(response.status).toBe(503);
        await expect(response.json()).resolves.toEqual({
            status: "degraded",
            services: { supabase: "unavailable" },
        });
    });
});