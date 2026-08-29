create function public.set_party_member_access(p_host_id uuid, p_party_id uuid, p_member_id uuid, p_command_id uuid, p_expected_revision bigint, p_access_status text)
returns table (game_session_id uuid, session_revision bigint)
language plpgsql security definer set search_path = ''
as $$
declare existing_response jsonb; session_id uuid; next_revision bigint;
begin
    if p_access_status not in ('joined', 'removed') then raise exception using errcode = '22023', message = 'invalid_access_status'; end if;
    select response into existing_response from public.command_receipts where actor_id = p_host_id and command_id = p_command_id;
    if found then return query select (existing_response->>'gameSessionId')::uuid, (existing_response->>'sessionRevision')::bigint; return; end if;
    update public.party_members as member set access_status = p_access_status, ready = false
    from public.parties as party join public.game_sessions as session on session.id = party.current_game_session_id
    where member.id = p_member_id and member.party_id = p_party_id and party.id = p_party_id and party.host_id = p_host_id and session.revision = p_expected_revision
    returning session.id into session_id;
    if not found then raise exception using errcode = '40001', message = 'stale_revision'; end if;
    update public.game_sessions set revision = revision + 1 where id = session_id returning revision into next_revision;
    insert into public.command_receipts values (p_host_id, p_command_id, 'set_party_member_access', jsonb_build_object('gameSessionId', session_id, 'sessionRevision', next_revision));
    return query select session_id, next_revision;
end;
$$;
revoke all on function public.set_party_member_access(uuid, uuid, uuid, uuid, bigint, text) from public, anon, authenticated;
grant execute on function public.set_party_member_access(uuid, uuid, uuid, uuid, bigint, text) to service_role;