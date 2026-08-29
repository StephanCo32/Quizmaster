create table public.display_sessions (
    id uuid primary key,
    party_id uuid not null references public.parties(id) on delete cascade,
    revoked_at timestamptz,
    created_at timestamptz not null default now()
);

create unique index display_sessions_one_active_party on public.display_sessions (party_id) where revoked_at is null;
alter table public.display_sessions enable row level security;
revoke all on table public.display_sessions from public, anon, authenticated;

drop function public.host_party_projection(uuid, uuid);
drop function public.host_parties_projection(uuid);

create function public.host_parties_projection(p_host_id uuid)
returns table (party_id uuid, party_code text, game_session_id uuid, game_session_state text, revision bigint, created_at timestamptz, display_active boolean)
language sql stable security definer set search_path = ''
as $$
    select party.id, party.code, game_session.id, game_session.state, game_session.revision, party.created_at,
           exists(select 1 from public.display_sessions as display_session where display_session.party_id = party.id and display_session.revoked_at is null)
    from public.parties as party
    join public.game_sessions as game_session on game_session.id = party.current_game_session_id
    where party.host_id = p_host_id
    order by party.created_at desc;
$$;

create function public.host_party_projection(p_host_id uuid, p_party_id uuid)
returns table (party_id uuid, party_code text, game_session_id uuid, game_session_state text, revision bigint, created_at timestamptz, display_active boolean)
language sql stable security definer set search_path = ''
as $$
    select projection.* from public.host_parties_projection(p_host_id) as projection where projection.party_id = p_party_id;
$$;

create function public.authorize_display_session(p_host_id uuid, p_party_id uuid, p_command_id uuid, p_display_session_id uuid)
returns table (party_code text, game_session_id uuid, session_revision bigint)
language plpgsql security definer set search_path = ''
as $$
declare existing_response jsonb; party_record public.parties; session_record public.game_sessions;
begin
    select response into existing_response from public.command_receipts where actor_id = p_host_id and command_id = p_command_id;
    if found then return query select existing_response->>'partyCode', (existing_response->>'gameSessionId')::uuid, (existing_response->>'sessionRevision')::bigint; return; end if;
    select party.* into party_record from public.parties as party where party.id = p_party_id and party.host_id = p_host_id for update;
    if not found then raise exception using errcode = 'P0002', message = 'party_not_found'; end if;
    update public.display_sessions set revoked_at = now() where party_id = party_record.id and revoked_at is null;
    insert into public.display_sessions (id, party_id) values (p_display_session_id, party_record.id);
    select session.* into session_record from public.game_sessions as session where session.id = party_record.current_game_session_id;
    insert into public.command_receipts (actor_id, command_id, command_name, response)
    values (p_host_id, p_command_id, 'authorize_display_session', jsonb_build_object('partyCode', party_record.code, 'gameSessionId', session_record.id, 'sessionRevision', session_record.revision));
    return query select party_record.code, session_record.id, session_record.revision;
end;
$$;

create function public.revoke_display_session(p_host_id uuid, p_party_id uuid)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare owned_party_id uuid;
begin
    select party.id into owned_party_id from public.parties as party where party.id = p_party_id and party.host_id = p_host_id for update;
    if not found then raise exception using errcode = 'P0002', message = 'party_not_found'; end if;
    update public.display_sessions set revoked_at = now() where party_id = owned_party_id and revoked_at is null;
    return found;
end;
$$;

create function public.display_party_projection(p_display_session_id uuid, p_party_code text)
returns table (party_code text, game_session_id uuid, game_session_state text, session_revision bigint)
language sql stable security definer set search_path = ''
as $$
    select party.code, game_session.id, game_session.state, game_session.revision
    from public.display_sessions as display_session
    join public.parties as party on party.id = display_session.party_id
    join public.game_sessions as game_session on game_session.id = party.current_game_session_id
    where display_session.id = p_display_session_id and display_session.revoked_at is null and party.code = upper(trim(p_party_code));
$$;

create function public.display_party_canonical_code(p_display_session_id uuid, p_party_code text)
returns text
language sql stable security definer set search_path = ''
as $$
        select party.code
        from public.display_sessions as display_session
        join public.parties as party on party.id = display_session.party_id
        left join public.party_code_history as prior_code on prior_code.party_id = party.id
        where display_session.id = p_display_session_id
            and display_session.revoked_at is null
            and (party.code = upper(trim(p_party_code)) or prior_code.code = upper(trim(p_party_code)))
        limit 1;
$$;

create function public.display_party_lobby_projection(p_display_session_id uuid, p_party_code text)
returns table (member_id uuid, nickname text, color text, score integer, ready boolean)
language sql stable security definer set search_path = ''
as $$
    select member.id, member.nickname, member.color, member.score, member.ready
    from public.party_members as member
    join public.parties as party on party.id = member.party_id
    join public.display_sessions as display_session on display_session.party_id = party.id
    where display_session.id = p_display_session_id and display_session.revoked_at is null and party.code = upper(trim(p_party_code)) and member.access_status = 'joined'
    order by member.created_at;
$$;

revoke all on function public.host_parties_projection(uuid) from public, anon, authenticated;
revoke all on function public.host_party_projection(uuid, uuid) from public, anon, authenticated;
revoke all on function public.authorize_display_session(uuid, uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.revoke_display_session(uuid, uuid) from public, anon, authenticated;
revoke all on function public.display_party_projection(uuid, text) from public, anon, authenticated;
revoke all on function public.display_party_canonical_code(uuid, text) from public, anon, authenticated;
revoke all on function public.display_party_lobby_projection(uuid, text) from public, anon, authenticated;
grant execute on function public.host_parties_projection(uuid) to service_role;
grant execute on function public.host_party_projection(uuid, uuid) to service_role;
grant execute on function public.authorize_display_session(uuid, uuid, uuid, uuid) to service_role;
grant execute on function public.revoke_display_session(uuid, uuid) to service_role;
grant execute on function public.display_party_projection(uuid, text) to service_role;
grant execute on function public.display_party_canonical_code(uuid, text) to service_role;
grant execute on function public.display_party_lobby_projection(uuid, text) to service_role;