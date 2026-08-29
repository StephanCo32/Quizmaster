drop function if exists public.open_party_lobby(uuid, uuid, uuid, bigint);
drop function if exists public.join_party(uuid, text, text, uuid, bigint);
drop function if exists public.change_party_member_nickname(uuid, uuid, uuid, text, bigint);
drop function if exists public.set_party_member_ready(uuid, uuid, uuid, boolean, bigint);
drop function if exists public.player_party_lobby_projection(uuid, text);
drop function if exists public.host_party_lobby_projection(uuid, uuid);

create function public.open_party_lobby(p_host_id uuid, p_party_id uuid, p_command_id uuid, p_expected_revision bigint)
returns table (game_session_id uuid, session_revision bigint)
language plpgsql security definer set search_path = ''
as $$
declare existing_response jsonb; session_id uuid; next_revision bigint;
begin
    select receipt.response into existing_response from public.command_receipts as receipt where receipt.actor_id = p_host_id and receipt.command_id = p_command_id;
    if found then return query select (existing_response->>'gameSessionId')::uuid, (existing_response->>'sessionRevision')::bigint; return; end if;
    update public.game_sessions as session set state = 'lobby', joining_open = true, revision = session.revision + 1
    from public.parties as party
    where session.id = party.current_game_session_id and party.id = p_party_id and party.host_id = p_host_id and session.state = 'setup' and session.revision = p_expected_revision
    returning session.id, session.revision into session_id, next_revision;
    if not found then raise exception using errcode = '40001', message = 'stale_revision'; end if;
    insert into public.command_receipts (actor_id, command_id, command_name, response)
    values (p_host_id, p_command_id, 'open_party_lobby', jsonb_build_object('gameSessionId', session_id, 'sessionRevision', next_revision));
    return query select session_id, next_revision;
end;
$$;

create function public.join_party(p_player_id uuid, p_party_code text, p_nickname text, p_command_id uuid, p_expected_revision bigint)
returns table (member_id uuid, party_id uuid, nickname text, color text, score integer, ready boolean, access_status text, party_code text, session_state text, joining_open boolean, game_session_id uuid, session_revision bigint)
language plpgsql security definer set search_path = ''
as $$
declare existing_response jsonb; member public.party_members; party_record public.parties; session_record public.game_sessions; command_response jsonb; is_new boolean := false;
begin
    select receipt.response into existing_response from public.command_receipts as receipt where receipt.actor_id = p_player_id and receipt.command_id = p_command_id;
    if found then return query select (existing_response->>'memberId')::uuid, (existing_response->>'partyId')::uuid, existing_response->>'nickname', existing_response->>'color', (existing_response->>'score')::integer, (existing_response->>'ready')::boolean, existing_response->>'accessStatus', existing_response->>'partyCode', existing_response->>'sessionState', (existing_response->>'joiningOpen')::boolean, (existing_response->>'gameSessionId')::uuid, (existing_response->>'sessionRevision')::bigint; return; end if;
    select party.* into party_record from public.parties as party where party.code = upper(trim(p_party_code));
    if not found then raise exception using errcode = 'P0002', message = 'party_not_found'; end if;
    select session.* into session_record from public.game_sessions as session where session.id = party_record.current_game_session_id for update;
    if session_record.revision <> p_expected_revision then raise exception using errcode = '40001', message = 'stale_revision'; end if;
    select party_member.* into member from public.party_members as party_member where party_member.party_id = party_record.id and party_member.player_id = p_player_id;
    if found then
        if member.access_status = 'removed' then raise exception using errcode = '42501', message = 'player_removed'; end if;
    elsif session_record.state <> 'lobby' or not session_record.joining_open then
        raise exception using errcode = '42501', message = 'joining_closed';
    else
        if exists (select 1 from public.party_members as other_member where other_member.party_id = party_record.id and lower(other_member.nickname) = lower(trim(p_nickname)) and other_member.access_status = 'joined') then raise exception using errcode = '23505', message = 'nickname_taken'; end if;
        insert into public.party_members (party_id, player_id, nickname, color) values (party_record.id, p_player_id, trim(p_nickname), '#' || substr(md5(p_player_id::text), 1, 6)) returning * into member;
        update public.game_sessions set revision = revision + 1 where id = session_record.id returning revision into session_record.revision;
        is_new := true;
    end if;
    command_response := jsonb_build_object('memberId', member.id, 'partyId', member.party_id, 'nickname', member.nickname, 'color', member.color, 'score', member.score, 'ready', member.ready, 'accessStatus', member.access_status, 'partyCode', party_record.code, 'sessionState', session_record.state, 'joiningOpen', session_record.joining_open, 'gameSessionId', session_record.id, 'sessionRevision', session_record.revision, 'changed', is_new);
    insert into public.command_receipts (actor_id, command_id, command_name, response) values (p_player_id, p_command_id, 'join_party', command_response);
    return query select member.id, member.party_id, member.nickname, member.color, member.score, member.ready, member.access_status, party_record.code, session_record.state, session_record.joining_open, session_record.id, session_record.revision;
