import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { joinParty } from "@/lib/player/parties";

const schema = z.object({ commandId: z.string().uuid(), partyCode: z.string().regex(/^[A-Za-z0-9]{6}$/), nickname: z.string().trim().min(1).max(30) });
const cookieName = "quizmaster_player_id";

export async function POST(request: Request) {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    const cookieStore = await cookies();
    let playerId = cookieStore.get(cookieName)?.value;
    if (!playerId) playerId = crypto.randomUUID();
    try {
        const member = await joinParty({ playerId, ...parsed.data });
        const response = NextResponse.json({ member });
        if (!cookieStore.has(cookieName)) response.cookies.set(cookieName, playerId, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" });
        return response;
    } catch (error) {
        const message = error instanceof Error ? error.message : "join_failed";
        const status = message === "nickname_taken" ? 409 : message === "joining_closed" ? 403 : message === "party_not_found" ? 404 : 503;
        return NextResponse.json({ error: ["nickname_taken", "joining_closed", "party_not_found"].includes(message) ? message : "unavailable" }, { status });
    }
}
