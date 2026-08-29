create function public.set_party_joining(p_host_id uuid, p_party_id uuid, p_command_id uuid, p_expected_revision bigint, p_joining_open boolean)
returns table (game_session_id uuid, session_revision bigint)
language plpgsql security definer set search_path = ''
as $$
declare existing_response jsonb; session_id uuid; next_revision bigint;
begin
    select receipt.response into existing_response from public.command_receipts as receipt where receipt.actor_id = p_host_id and receipt.command_id = p_command_id;
    if found then return query select (existing_response->>'gameSessionId')::uuid, (existing_response->>'sessionRevision')::bigint; return; end if;
    update public.game_sessions as session set joining_open = p_joining_open, revision = session.revision + 1
    from public.parties as party
    where session.id = party.current_game_session_id and party.id = p_party_id and party.host_id = p_host_id and session.state = 'lobby' and session.revision = p_expected_revision
    returning session.id, session.revision into session_id, next_revision;
    if not found then raise exception using errcode = '40001', message = 'stale_revision'; end if;
    insert into public.command_receipts (actor_id, command_id, command_name, response)
    values (p_host_id, p_command_id, 'set_party_joining', jsonb_build_object('gameSessionId', session_id, 'sessionRevision', next_revision));
    return query select session_id, next_revision;
end;
$$;

revoke all on function public.set_party_joining(uuid, uuid, uuid, bigint, boolean) from public, anon, authenticated;
grant execute on function public.set_party_joining(uuid, uuid, uuid, bigint, boolean) to service_role;