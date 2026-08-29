create or replace function public.close_party(p_host_id uuid,p_party_id uuid,p_command_id uuid,p_expected_revision bigint)
returns table(game_session_id uuid,session_revision bigint)
language plpgsql security definer set search_path='' as $$
declare existing jsonb; session_record public.game_sessions; next_revision bigint;
begin
    select response into existing from public.command_receipts where actor_id=p_host_id and command_id=p_command_id;
    if found then return query select (existing->>'gameSessionId')::uuid,(existing->>'sessionRevision')::bigint; return; end if;
    select session.* into session_record from public.parties party join public.game_sessions session on session.id=party.current_game_session_id where party.id=p_party_id and party.host_id=p_host_id and session.state <> 'finished' and session.revision=p_expected_revision for update of session;
    if not found then raise exception using errcode='40001',message='stale_revision'; end if;
    update public.picture_caption_rounds round set state='completed',phase=null,captioning_deadline=null,captioning_hard_deadline=null,paused_remaining_seconds=null,voting_deadline=null,voting_paused_remaining_seconds=null where round.game_session_id=session_record.id and round.state='active';
    update public.game_sessions set state='finished',joining_open=false,revision=revision+1 where id=session_record.id returning revision into next_revision;
    insert into public.command_receipts values(p_host_id,p_command_id,'close_party',jsonb_build_object('gameSessionId',session_record.id,'sessionRevision',next_revision));
    return query select session_record.id,next_revision;
end;
$$;

revoke all on function public.close_party(uuid,uuid,uuid,bigint) from public,anon,authenticated;
grant execute on function public.close_party(uuid,uuid,uuid,bigint) to service_role;