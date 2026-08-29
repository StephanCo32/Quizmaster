create table public.picture_caption_submissions (
    id uuid primary key default gen_random_uuid(),
    round_id uuid not null references public.picture_caption_rounds(id) on delete cascade,
    party_member_id uuid not null references public.party_members(id) on delete restrict,
    caption text not null,
    submitted_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (round_id, party_member_id)
);

create table public.picture_caption_moderation_audits (
    id uuid primary key default gen_random_uuid(),
    round_id uuid not null references public.picture_caption_rounds(id) on delete cascade,
    party_member_id uuid not null references public.party_members(id) on delete restrict,
    caption text not null,
    removed_by_host_id uuid not null references auth.users(id) on delete restrict,
    removed_at timestamptz not null default now()
);

alter table public.picture_caption_submissions enable row level security;
alter table public.picture_caption_moderation_audits enable row level security;
revoke all on table public.picture_caption_submissions, public.picture_caption_moderation_audits from public, anon, authenticated;

create function public.normalize_picture_caption(p_caption text, p_limit integer)
returns text language plpgsql immutable set search_path='' as $$
declare normalized text; line_count integer; grapheme_approximation integer;
begin
 normalized := btrim(replace(p_caption, E'\r\n', E'\n'));
 line_count := 1 + length(normalized) - length(replace(normalized, E'\n', ''));
 -- PostgreSQL has no Unicode grapheme primitive; combining marks, joiners, and selectors do not consume the configured limit.
 grapheme_approximation := length(regexp_replace(normalized, '[\u0300-\u036f\u200d\ufe00-\ufe0f]', '', 'g'));
 if normalized = '' or line_count > 3 or grapheme_approximation > p_limit then raise exception using errcode='22023', message='invalid_caption'; end if;
 return normalized;
end; $$;

create function public.submit_picture_caption(p_player_id uuid,p_party_code text,p_command_id uuid,p_expected_revision bigint,p_caption text)
returns table (game_session_id uuid, session_revision bigint)
language plpgsql security definer set search_path='' as $$
declare existing jsonb; session_record public.game_sessions; active_round public.picture_caption_rounds; member_id uuid; normalized text; next_revision bigint;
begin
 select response into existing from public.command_receipts where actor_id=p_player_id and command_id=p_command_id;
 if found then return query select (existing->>'gameSessionId')::uuid,(existing->>'sessionRevision')::bigint; return; end if;
 select session.* into session_record from public.parties party join public.game_sessions session on session.id=party.current_game_session_id where party.code=upper(trim(p_party_code)) and session.revision=p_expected_revision for update of session;
 if not found then raise exception using errcode='40001',message='stale_revision'; end if;
 select round.* into active_round from public.picture_caption_rounds round where round.game_session_id=session_record.id and round.state='active' and round.phase='captioning' and round.captioning_deadline is not null and round.captioning_deadline>now() for update;
 if not found then raise exception using errcode='40001',message='captioning_closed'; end if;
 select member.id into member_id from public.party_members member join public.picture_caption_round_members eligible on eligible.party_member_id=member.id and eligible.round_id=active_round.id where member.player_id=p_player_id and member.party_id=(select party.id from public.parties party where party.code=upper(trim(p_party_code))) and member.access_status='joined';
 if not found then raise exception using errcode='P0002',message='eligible_member_not_found'; end if;
 normalized := public.normalize_picture_caption(p_caption, active_round.caption_grapheme_limit);
 insert into public.picture_caption_submissions(round_id,party_member_id,caption) values(active_round.id,member_id,normalized) on conflict(round_id,party_member_id) do update set caption=excluded.caption,updated_at=now();
 update public.game_sessions set revision=revision+1 where id=session_record.id returning revision into next_revision;
 insert into public.command_receipts values(p_player_id,p_command_id,'submit_picture_caption',jsonb_build_object('gameSessionId',session_record.id,'sessionRevision',next_revision));
 return query select session_record.id,next_revision;
end; $$;

create function public.player_picture_caption_submission_projection(p_player_id uuid,p_party_code text)
returns table (caption text,submitted_at timestamptz,updated_at timestamptz,game_session_id uuid,session_revision bigint)
language sql stable security definer set search_path='' as $$
 select submission.caption,submission.submitted_at,submission.updated_at,session.id,session.revision from public.parties party join public.game_sessions session on session.id=party.current_game_session_id join public.picture_caption_rounds round on round.game_session_id=session.id and round.state='active' join public.party_members member on member.party_id=party.id and member.player_id=p_player_id and member.access_status='joined' join public.picture_caption_submissions submission on submission.round_id=round.id and submission.party_member_id=member.id where party.code=upper(trim(p_party_code));
$$;

revoke all on function public.normalize_picture_caption(text,integer),public.submit_picture_caption(uuid,text,uuid,bigint,text),public.player_picture_caption_submission_projection(uuid,text) from public,anon,authenticated;
grant execute on function public.submit_picture_caption(uuid,text,uuid,bigint,text),public.player_picture_caption_submission_projection(uuid,text) to service_role;