import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { ActivePictureCaptionRound, LobbyCommandResult, PartyMemberProjection, PictureCaptionCandidate, PictureCaptionResult } from "@/lib/supabase/database.types";

export async function joinParty(command: { playerId: string; commandId: string; partyCode: string; nickname: string; expectedRevision: number }): Promise<PartyMemberProjection> {
    const { data, error } = await createSupabaseAdminClient().rpc("join_party", { p_player_id: command.playerId, p_command_id: command.commandId, p_party_code: command.partyCode, p_nickname: command.nickname, p_expected_revision: command.expectedRevision });
    if (error) {
        const mapped = error.code === "23505" ? "nickname_taken" : error.message;
        throw new Error(mapped, { cause: error });
    }
    const result = data.at(0);
    if (!result) throw new Error("join_failed");
    return result;
}

export async function changeNickname(command: { playerId: string; memberId: string; commandId: string; nickname: string; expectedRevision: number }) {
    const { data, error } = await createSupabaseAdminClient().rpc("change_party_member_nickname", { p_player_id: command.playerId, p_member_id: command.memberId, p_command_id: command.commandId, p_nickname: command.nickname, p_expected_revision: command.expectedRevision });
    if (error) throw new Error(error.code === "23505" ? "nickname_taken" : error.code === "40001" ? "stale_revision" : "nickname_change_failed", { cause: error });
    const result = data.at(0);
    if (!result) throw new Error("nickname_change_failed");
    return result;
}

export async function setReady(command: { playerId: string; memberId: string; commandId: string; ready: boolean; expectedRevision: number }) {
    const { data, error } = await createSupabaseAdminClient().rpc("set_party_member_ready", { p_player_id: command.playerId, p_member_id: command.memberId, p_command_id: command.commandId, p_ready: command.ready, p_expected_revision: command.expectedRevision });
    if (error) throw new Error(error.code === "40001" ? "stale_revision" : "ready_change_failed", { cause: error });
    const result = data.at(0);
    if (!result) throw new Error("ready_change_failed");
    return result;
}

export async function getPlayerPartyLobby(playerId: string, partyCode: string): Promise<PartyMemberProjection[]> {
    const { data, error } = await createSupabaseAdminClient().rpc("player_party_lobby_projection", { p_player_id: playerId, p_party_code: partyCode });
    if (error) throw new Error("player_projection_unavailable", { cause: error });
    return data;
}

export async function getPlayerPartyCanonicalCode(playerId: string, partyCode: string) {
    const { data, error } = await createSupabaseAdminClient().rpc("player_party_canonical_code", { p_player_id: playerId, p_party_code: partyCode });
    if (error) throw new Error("player_canonical_code_unavailable", { cause: error });
    return data;
}

export async function getPlayerPictureCaptionRound(playerId: string, partyCode: string): Promise<ActivePictureCaptionRound | null> {
    const client = createSupabaseAdminClient();
    const { data, error } = await client.rpc("player_picture_caption_round_projection", { p_player_id: playerId, p_party_code: partyCode });
    if (error) throw new Error("player_projection_unavailable", { cause: error });
    let round = data.at(0) ?? null;
    if (round?.phase === "captioning" || round?.phase === "voting") {
        const { error: deadlineError } = await client.rpc("resolve_picture_caption_deadline", { p_game_session_id: round.game_session_id });
        if (deadlineError) throw new Error("player_projection_unavailable", { cause: deadlineError });
        const { data: resolved, error: resolvedError } = await client.rpc("player_picture_caption_round_projection", { p_player_id: playerId, p_party_code: partyCode });
        if (resolvedError) throw new Error("player_projection_unavailable", { cause: resolvedError });
        round = resolved.at(0) ?? null;
    }
    return round;
}

export async function getPlayerPictureCaptionSubmission(playerId: string, partyCode: string) {
    const { data, error } = await createSupabaseAdminClient().rpc("player_picture_caption_submission_projection", { p_player_id: playerId, p_party_code: partyCode });
    if (error) throw new Error("player_projection_unavailable", { cause: error });
    return data.at(0) ?? null;
}

export async function submitPictureCaption(command: { playerId: string; partyCode: string; commandId: string; expectedRevision: number; caption: string }): Promise<LobbyCommandResult> {
    const { data, error } = await createSupabaseAdminClient().rpc("submit_picture_caption", { p_player_id: command.playerId, p_party_code: command.partyCode, p_command_id: command.commandId, p_expected_revision: command.expectedRevision, p_caption: command.caption });
    if (error) throw new Error(error.code === "40001" ? "stale_revision" : error.message === "invalid_caption" ? "invalid_caption" : "caption_submission_failed", { cause: error });
    const result = data.at(0); if (!result) throw new Error("caption_submission_failed"); return result;
}

