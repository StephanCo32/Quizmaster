export type PartyProjection = {
    party_id: string;
    party_code: string;
    game_session_id: string;
    game_session_state: "setup" | "lobby" | "live" | "finished";
    revision: number;
    created_at: string;
    display_active: boolean;
};

export type DisplayPartyProjection = {
    party_code: string;
    game_session_id: string;
    game_session_state: "setup" | "lobby" | "live" | "finished";
    session_revision: number;
};

export type DisplayMemberProjection = {
    member_id: string;
    nickname: string;
    color: string;
    score: number;
    ready: boolean;
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
    official_caption: string | null;
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
    game_session_id: string;
    party_code?: string;
    session_state?: "setup" | "lobby" | "live" | "finished";
    joining_open?: boolean;
    session_revision: number;
};

export type LobbyCommandResult = {
    game_session_id: string;
    session_revision: number;
};

export type PictureCaptionRound = {
    round_id: string;
    round_position: number;
    state: "pending" | "active" | "completed";
    template_id: string | null;
    name: string | null;
    picture_url: string | null;
    official_caption: string | null;
    captioning_seconds: number;
    voting_seconds: number;
    caption_grapheme_limit: number;
    phase: "captioning" | "voting" | "revealing" | "results" | null;
    captioning_deadline: string | null;
    paused_remaining_seconds: number | null;
    game_session_id: string;
    session_revision: number;
};

export type ActivePictureCaptionRound = {
    round_id: string;
    official_caption: string | null;
    phase: "captioning" | "voting" | "revealing" | "results" | null;
    captioning_deadline: string | null;
    paused_remaining_seconds: number | null;
    caption_grapheme_limit: number;
    game_session_id: string;
    session_revision: number;
};

export type HostPictureCaptionTemplate = Pick<PictureCaptionTemplate, "template_id" | "name" | "official_caption" | "revision">;

export type PictureCaptionSubmission = {
    submission_id: string;
    member_id: string;
    nickname: string;
    caption: string;
    submitted_at: string;
    updated_at: string;
    game_session_id: string;
    session_revision: number;
};

export type PictureCaptionCompletion = {
    eligible_count: number;
    submission_count: number;
    game_session_id: string;
    session_revision: number;
};

export type PictureCaptionCandidate = {
    candidate_id: string;
    caption: string;
    display_position: number;
    is_own: boolean;
    own_color: string;
    has_voted: boolean;
    game_session_id: string;
    session_revision: number;
};

