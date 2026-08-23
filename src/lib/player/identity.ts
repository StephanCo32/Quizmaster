import { cookies } from "next/headers";

export const playerCookieName = "quizmaster_player_id";

export async function getPlayerId() {
    return (await cookies()).get(playerCookieName)?.value ?? null;
}
