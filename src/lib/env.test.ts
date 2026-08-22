import { describe, expect, it } from "vitest";

import { parseEnvironment } from "./env";

describe("parseEnvironment", () => {
    it("accepts the required Vercel and Supabase configuration", () => {
        expect(
            parseEnvironment({
                NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
                NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable-key",
                SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
            }),
        ).toEqual({
            NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
            NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable-key",
            SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
        });
    });

    it("names invalid variables without exposing their values", () => {
        expect(() =>
            parseEnvironment({
                NEXT_PUBLIC_SUPABASE_URL: "not-a-url",
                NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "",
                SUPABASE_SERVICE_ROLE_KEY: "super-secret-value",
            }),
        ).toThrow(
            "Invalid environment variables: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
        );
    });
});