end;
$$;

create function public.change_party_member_nickname(p_player_id uuid, p_member_id uuid, p_command_id uuid, p_nickname text, p_expected_revision bigint)
returns table (member_id uuid, party_id uuid, nickname text, color text, score integer, ready boolean, access_status text, game_session_id uuid, session_revision bigint)
language plpgsql security definer set search_path = ''
as $$
declare existing_response jsonb; member public.party_members; session_record public.game_sessions; command_response jsonb;
begin
    select receipt.response into existing_response from public.command_receipts as receipt where receipt.actor_id = p_player_id and receipt.command_id = p_command_id;
    if found then return query select (existing_response->>'memberId')::uuid, (existing_response->>'partyId')::uuid, existing_response->>'nickname', existing_response->>'color', (existing_response->>'score')::integer, (existing_response->>'ready')::boolean, existing_response->>'accessStatus', (existing_response->>'gameSessionId')::uuid, (existing_response->>'sessionRevision')::bigint; return; end if;
    select party_member.* into member from public.party_members as party_member where party_member.id = p_member_id and party_member.player_id = p_player_id;
    if not found then raise exception using errcode = 'P0002', message = 'member_not_found'; end if;
    select session.* into session_record from public.game_sessions as session join public.parties as party on party.current_game_session_id = session.id where party.id = member.party_id for update of session;
    if session_record.state <> 'lobby' or session_record.revision <> p_expected_revision then raise exception using errcode = '40001', message = 'stale_revision'; end if;
    if exists (select 1 from public.party_members as other_member where other_member.party_id = member.party_id and other_member.id <> member.id and lower(other_member.nickname) = lower(trim(p_nickname)) and other_member.access_status = 'joined') then raise exception using errcode = '23505', message = 'nickname_taken'; end if;
    update public.party_members set nickname = trim(p_nickname) where id = member.id returning * into member;
    update public.game_sessions set revision = revision + 1 where id = session_record.id returning revision into session_record.revision;
    command_response := jsonb_build_object('memberId', member.id, 'partyId', member.party_id, 'nickname', member.nickname, 'color', member.color, 'score', member.score, 'ready', member.ready, 'accessStatus', member.access_status, 'gameSessionId', session_record.id, 'sessionRevision', session_record.revision);
    insert into public.command_receipts (actor_id, command_id, command_name, response) values (p_player_id, p_command_id, 'change_party_member_nickname', command_response);
    return query select member.id, member.party_id, member.nickname, member.color, member.score, member.ready, member.access_status, session_record.id, session_record.revision;
end;
$$;

create function public.set_party_member_ready(p_player_id uuid, p_member_id uuid, p_command_id uuid, p_ready boolean, p_expected_revision bigint)
returns table (member_id uuid, party_id uuid, nickname text, color text, score integer, ready boolean, access_status text, game_session_id uuid, session_revision bigint)
language plpgsql security definer set search_path = ''
as $$
declare existing_response jsonb; member public.party_members; session_record public.game_sessions; command_response jsonb;
begin
    select receipt.response into existing_response from public.command_receipts as receipt where receipt.actor_id = p_player_id and receipt.command_id = p_command_id;
    if found then return query select (existing_response->>'memberId')::uuid, (existing_response->>'partyId')::uuid, existing_response->>'nickname', existing_response->>'color', (existing_response->>'score')::integer, (existing_response->>'ready')::boolean, existing_response->>'accessStatus', (existing_response->>'gameSessionId')::uuid, (existing_response->>'sessionRevision')::bigint; return; end if;
    select party_member.* into member from public.party_members as party_member where party_member.id = p_member_id and party_member.player_id = p_player_id;
    if not found then raise exception using errcode = 'P0002', message = 'member_not_found'; end if;
    select session.* into session_record from public.game_sessions as session join public.parties as party on party.current_game_session_id = session.id where party.id = member.party_id for update of session;
    if session_record.state <> 'lobby' or session_record.revision <> p_expected_revision then raise exception using errcode = '40001', message = 'stale_revision'; end if;
    update public.party_members set ready = p_ready where id = member.id returning * into member;
    update public.game_sessions set revision = revision + 1 where id = session_record.id returning revision into session_record.revision;
    command_response := jsonb_build_object('memberId', member.id, 'partyId', member.party_id, 'nickname', member.nickname, 'color', member.color, 'score', member.score, 'ready', member.ready, 'accessStatus', member.access_status, 'gameSessionId', session_record.id, 'sessionRevision', session_record.revision);
    insert into public.command_receipts (actor_id, command_id, command_name, response) values (p_player_id, p_command_id, 'set_party_member_ready', command_response);
    return query select member.id, member.party_id, member.nickname, member.color, member.score, member.ready, member.access_status, session_record.id, session_record.revision;
