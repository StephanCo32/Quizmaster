import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { PictureCaptionTemplate } from "@/lib/supabase/database.types";

export async function listPictureCaptionTemplates(adminId: string) {
    const { data, error } = await createSupabaseAdminClient().rpc("picture_caption_templates_projection", { p_admin_id: adminId });
    if (error) throw new Error("template_list_failed", { cause: error });
    return data as PictureCaptionTemplate[];
}

export async function createPictureCaptionTemplate(command: { adminId: string; commandId: string; name: string; pictureUrl: string; officialCaption: string }) {
    const { data, error } = await createSupabaseAdminClient().rpc("create_picture_caption_template", {
        p_admin_id: command.adminId, p_command_id: command.commandId, p_name: command.name, p_picture_url: command.pictureUrl, p_official_caption: command.officialCaption,
    });
    if (error) throw new Error(error.message === "official_caption_required" ? "official_caption_required" : error.code === "42501" ? "not_content_admin" : "template_create_failed", { cause: error });
    const result = data.at(0);
    if (!result) throw new Error("template_create_failed");
    return result;
}

export async function updatePictureCaptionTemplate(command: { adminId: string; commandId: string; templateId: string; name: string; pictureUrl: string; officialCaption: string; expectedRevision: number }) {
    const { data, error } = await createSupabaseAdminClient().rpc("update_picture_caption_template", {
        p_admin_id: command.adminId, p_command_id: command.commandId, p_template_id: command.templateId, p_name: command.name, p_picture_url: command.pictureUrl, p_official_caption: command.officialCaption, p_expected_revision: command.expectedRevision,
    });
    if (error) throw new Error(error.message === "official_caption_required" ? "official_caption_required" : error.code === "40001" ? "stale_revision" : error.message === "template_not_found" ? "template_not_found" : "template_update_failed", { cause: error });
    const result = data.at(0);
    if (!result) throw new Error("template_update_failed");
    return result;
}

export async function deletePictureCaptionTemplate(command: { adminId: string; commandId: string; templateId: string; expectedRevision: number }) {
    const { data, error } = await createSupabaseAdminClient().rpc("delete_picture_caption_template", {
        p_admin_id: command.adminId, p_command_id: command.commandId, p_template_id: command.templateId, p_expected_revision: command.expectedRevision,
    });
    if (error) throw new Error(error.code === "40001" ? "stale_revision" : "template_delete_failed", { cause: error });
    return data;
}

export async function getPictureCaptionTemplateSource(templateId: string) {
    const { data, error } = await createSupabaseAdminClient().rpc("picture_caption_template_by_id", { p_template_id: templateId });
    if (error) throw new Error("template_source_failed", { cause: error });
    return data.at(0) ?? null;
}

export async function listContentAdminIds(adminId: string) {
    const { data, error } = await createSupabaseAdminClient().rpc("content_admin_roles_projection", { p_admin_id: adminId });
    if (error) throw new Error("content_admin_list_failed", { cause: error });
    return data.map((role) => role.user_id);
}

export async function grantContentAdmin(actorId: string, targetId: string) {
    const { error } = await createSupabaseAdminClient().rpc("grant_content_admin", { p_actor_id: actorId, p_target_id: targetId });
    if (error) throw new Error(error.message === "not_content_admin" ? "not_content_admin" : "content_admin_grant_failed", { cause: error });
}

export async function revokeContentAdmin(actorId: string, targetId: string) {
    const { error } = await createSupabaseAdminClient().rpc("revoke_content_admin", { p_actor_id: actorId, p_target_id: targetId });
    if (error) throw new Error(error.message === "final_content_admin" ? "final_content_admin" : error.message === "not_content_admin" ? "not_content_admin" : "content_admin_revoke_failed", { cause: error });
}