import "server-only";
import { cookies } from "next/headers";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { ActivePictureCaptionRound, DisplayMemberProjection, DisplayPartyProjection, DisplayPictureCaptionCandidate, PictureCaptionCompletion, PictureCaptionResult } from "@/lib/supabase/database.types";

export const displaySessionCookieName = "quizmaster_display_session";

export async function getDisplaySessionId() {
    return (await cookies()).get(displaySessionCookieName)?.value ?? null;
}

export async function authorizeDisplaySession(command: { hostId: string; partyId: string; commandId: string; displaySessionId: string }) {
    const { data, error } = await createSupabaseAdminClient().rpc("authorize_display_session", {
        p_host_id: command.hostId,
        p_party_id: command.partyId,
        p_command_id: command.commandId,
        p_display_session_id: command.displaySessionId,
    });
    if (error) throw new Error("display_authorization_failed", { cause: error });
    const result = data.at(0);
    if (!result) throw new Error("display_authorization_failed");
    return result;
}

export async function revokeDisplaySession(hostId: string, partyId: string) {
    const { error } = await createSupabaseAdminClient().rpc("revoke_display_session", { p_host_id: hostId, p_party_id: partyId });
    if (error) throw new Error("display_revocation_failed", { cause: error });
}

export async function getDisplayParty(displaySessionId: string, partyCode: string): Promise<DisplayPartyProjection | null> {
    const { data, error } = await createSupabaseAdminClient().rpc("display_party_projection", { p_display_session_id: displaySessionId, p_party_code: partyCode });
    if (error) throw new Error("display_projection_unavailable", { cause: error });
    return data.at(0) ?? null;
}

export async function getDisplayPartyLobby(displaySessionId: string, partyCode: string): Promise<DisplayMemberProjection[]> {
    const { data, error } = await createSupabaseAdminClient().rpc("display_party_lobby_projection", { p_display_session_id: displaySessionId, p_party_code: partyCode });
    if (error) throw new Error("display_projection_unavailable", { cause: error });
    return data;
}

export async function getDisplayPartyCanonicalCode(displaySessionId: string, partyCode: string) {
    const { data, error } = await createSupabaseAdminClient().rpc("display_party_canonical_code", { p_display_session_id: displaySessionId, p_party_code: partyCode });
    if (error) throw new Error("display_projection_unavailable", { cause: error });
    return data;
}

export async function getDisplayPictureCaptionRound(displaySessionId: string, partyCode: string): Promise<ActivePictureCaptionRound | null> {
    const client = createSupabaseAdminClient();
    const { data, error } = await client.rpc("display_picture_caption_round_projection", { p_display_session_id: displaySessionId, p_party_code: partyCode });
    if (error) throw new Error("display_projection_unavailable", { cause: error });
    let round = data.at(0) ?? null;
    if (round?.phase === "captioning" || round?.phase === "voting") {
        const { error: deadlineError } = await client.rpc("resolve_picture_caption_deadline", { p_game_session_id: round.game_session_id });
        if (deadlineError) throw new Error("display_projection_unavailable", { cause: deadlineError });
        const { data: resolved, error: resolvedError } = await client.rpc("display_picture_caption_round_projection", { p_display_session_id: displaySessionId, p_party_code: partyCode });
        if (resolvedError) throw new Error("display_projection_unavailable", { cause: resolvedError });
        round = resolved.at(0) ?? null;
    }
    if (round?.phase !== "revealing") return round;
    const { error: resolveError } = await client.rpc("resolve_picture_caption_reveal", { p_game_session_id: round.game_session_id });
    if (resolveError) throw new Error("display_projection_unavailable", { cause: resolveError });
    const { data: resolved, error: resolvedError } = await client.rpc("display_picture_caption_round_projection", { p_display_session_id: displaySessionId, p_party_code: partyCode });
    if (resolvedError) throw new Error("display_projection_unavailable", { cause: resolvedError });
    return resolved.at(0) ?? null;
}

export async function getDisplayPictureCaptionCompletion(displaySessionId: string, partyCode: string): Promise<PictureCaptionCompletion | null> { const { data, error } = await createSupabaseAdminClient().rpc("display_picture_caption_completion_projection", { p_display_session_id: displaySessionId, p_party_code: partyCode }); if (error) throw new Error("display_projection_unavailable", { cause: error }); return data.at(0) ?? null; }
export async function getDisplayPictureCaptionCandidates(displaySessionId: string, partyCode: string): Promise<DisplayPictureCaptionCandidate[]> { const { data, error } = await createSupabaseAdminClient().rpc("display_picture_caption_candidates_projection", { p_display_session_id: displaySessionId, p_party_code: partyCode }); if (error) throw new Error("display_projection_unavailable", { cause: error }); return data; }
export async function getDisplayPictureCaptionResults(displaySessionId: string, partyCode: string): Promise<PictureCaptionResult[]> { const { data, error } = await createSupabaseAdminClient().rpc("display_picture_caption_results_projection", { p_display_session_id: displaySessionId, p_party_code: partyCode }); if (error) throw new Error("display_projection_unavailable", { cause: error }); return data; }