end;
$$;

create function public.player_party_lobby_projection(p_player_id uuid, p_party_code text)
returns table (member_id uuid, party_id uuid, nickname text, color text, score integer, ready boolean, access_status text, party_code text, session_state text, joining_open boolean, game_session_id uuid, session_revision bigint)
language sql stable security definer set search_path = ''
as $$
    select member.id, member.party_id, member.nickname, member.color, member.score, member.ready, member.access_status, party.code, session.state, session.joining_open, session.id, session.revision
    from public.party_members as member join public.parties as party on party.id = member.party_id join public.game_sessions as session on session.id = party.current_game_session_id
    where member.party_id in (select own_member.party_id from public.party_members as own_member where own_member.player_id = p_player_id and own_member.party_id = party.id and own_member.access_status = 'joined')
      and party.code = upper(trim(p_party_code)) and member.access_status = 'joined'
    order by (member.player_id = p_player_id) desc, member.created_at;
$$;

create function public.host_party_lobby_projection(p_host_id uuid, p_party_id uuid)
returns table (member_id uuid, party_id uuid, nickname text, color text, score integer, ready boolean, access_status text, party_code text, session_state text, joining_open boolean, game_session_id uuid, session_revision bigint)
language sql stable security definer set search_path = ''
as $$
    select member.id, member.party_id, member.nickname, member.color, member.score, member.ready, member.access_status, party.code, session.state, session.joining_open, session.id, session.revision
    from public.parties as party join public.game_sessions as session on session.id = party.current_game_session_id left join public.party_members as member on member.party_id = party.id and member.access_status = 'joined'
    where party.host_id = p_host_id and party.id = p_party_id;
$$;

create or replace function public.host_parties_projection(p_host_id uuid)
returns table (party_id uuid, party_code text, game_session_id uuid, game_session_state text, revision bigint, created_at timestamptz)
language sql stable security definer set search_path = ''
as $$
    select party.id, party.code, session.id, session.state, session.revision, party.created_at
    from public.parties as party join public.game_sessions as session on session.id = party.current_game_session_id
    where party.host_id = p_host_id order by party.created_at desc;
$$;

revoke all on function public.open_party_lobby(uuid, uuid, uuid, bigint) from public, anon, authenticated;
revoke all on function public.join_party(uuid, text, text, uuid, bigint) from public, anon, authenticated;
revoke all on function public.change_party_member_nickname(uuid, uuid, uuid, text, bigint) from public, anon, authenticated;
revoke all on function public.set_party_member_ready(uuid, uuid, uuid, boolean, bigint) from public, anon, authenticated;
revoke all on function public.player_party_lobby_projection(uuid, text) from public, anon, authenticated;
revoke all on function public.host_party_lobby_projection(uuid, uuid) from public, anon, authenticated;
grant execute on function public.open_party_lobby(uuid, uuid, uuid, bigint) to service_role;
grant execute on function public.join_party(uuid, text, text, uuid, bigint) to service_role;
grant execute on function public.change_party_member_nickname(uuid, uuid, uuid, text, bigint) to service_role;
grant execute on function public.set_party_member_ready(uuid, uuid, uuid, boolean, bigint) to service_role;
grant execute on function public.player_party_lobby_projection(uuid, text) to service_role;
grant execute on function public.host_party_lobby_projection(uuid, uuid) to service_role;
