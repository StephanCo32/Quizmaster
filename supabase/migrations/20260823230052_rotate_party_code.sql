create function public.rotate_party_code(p_host_id uuid, p_party_id uuid, p_command_id uuid, p_expected_revision bigint)
returns table (party_code text, game_session_id uuid, session_revision bigint)
language plpgsql security definer set search_path = ''
as $$
declare existing_response jsonb; next_code text; session_id uuid; next_revision bigint;
begin
    select response into existing_response from public.command_receipts where actor_id = p_host_id and command_id = p_command_id;
    if found then return query select existing_response->>'partyCode', (existing_response->>'gameSessionId')::uuid, (existing_response->>'sessionRevision')::bigint; return; end if;
    next_code := upper(substr(encode(extensions.gen_random_bytes(4), 'hex'), 1, 6));
    update public.parties as party set code = next_code
    from public.game_sessions as session where party.id = p_party_id and party.host_id = p_host_id and session.id = party.current_game_session_id and session.revision = p_expected_revision
    returning session.id into session_id;
    if not found then raise exception using errcode = '40001', message = 'stale_revision'; end if;
    update public.game_sessions set revision = revision + 1 where id = session_id returning revision into next_revision;
    insert into public.command_receipts values (p_host_id, p_command_id, 'rotate_party_code', jsonb_build_object('partyCode', next_code, 'gameSessionId', session_id, 'sessionRevision', next_revision));
    return query select next_code, session_id, next_revision;
end;
$$;
revoke all on function public.rotate_party_code(uuid, uuid, uuid, bigint) from public, anon, authenticated;
grant execute on function public.rotate_party_code(uuid, uuid, uuid, bigint) to service_role;