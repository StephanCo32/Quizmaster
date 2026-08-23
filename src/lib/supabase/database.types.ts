export type PartyProjection = {
    party_id: string;
    party_code: string;
    game_session_id: string;
    game_session_state: "setup" | "lobby" | "live" | "finished";
    revision: number;
    created_at: string;
};

export type CreatePartyResult = {
    party_id: string;
    party_code: string;
    game_session_id: string;
    revision: number;
};

export type PictureCaptionTemplate = {
    template_id: string;
    name: string;
    picture_url: string;
    prompt: string | null;
    revision: number;
    created_at: string;
    updated_at: string;
};

export type PartyMemberProjection = {
    member_id: string;
    party_id: string;
    nickname: string;
    color: string;
    score: number;
    ready: boolean;
    access_status: "joined" | "removed";
};

export type Database = {
    public: {
        Tables: Record<string, never>;
        Views: Record<string, never>;
        Functions: {
            create_party: {
                Args: {
                    p_host_id: string;
                    p_command_id: string;
                    p_expected_revision: number;
                };
                Returns: CreatePartyResult[];
            };
            host_parties_projection: {
                Args: { p_host_id: string };
                Returns: PartyProjection[];
            };
            host_party_projection: {
                Args: { p_host_id: string; p_party_id: string };
                Returns: PartyProjection[];
            };
            ensure_content_admin: { Args: { p_user_id: string }; Returns: boolean };
            content_admin_check: { Args: { p_user_id: string }; Returns: boolean };
            create_picture_caption_template: {
                Args: { p_admin_id: string; p_command_id: string; p_name: string; p_picture_url: string; p_prompt: string | null };
                Returns: PictureCaptionTemplate[];
            };
            update_picture_caption_template: {
                Args: { p_admin_id: string; p_command_id: string; p_template_id: string; p_name: string; p_picture_url: string; p_prompt: string | null; p_expected_revision: number };
                Returns: PictureCaptionTemplate[];
            };
            delete_picture_caption_template: {
                Args: { p_admin_id: string; p_command_id: string; p_template_id: string; p_expected_revision: number };
                Returns: boolean;
            };
            picture_caption_templates_projection: { Args: { p_admin_id: string }; Returns: PictureCaptionTemplate[] };
            picture_caption_template_by_id: { Args: { p_template_id: string }; Returns: { template_id: string; picture_url: string }[] };
            open_party_lobby: { Args: { p_host_id: string; p_party_id: string; p_command_id: string; p_expected_revision: number }; Returns: boolean };
            join_party: { Args: { p_player_id: string; p_party_code: string; p_nickname: string; p_command_id: string }; Returns: PartyMemberProjection[] };
        };
        Enums: Record<string, never>;
        CompositeTypes: Record<string, never>;
    };
};