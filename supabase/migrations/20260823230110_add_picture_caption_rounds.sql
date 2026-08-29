create table public.picture_caption_rounds (
    id uuid primary key default gen_random_uuid(),
    game_session_id uuid not null references public.game_sessions(id) on delete cascade,
    template_id uuid references public.picture_caption_templates(id) on delete set null,
    position integer not null check (position >= 0),
    state text not null default 'pending' check (state in ('pending', 'active', 'completed')),
    phase text check (phase is null or phase in ('captioning', 'voting')),
    captioning_seconds integer not null default 120 check (captioning_seconds between 5 and 600),
    voting_seconds integer not null default 90 check (voting_seconds between 5 and 600),
    caption_grapheme_limit integer not null default 120 check (caption_grapheme_limit between 1 and 120),
    snapshot_template_revision bigint,
    snapshot_picture_url text,
    snapshot_prompt text,
    captioning_deadline timestamptz,
    paused_remaining_seconds integer check (paused_remaining_seconds is null or paused_remaining_seconds >= 0),
    created_at timestamptz not null default now(),
    unique (game_session_id, position)
);

alter table public.picture_caption_rounds enable row level security;
revoke all on table public.picture_caption_rounds from public, anon, authenticated;

create function public.remove_pending_rounds_for_deleted_template()
returns trigger language plpgsql security definer set search_path = ''
as $$ begin delete from public.picture_caption_rounds where template_id = old.id and state = 'pending'; return old; end; $$;

create trigger remove_pending_rounds_for_deleted_template
before delete on public.picture_caption_templates
for each row execute function public.remove_pending_rounds_for_deleted_template();

create function public.add_picture_caption_round(p_host_id uuid, p_party_id uuid, p_template_id uuid, p_command_id uuid, p_expected_revision bigint, p_captioning_seconds integer, p_voting_seconds integer, p_caption_grapheme_limit integer)
returns table (round_id uuid, game_session_id uuid, session_revision bigint)
language plpgsql security definer set search_path = ''
as $$
declare existing_response jsonb; session_record public.game_sessions; created_round public.picture_caption_rounds;
begin
    select response into existing_response from public.command_receipts where actor_id = p_host_id and command_id = p_command_id;
    if found then return query select (existing_response->>'roundId')::uuid, (existing_response->>'gameSessionId')::uuid, (existing_response->>'sessionRevision')::bigint; return; end if;
    select session.* into session_record from public.game_sessions as session join public.parties as party on party.current_game_session_id = session.id where party.id = p_party_id and party.host_id = p_host_id for update of session;
    if not found or session_record.revision <> p_expected_revision or (session_record.state = 'live' and exists (select 1 from public.picture_caption_rounds as round where round.game_session_id = session_record.id and round.state = 'active')) then raise exception using errcode = '40001', message = 'stale_revision'; end if;
    if not exists (select 1 from public.picture_caption_templates where id = p_template_id) then raise exception using errcode = 'P0002', message = 'template_not_found'; end if;
    insert into public.picture_caption_rounds (game_session_id, template_id, position, captioning_seconds, voting_seconds, caption_grapheme_limit)
    values (session_record.id, p_template_id, coalesce((select max(round.position) + 1 from public.picture_caption_rounds as round where round.game_session_id = session_record.id), 0), p_captioning_seconds, p_voting_seconds, p_caption_grapheme_limit)
    returning * into created_round;
    update public.game_sessions set revision = revision + 1 where id = session_record.id returning revision into session_record.revision;
    insert into public.command_receipts values (p_host_id, p_command_id, 'add_picture_caption_round', jsonb_build_object('roundId', created_round.id, 'gameSessionId', session_record.id, 'sessionRevision', session_record.revision));
    return query select created_round.id, session_record.id, session_record.revision;
end;
$$;

create function public.start_picture_caption_session(p_host_id uuid, p_party_id uuid, p_command_id uuid, p_expected_revision bigint)
returns table (round_id uuid, game_session_id uuid, session_revision bigint, captioning_deadline timestamptz)
language plpgsql security definer set search_path = ''
as $$
declare existing_response jsonb; session_record public.game_sessions; activated_round public.picture_caption_rounds;
begin
    select response into existing_response from public.command_receipts where actor_id = p_host_id and command_id = p_command_id;
    if found then return query select (existing_response->>'roundId')::uuid, (existing_response->>'gameSessionId')::uuid, (existing_response->>'sessionRevision')::bigint, (existing_response->>'captioningDeadline')::timestamptz; return; end if;
    select session.* into session_record from public.game_sessions as session join public.parties as party on party.current_game_session_id = session.id where party.id = p_party_id and party.host_id = p_host_id and session.state = 'lobby' for update of session;
    if not found or session_record.revision <> p_expected_revision then raise exception using errcode = '40001', message = 'stale_revision'; end if;
    if exists (select 1 from public.party_members as member where member.party_id = p_party_id and member.access_status = 'joined' and not member.ready) then raise exception using errcode = '40001', message = 'players_not_ready'; end if;
    update public.picture_caption_rounds as round
    set state = 'active', phase = 'captioning', snapshot_template_revision = template.revision, snapshot_picture_url = template.picture_url, snapshot_prompt = template.prompt, captioning_deadline = now() + make_interval(secs => round.captioning_seconds)
    from public.picture_caption_templates as template
    where round.id = (select id from public.picture_caption_rounds where game_session_id = session_record.id and state = 'pending' order by position limit 1 for update)
      and template.id = round.template_id
    returning round.* into activated_round;
    if not found then raise exception using errcode = '40001', message = 'no_pending_round'; end if;
    update public.game_sessions set state = 'live', joining_open = false, revision = revision + 1 where id = session_record.id returning revision into session_record.revision;
    insert into public.command_receipts values (p_host_id, p_command_id, 'start_picture_caption_session', jsonb_build_object('roundId', activated_round.id, 'gameSessionId', session_record.id, 'sessionRevision', session_record.revision, 'captioningDeadline', activated_round.captioning_deadline));
    return query select activated_round.id, session_record.id, session_record.revision, activated_round.captioning_deadline;
end;
$$;

revoke all on function public.add_picture_caption_round(uuid, uuid, uuid, uuid, bigint, integer, integer, integer) from public, anon, authenticated;
revoke all on function public.start_picture_caption_session(uuid, uuid, uuid, bigint) from public, anon, authenticated;
grant execute on function public.add_picture_caption_round(uuid, uuid, uuid, uuid, bigint, integer, integer, integer) to service_role;
grant execute on function public.start_picture_caption_session(uuid, uuid, uuid, bigint) to service_role;