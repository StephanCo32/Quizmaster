create or replace function public.start_picture_caption_session(p_host_id uuid, p_party_id uuid, p_command_id uuid, p_expected_revision bigint)
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
    where round.id = (select pending_round.id from public.picture_caption_rounds as pending_round where pending_round.game_session_id = session_record.id and pending_round.state = 'pending' order by pending_round.position limit 1 for update)
      and template.id = round.template_id
    returning round.* into activated_round;
    if not found then raise exception using errcode = '40001', message = 'no_pending_round'; end if;
    update public.game_sessions set state = 'live', joining_open = false, revision = revision + 1 where id = session_record.id returning revision into session_record.revision;
    insert into public.command_receipts values (p_host_id, p_command_id, 'start_picture_caption_session', jsonb_build_object('roundId', activated_round.id, 'gameSessionId', session_record.id, 'sessionRevision', session_record.revision, 'captioningDeadline', activated_round.captioning_deadline));
    return query select activated_round.id, session_record.id, session_record.revision, activated_round.captioning_deadline;
end;
$$;

revoke all on function public.start_picture_caption_session(uuid, uuid, uuid, bigint) from public, anon, authenticated;
grant execute on function public.start_picture_caption_session(uuid, uuid, uuid, bigint) to service_role;