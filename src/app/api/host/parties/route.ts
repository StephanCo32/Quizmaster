import { z } from "zod";
import { getHost } from "@/lib/host/session";
import { createParty } from "@/lib/host/parties";

const commandSchema = z.object({
    commandId: z.uuid(),
    expectedRevision: z.number().int().nonnegative(),
});

export async function POST(request: Request) {
    const host = await getHost();
    if (!host) {
        return Response.json({ error: "not_found" }, { status: 404 });
    }

    const parsed = commandSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
        return Response.json({ error: "invalid_command" }, { status: 400 });
    }

    try {
        const party = await createParty({
            hostId: host.id,
            commandId: parsed.data.commandId,
            expectedRevision: parsed.data.expectedRevision,
        });

        return Response.json(party, { status: 201 });
    } catch (error) {
        if (error instanceof Error && error.message === "stale_revision") {
            return Response.json({ error: "stale_revision" }, { status: 409 });
        }

        return Response.json({ error: "party_creation_failed" }, { status: 503 });
    }
}