create or replace function public.add_picture_caption_round(p_host_id uuid, p_party_id uuid, p_template_id uuid, p_command_id uuid, p_expected_revision bigint, p_captioning_seconds integer, p_voting_seconds integer, p_caption_grapheme_limit integer)
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

revoke all on function public.add_picture_caption_round(uuid, uuid, uuid, uuid, bigint, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.add_picture_caption_round(uuid, uuid, uuid, uuid, bigint, integer, integer, integer) to service_role;