export type DisplayPictureCaptionCandidate = Omit<PictureCaptionCandidate, "is_own" | "own_color" | "has_voted">;
export type HostPictureCaptionBallot = { candidate_id: string; caption: string; display_position: number; points: number; voter_nickname: string | null; game_session_id: string; session_revision: number };
export type PictureCaptionResult = { caption: string; points: number; is_leader: boolean; author_nickname: string; author_color: string; game_session_id: string; session_revision: number };

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
            authorize_display_session: { Args: { p_host_id: string; p_party_id: string; p_command_id: string; p_display_session_id: string }; Returns: { party_code: string; game_session_id: string; session_revision: number }[] };
            revoke_display_session: { Args: { p_host_id: string; p_party_id: string }; Returns: boolean };
            display_party_projection: { Args: { p_display_session_id: string; p_party_code: string }; Returns: DisplayPartyProjection[] };
            display_party_canonical_code: { Args: { p_display_session_id: string; p_party_code: string }; Returns: string };
            display_party_lobby_projection: { Args: { p_display_session_id: string; p_party_code: string }; Returns: DisplayMemberProjection[] };
            ensure_content_admin: { Args: { p_user_id: string }; Returns: boolean };
            content_admin_check: { Args: { p_user_id: string }; Returns: boolean };
            grant_content_admin: { Args: { p_actor_id: string; p_target_id: string }; Returns: boolean };
            revoke_content_admin: { Args: { p_actor_id: string; p_target_id: string }; Returns: boolean };
            content_admin_roles_projection: { Args: { p_admin_id: string }; Returns: { user_id: string }[] };
            create_picture_caption_template: {
                Args: { p_admin_id: string; p_command_id: string; p_name: string; p_picture_url: string; p_official_caption: string | null };
                Returns: PictureCaptionTemplate[];
            };
            update_picture_caption_template: {
                Args: { p_admin_id: string; p_command_id: string; p_template_id: string; p_name: string; p_picture_url: string; p_official_caption: string | null; p_expected_revision: number };
                Returns: PictureCaptionTemplate[];
            };
            delete_picture_caption_template: {
                Args: { p_admin_id: string; p_command_id: string; p_template_id: string; p_expected_revision: number };
                Returns: boolean;
            };
            picture_caption_templates_projection: { Args: { p_admin_id: string }; Returns: PictureCaptionTemplate[] };
            picture_caption_template_by_id: { Args: { p_template_id: string }; Returns: { template_id: string; picture_url: string }[] };
            open_party_lobby: { Args: { p_host_id: string; p_party_id: string; p_command_id: string; p_expected_revision: number }; Returns: LobbyCommandResult[] };
            set_party_joining: { Args: { p_host_id: string; p_party_id: string; p_command_id: string; p_expected_revision: number; p_joining_open: boolean }; Returns: LobbyCommandResult[] };
            set_party_member_access: { Args: { p_host_id: string; p_party_id: string; p_member_id: string; p_command_id: string; p_expected_revision: number; p_access_status: string }; Returns: LobbyCommandResult[] };
            rotate_party_code: { Args: { p_host_id: string; p_party_id: string; p_command_id: string; p_expected_revision: number }; Returns: (LobbyCommandResult & { party_code: string })[] };
            player_party_canonical_code: { Args: { p_player_id: string; p_party_code: string }; Returns: string };
            join_party: { Args: { p_player_id: string; p_party_code: string; p_nickname: string; p_command_id: string; p_expected_revision: number }; Returns: PartyMemberProjection[] };
            change_party_member_nickname: { Args: { p_player_id: string; p_member_id: string; p_command_id: string; p_nickname: string; p_expected_revision: number }; Returns: PartyMemberProjection[] };
            set_party_member_ready: { Args: { p_player_id: string; p_member_id: string; p_command_id: string; p_ready: boolean; p_expected_revision: number }; Returns: PartyMemberProjection[] };
            player_party_lobby_projection: { Args: { p_player_id: string; p_party_code: string }; Returns: PartyMemberProjection[] };
            host_party_lobby_projection: { Args: { p_host_id: string; p_party_id: string }; Returns: PartyMemberProjection[] };
            party_lobby_status: { Args: { p_party_code: string }; Returns: { party_code: string; session_state: string; joining_open: boolean; session_revision: number }[] };
            host_picture_caption_rounds_projection: { Args: { p_host_id: string; p_party_id: string }; Returns: PictureCaptionRound[] };
            host_picture_caption_template_catalog: { Args: { p_host_id: string; p_party_id: string }; Returns: HostPictureCaptionTemplate[] };
            mutate_picture_caption_round: { Args: { p_host_id: string; p_party_id: string; p_round_id: string | null; p_command_id: string; p_expected_revision: number; p_action: string; p_template_id: string | null; p_position: number | null; p_captioning_seconds: number | null; p_voting_seconds: number | null; p_caption_grapheme_limit: number | null }; Returns: LobbyCommandResult[] };
            start_picture_caption_session: { Args: { p_host_id: string; p_party_id: string; p_command_id: string; p_expected_revision: number }; Returns: (LobbyCommandResult & { round_id: string; captioning_deadline: string })[] };
            set_picture_caption_paused: { Args: { p_host_id: string; p_party_id: string; p_command_id: string; p_expected_revision: number; p_paused: boolean }; Returns: LobbyCommandResult[] };
            player_picture_caption_round_projection: { Args: { p_player_id: string; p_party_code: string }; Returns: ActivePictureCaptionRound[] };
            display_picture_caption_round_projection: { Args: { p_display_session_id: string; p_party_code: string }; Returns: ActivePictureCaptionRound[] };
            host_picture_caption_round_picture: { Args: { p_host_id: string; p_party_id: string; p_round_id: string }; Returns: string | null };
            player_picture_caption_round_picture: { Args: { p_player_id: string; p_party_code: string; p_round_id: string }; Returns: string | null };
            display_picture_caption_round_picture: { Args: { p_display_session_id: string; p_party_code: string; p_round_id: string }; Returns: string | null };
            submit_picture_caption: { Args: { p_player_id: string; p_party_code: string; p_command_id: string; p_expected_revision: number; p_caption: string }; Returns: LobbyCommandResult[] };
            player_picture_caption_submission_projection: { Args: { p_player_id: string; p_party_code: string }; Returns: { caption: string; submitted_at: string; updated_at: string; game_session_id: string; session_revision: number }[] };
            host_picture_caption_submissions_projection: { Args: { p_host_id: string; p_party_id: string }; Returns: PictureCaptionSubmission[] };
            remove_picture_caption_submission: { Args: { p_host_id: string; p_party_id: string; p_submission_id: string; p_command_id: string; p_expected_revision: number }; Returns: LobbyCommandResult[] };
            host_picture_caption_completion_projection: { Args: { p_host_id: string; p_party_id: string }; Returns: PictureCaptionCompletion[] };
            display_picture_caption_completion_projection: { Args: { p_display_session_id: string; p_party_code: string }; Returns: PictureCaptionCompletion[] };
            close_picture_captioning: { Args: { p_host_id: string; p_party_id: string; p_command_id: string; p_expected_revision: number; p_confirm_missing: boolean }; Returns: LobbyCommandResult[] };
            player_picture_caption_candidates_projection: { Args: { p_player_id: string; p_party_code: string }; Returns: PictureCaptionCandidate[] };
            cast_picture_caption_ballot: { Args: { p_player_id: string; p_party_code: string; p_command_id: string; p_expected_revision: number; p_candidate_id: string }; Returns: LobbyCommandResult[] };
            host_picture_caption_ballots_projection: { Args: { p_host_id: string; p_party_id: string }; Returns: HostPictureCaptionBallot[] };
            display_picture_caption_candidates_projection: { Args: { p_display_session_id: string; p_party_code: string }; Returns: DisplayPictureCaptionCandidate[] };
            close_picture_caption_voting: { Args: { p_host_id: string; p_party_id: string; p_command_id: string; p_expected_revision: number; p_confirm_missing: boolean }; Returns: LobbyCommandResult[] };
            start_picture_caption_reveal: { Args: { p_host_id: string; p_party_id: string; p_command_id: string; p_expected_revision: number }; Returns: LobbyCommandResult[] };
            continue_picture_caption_round: { Args: { p_host_id: string; p_party_id: string; p_command_id: string; p_expected_revision: number }; Returns: LobbyCommandResult[] };
            resolve_picture_caption_deadline: { Args: { p_game_session_id: string }; Returns: undefined };
            resolve_picture_caption_reveal: { Args: { p_game_session_id: string }; Returns: undefined };
            player_picture_caption_results_projection: { Args: { p_player_id: string; p_party_code: string }; Returns: PictureCaptionResult[] };
            display_picture_caption_results_projection: { Args: { p_display_session_id: string; p_party_code: string }; Returns: PictureCaptionResult[] };
            finish_game_session: { Args: { p_host_id: string; p_party_id: string; p_command_id: string; p_expected_revision: number }; Returns: LobbyCommandResult[] };
            close_party: { Args: { p_host_id: string; p_party_id: string; p_command_id: string; p_expected_revision: number }; Returns: LobbyCommandResult[] };
            adjust_party_score: { Args: { p_host_id: string; p_party_id: string; p_member_id: string; p_command_id: string; p_expected_revision: number; p_delta: number }; Returns: LobbyCommandResult[] };
            create_successor_game_session: { Args: { p_host_id: string; p_party_id: string; p_command_id: string; p_expected_revision: number }; Returns: LobbyCommandResult[] };
            delete_party: { Args: { p_host_id: string; p_party_id: string; p_command_id: string; p_expected_revision: number }; Returns: boolean };
        };
        Enums: Record<string, never>;
        CompositeTypes: Record<string, never>;
    };
};