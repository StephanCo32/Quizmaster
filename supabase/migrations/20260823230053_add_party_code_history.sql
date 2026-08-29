create table public.party_code_history (
    code text primary key check (code ~ '^[A-Z0-9]{6}$'),
    party_id uuid not null references public.parties(id) on delete cascade,
    created_at timestamptz not null default now()
);

alter table public.party_code_history enable row level security;
revoke all on table public.party_code_history from public, anon, authenticated;

create or replace function public.rotate_party_code(p_host_id uuid, p_party_id uuid, p_command_id uuid, p_expected_revision bigint)
returns table (party_code text, game_session_id uuid, session_revision bigint)
language plpgsql security definer set search_path = ''
as $$
declare existing_response jsonb; next_code text; previous_code text; session_id uuid; next_revision bigint; attempts integer := 0;
begin
    select receipt.response into existing_response from public.command_receipts as receipt where receipt.actor_id = p_host_id and receipt.command_id = p_command_id;
    if found then return query select existing_response->>'partyCode', (existing_response->>'gameSessionId')::uuid, (existing_response->>'sessionRevision')::bigint; return; end if;
    loop
        next_code := upper(substr(encode(extensions.gen_random_bytes(4), 'hex'), 1, 6));
        exit when not exists (select 1 from public.parties where code = next_code)
          and not exists (select 1 from public.party_code_history where code = next_code);
        attempts := attempts + 1;
        if attempts = 10 then raise exception using errcode = 'P0001', message = 'party_code_unavailable'; end if;
    end loop;
    select party.code into previous_code from public.parties as party where party.id = p_party_id;
    update public.parties as party set code = next_code
    from public.game_sessions as session where party.id = p_party_id and party.host_id = p_host_id and session.id = party.current_game_session_id and session.revision = p_expected_revision
    returning session.id into session_id;
    if not found then raise exception using errcode = '40001', message = 'stale_revision'; end if;
    insert into public.party_code_history (code, party_id) values (previous_code, p_party_id);
    update public.game_sessions set revision = revision + 1 where id = session_id returning revision into next_revision;
    insert into public.command_receipts values (p_host_id, p_command_id, 'rotate_party_code', jsonb_build_object('partyCode', next_code, 'gameSessionId', session_id, 'sessionRevision', next_revision));
    return query select next_code, session_id, next_revision;
end;
$$;

create or replace function public.player_party_canonical_code(p_player_id uuid, p_party_code text)
returns text
language sql stable security definer set search_path = ''
as $$
    select party.code
    from public.party_members as member
    join public.parties as party on party.id = member.party_id
    left join public.party_code_history as prior_code on prior_code.party_id = party.id
    where member.player_id = p_player_id
      and member.access_status = 'joined'
      and (party.code = upper(trim(p_party_code)) or prior_code.code = upper(trim(p_party_code)))
    limit 1;
$$;

create or replace function public.host_party_lobby_projection(p_host_id uuid, p_party_id uuid)
returns table (member_id uuid, party_id uuid, nickname text, color text, score integer, ready boolean, access_status text, party_code text, session_state text, joining_open boolean, game_session_id uuid, session_revision bigint)
language sql stable security definer set search_path = ''
as $$
    select member.id, member.party_id, member.nickname, member.color, member.score, member.ready, member.access_status, party.code, session.state, session.joining_open, session.id, session.revision
    from public.parties as party
    join public.game_sessions as session on session.id = party.current_game_session_id
    left join public.party_members as member on member.party_id = party.id
    where party.host_id = p_host_id and party.id = p_party_id;
$$;

revoke all on function public.rotate_party_code(uuid, uuid, uuid, bigint) from public, anon, authenticated;
revoke all on function public.player_party_canonical_code(uuid, text) from public, anon, authenticated;
revoke all on function public.host_party_lobby_projection(uuid, uuid) from public, anon, authenticated;
grant execute on function public.rotate_party_code(uuid, uuid, uuid, bigint) to service_role;
grant execute on function public.player_party_canonical_code(uuid, text) to service_role;
grant execute on function public.host_party_lobby_projection(uuid, uuid) to service_role;