import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { HostPictureCaptionBallot, HostPictureCaptionTemplate, LobbyCommandResult, PictureCaptionCompletion, PictureCaptionRound, PictureCaptionSubmission } from "@/lib/supabase/database.types";

export async function getHostPictureCaptionRounds(hostId: string, partyId: string): Promise<PictureCaptionRound[]> {
    const { data, error } = await createSupabaseAdminClient().rpc("host_picture_caption_rounds_projection", { p_host_id: hostId, p_party_id: partyId });
    if (error) throw new Error("round_projection_unavailable", { cause: error });
    return data;
}

export async function getHostPictureCaptionTemplates(hostId: string, partyId: string): Promise<HostPictureCaptionTemplate[]> {
    const { data, error } = await createSupabaseAdminClient().rpc("host_picture_caption_template_catalog", { p_host_id: hostId, p_party_id: partyId });
    if (error) throw new Error("template_projection_unavailable", { cause: error });
    return data;
}

export async function mutatePictureCaptionRound(command: { hostId: string; partyId: string; roundId: string | null; commandId: string; expectedRevision: number; action: string; templateId?: string; position?: number; captioningSeconds?: number; votingSeconds?: number; captionGraphemeLimit?: number }): Promise<LobbyCommandResult> {
    const { data, error } = await createSupabaseAdminClient().rpc("mutate_picture_caption_round", { p_host_id: command.hostId, p_party_id: command.partyId, p_round_id: command.roundId, p_command_id: command.commandId, p_expected_revision: command.expectedRevision, p_action: command.action, p_template_id: command.templateId ?? null, p_position: command.position ?? null, p_captioning_seconds: command.captioningSeconds ?? null, p_voting_seconds: command.votingSeconds ?? null, p_caption_grapheme_limit: command.captionGraphemeLimit ?? null });
    if (error) throw new Error(error.message === "official_caption_required" ? "official_caption_required" : error.message === "stale_revision" || error.code === "40001" ? "stale_revision" : "round_mutation_failed", { cause: error });
    const result = data.at(0);
    if (!result) throw new Error("round_mutation_failed");
    return result;
}

export async function startPictureCaptionSession(command: { hostId: string; partyId: string; commandId: string; expectedRevision: number }) {
    const { data, error } = await createSupabaseAdminClient().rpc("start_picture_caption_session", { p_host_id: command.hostId, p_party_id: command.partyId, p_command_id: command.commandId, p_expected_revision: command.expectedRevision });
    if (error) throw new Error(error.message === "players_not_ready" || error.message === "no_pending_round" || error.code === "40001" ? error.message : "session_start_failed", { cause: error });
    const result = data.at(0);
    if (!result) throw new Error("session_start_failed");
    return result;
}

export async function setPictureCaptionPaused(command: { hostId: string; partyId: string; commandId: string; expectedRevision: number; paused: boolean }): Promise<LobbyCommandResult> {
    const { data, error } = await createSupabaseAdminClient().rpc("set_picture_caption_paused", { p_host_id: command.hostId, p_party_id: command.partyId, p_command_id: command.commandId, p_expected_revision: command.expectedRevision, p_paused: command.paused });
    if (error) throw new Error(error.code === "40001" ? "stale_revision" : "pause_failed", { cause: error });
    const result = data.at(0);
    if (!result) throw new Error("pause_failed");
    return result;
}

export async function getHostPictureCaptionSubmissions(hostId: string, partyId: string): Promise<PictureCaptionSubmission[]> { const { data, error } = await createSupabaseAdminClient().rpc("host_picture_caption_submissions_projection", { p_host_id: hostId, p_party_id: partyId }); if (error) throw new Error("caption_projection_unavailable", { cause: error }); return data; }
export async function getHostPictureCaptionCompletion(hostId: string, partyId: string): Promise<PictureCaptionCompletion | null> { const { data, error } = await createSupabaseAdminClient().rpc("host_picture_caption_completion_projection", { p_host_id: hostId, p_party_id: partyId }); if (error) throw new Error("caption_projection_unavailable", { cause: error }); return data.at(0) ?? null; }
export async function removePictureCaptionSubmission(command: { hostId: string; partyId: string; submissionId: string; commandId: string; expectedRevision: number }): Promise<LobbyCommandResult> { const { data, error } = await createSupabaseAdminClient().rpc("remove_picture_caption_submission", { p_host_id: command.hostId, p_party_id: command.partyId, p_submission_id: command.submissionId, p_command_id: command.commandId, p_expected_revision: command.expectedRevision }); if (error) throw new Error(error.code === "40001" ? "stale_revision" : "caption_removal_failed", { cause: error }); const result = data.at(0); if (!result) throw new Error("caption_removal_failed"); return result; }
export async function closePictureCaptioning(command: { hostId: string; partyId: string; commandId: string; expectedRevision: number; confirmMissing: boolean }): Promise<LobbyCommandResult> { const { data, error } = await createSupabaseAdminClient().rpc("close_picture_captioning", { p_host_id: command.hostId, p_party_id: command.partyId, p_command_id: command.commandId, p_expected_revision: command.expectedRevision, p_confirm_missing: command.confirmMissing }); if (error) throw new Error(error.code === "40001" || error.message === "close_confirmation_required" ? error.message : "caption_close_failed", { cause: error }); const result = data.at(0); if (!result) throw new Error("caption_close_failed"); return result; }
export async function getHostPictureCaptionBallots(hostId: string, partyId: string): Promise<HostPictureCaptionBallot[]> { const { data, error } = await createSupabaseAdminClient().rpc("host_picture_caption_ballots_projection", { p_host_id: hostId, p_party_id: partyId }); if (error) throw new Error("ballot_projection_unavailable", { cause: error }); return data; }
export async function closePictureCaptionVoting(command: { hostId: string; partyId: string; commandId: string; expectedRevision: number; confirmMissing: boolean }): Promise<LobbyCommandResult> { const { data, error } = await createSupabaseAdminClient().rpc("close_picture_caption_voting", { p_host_id: command.hostId, p_party_id: command.partyId, p_command_id: command.commandId, p_expected_revision: command.expectedRevision, p_confirm_missing: command.confirmMissing }); if (error) throw new Error(error.message === "close_confirmation_required" || error.code === "40001" ? error.message : "voting_close_failed", { cause: error }); const result = data.at(0); if (!result) throw new Error("voting_close_failed"); return result; }
async function mutatePictureCaptionResult(command: { hostId: string; partyId: string; commandId: string; expectedRevision: number }, rpc: "start_picture_caption_reveal" | "continue_picture_caption_round"): Promise<LobbyCommandResult> { const { data, error } = await createSupabaseAdminClient().rpc(rpc, { p_host_id: command.hostId, p_party_id: command.partyId, p_command_id: command.commandId, p_expected_revision: command.expectedRevision }); if (error) throw new Error(error.code === "40001" ? error.message : "result_mutation_failed", { cause: error }); const result = data.at(0); if (!result) throw new Error("result_mutation_failed"); return result; }
export const startPictureCaptionReveal = (command: { hostId: string; partyId: string; commandId: string; expectedRevision: number }) => mutatePictureCaptionResult(command, "start_picture_caption_reveal");
export const continuePictureCaptionRound = (command: { hostId: string; partyId: string; commandId: string; expectedRevision: number }) => mutatePictureCaptionResult(command, "continue_picture_caption_round");