export async function getPlayerPictureCaptionCandidates(playerId: string, partyCode: string): Promise<PictureCaptionCandidate[]> { const { data, error } = await createSupabaseAdminClient().rpc("player_picture_caption_candidates_projection", { p_player_id: playerId, p_party_code: partyCode }); if (error) throw new Error("player_projection_unavailable", { cause: error }); return data; }
export async function castPictureCaptionBallot(command: { playerId: string; partyCode: string; commandId: string; expectedRevision: number; candidateId: string }): Promise<LobbyCommandResult> { const { data, error } = await createSupabaseAdminClient().rpc("cast_picture_caption_ballot", { p_player_id: command.playerId, p_party_code: command.partyCode, p_command_id: command.commandId, p_expected_revision: command.expectedRevision, p_candidate_id: command.candidateId }); if (error) throw new Error(error.message === "ballot_already_cast" || error.message === "not_your_turn" || error.message === "turn_expired" || error.code === "40001" ? error.message : "ballot_failed", { cause: error }); const result = data.at(0); if (!result) throw new Error("ballot_failed"); return result; }
export async function getPlayerPictureCaptionResults(playerId: string, partyCode: string): Promise<PictureCaptionResult[]> { const { data, error } = await createSupabaseAdminClient().rpc("player_picture_caption_results_projection", { p_player_id: playerId, p_party_code: partyCode }); if (error) throw new Error("player_projection_unavailable", { cause: error }); return data; }

export async function getHostPartyLobby(hostId: string, partyId: string): Promise<PartyMemberProjection[]> {
    const { data, error } = await createSupabaseAdminClient().rpc("host_party_lobby_projection", { p_host_id: hostId, p_party_id: partyId });
    if (error) throw new Error("host_lobby_projection_unavailable", { cause: error });
    return data;
}

export async function getPartyLobbyStatus(partyCode: string) {
    const { data, error } = await createSupabaseAdminClient().rpc("party_lobby_status", { p_party_code: partyCode });
    if (error) throw new Error("party_status_unavailable", { cause: error });
    return data.at(0) ?? null;
}

export async function openPartyLobby(command: { hostId: string; partyId: string; commandId: string; expectedRevision: number }) {
    const { data, error } = await createSupabaseAdminClient().rpc("open_party_lobby", { p_host_id: command.hostId, p_party_id: command.partyId, p_command_id: command.commandId, p_expected_revision: command.expectedRevision });
    if (error) throw new Error(error.code === "40001" ? "stale_revision" : "lobby_open_failed", { cause: error });
    const result = data.at(0);
    if (!result) throw new Error("lobby_open_failed");
    return result;
}

export async function setPartyJoining(command: { hostId: string; partyId: string; commandId: string; expectedRevision: number; joiningOpen: boolean }) {
    const { data, error } = await createSupabaseAdminClient().rpc("set_party_joining", { p_host_id: command.hostId, p_party_id: command.partyId, p_command_id: command.commandId, p_expected_revision: command.expectedRevision, p_joining_open: command.joiningOpen });
    if (error) throw new Error(error.code === "40001" ? "stale_revision" : "admission_change_failed", { cause: error });
    const result = data.at(0);
    if (!result) throw new Error("admission_change_failed");
    return result;
}

export async function setPartyMemberAccess(command: { hostId: string; partyId: string; memberId: string; commandId: string; expectedRevision: number; accessStatus: "joined" | "removed" }) {
    const { data, error } = await createSupabaseAdminClient().rpc("set_party_member_access", { p_host_id: command.hostId, p_party_id: command.partyId, p_member_id: command.memberId, p_command_id: command.commandId, p_expected_revision: command.expectedRevision, p_access_status: command.accessStatus });
    if (error) throw new Error(error.code === "40001" ? "stale_revision" : "member_access_change_failed", { cause: error });
    const result = data.at(0);
    if (!result) throw new Error("member_access_change_failed");
    return result;
}

export async function rotatePartyCode(command: { hostId: string; partyId: string; commandId: string; expectedRevision: number }) {
    const { data, error } = await createSupabaseAdminClient().rpc("rotate_party_code", { p_host_id: command.hostId, p_party_id: command.partyId, p_command_id: command.commandId, p_expected_revision: command.expectedRevision });
    if (error) throw new Error(error.code === "40001" ? "stale_revision" : "party_code_rotation_failed", { cause: error });
    const result = data.at(0);
    if (!result) throw new Error("party_code_rotation_failed");
    return result;
}
