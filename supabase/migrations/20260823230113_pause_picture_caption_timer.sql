create function public.set_picture_caption_paused(p_host_id uuid, p_party_id uuid, p_command_id uuid, p_expected_revision bigint, p_paused boolean)
returns table (game_session_id uuid, session_revision bigint)
language plpgsql security definer set search_path = ''
as $$
declare existing_response jsonb; session_id uuid; next_revision bigint; changed_count integer;
begin
    select response into existing_response from public.command_receipts where actor_id = p_host_id and command_id = p_command_id;
    if found then return query select (existing_response->>'gameSessionId')::uuid, (existing_response->>'sessionRevision')::bigint; return; end if;
    select session.id into session_id from public.game_sessions as session join public.parties as party on party.current_game_session_id = session.id where party.id = p_party_id and party.host_id = p_host_id and session.state = 'live' and session.revision = p_expected_revision for update of session;
    if not found then raise exception using errcode = '40001', message = 'stale_revision'; end if;
    if p_paused then
        update public.picture_caption_rounds as round set paused_remaining_seconds = greatest(0, ceil(extract(epoch from round.captioning_deadline - now()))::integer), captioning_deadline = null where round.game_session_id = session_id and round.state = 'active' and round.phase = 'captioning' and round.captioning_deadline is not null;
    else
        update public.picture_caption_rounds as round set captioning_deadline = now() + make_interval(secs => round.paused_remaining_seconds), paused_remaining_seconds = null where round.game_session_id = session_id and round.state = 'active' and round.phase = 'captioning' and round.paused_remaining_seconds is not null;
    end if;
    get diagnostics changed_count = row_count;
    if changed_count = 0 then raise exception using errcode = '40001', message = 'stale_revision'; end if;
    update public.game_sessions set revision = revision + 1 where id = session_id returning revision into next_revision;
    insert into public.command_receipts values (p_host_id, p_command_id, 'set_picture_caption_paused', jsonb_build_object('gameSessionId', session_id, 'sessionRevision', next_revision));
    return query select session_id, next_revision;
end;
$$;
revoke all on function public.set_picture_caption_paused(uuid, uuid, uuid, bigint, boolean) from public, anon, authenticated;
grant execute on function public.set_picture_caption_paused(uuid, uuid, uuid, bigint, boolean) to service_role;