create or replace function public.delete_party(p_host_id uuid,p_party_id uuid,p_command_id uuid,p_expected_revision bigint)
returns boolean language plpgsql security definer set search_path='' as $$
declare existing jsonb; session_record public.game_sessions;
begin
    select response into existing from public.command_receipts where actor_id=p_host_id and command_id=p_command_id;
    if found then return true; end if;
    select session.* into session_record from public.parties party join public.game_sessions session on session.id=party.current_game_session_id where party.id=p_party_id and party.host_id=p_host_id and session.state='finished' and session.revision=p_expected_revision for update of session;
    if not found then raise exception using errcode='40001',message='stale_revision'; end if;
    delete from public.picture_caption_reveals reveal where reveal.round_id in (select round.id from public.picture_caption_rounds round join public.game_sessions session on session.id=round.game_session_id where session.party_id=p_party_id);
    delete from public.picture_caption_round_results result where result.round_id in (select round.id from public.picture_caption_rounds round join public.game_sessions session on session.id=round.game_session_id where session.party_id=p_party_id);
    delete from public.picture_caption_rounds round where round.game_session_id in (select session.id from public.game_sessions session where session.party_id=p_party_id);
    delete from public.parties where id=p_party_id and host_id=p_host_id;
    return found;
end;
$$;

revoke all on function public.delete_party(uuid,uuid,uuid,bigint) from public,anon,authenticated;
grant execute on function public.delete_party(uuid,uuid,uuid,bigint) to service_role;