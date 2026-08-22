import { parseEnvironment } from "../../../lib/env";

export const dynamic = "force-dynamic";

export async function GET() {
    const environment = parseEnvironment(process.env);
    let failureReason = "request_failed";

    try {
        const response = await fetch(
            `${environment.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`,
            {
                cache: "no-store",
                headers: {
                    apikey: environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
                },
            },
        );

        if (response.ok) {
            return Response.json({ status: "ok", services: { supabase: "ok" } });
        }
        failureReason = `http_${response.status}`;
    } catch {
        // The public health response intentionally omits provider error details.
    }

    console.error(
        JSON.stringify({
            event: "health_check_degraded",
            service: "supabase",
            reason: failureReason,
        }),
    );

    return Response.json(
        { status: "degraded", services: { supabase: "unavailable" } },
        { status: 503 },
    );
}