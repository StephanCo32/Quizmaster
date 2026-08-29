create or replace function public.remove_picture_caption_submission(p_host_id uuid,p_party_id uuid,p_submission_id uuid,p_command_id uuid,p_expected_revision bigint)
returns table (game_session_id uuid,session_revision bigint)
language plpgsql security definer set search_path='' as $$
declare existing jsonb; session_record public.game_sessions; removed public.picture_caption_submissions; active_round public.picture_caption_rounds; next_revision bigint;
begin
 select response into existing from public.command_receipts where actor_id=p_host_id and command_id=p_command_id;
 if found then return query select (existing->>'gameSessionId')::uuid,(existing->>'sessionRevision')::bigint; return; end if;
 select session.* into session_record from public.parties party join public.game_sessions session on session.id=party.current_game_session_id where party.host_id=p_host_id and party.id=p_party_id and session.revision=p_expected_revision for update of session;
 if not found then raise exception using errcode='40001',message='stale_revision'; end if;
 delete from public.picture_caption_submissions submission using public.picture_caption_rounds round where submission.id=p_submission_id and submission.round_id=round.id and round.game_session_id=session_record.id and round.state='active' and round.phase='captioning' and round.captioning_deadline is not null and round.captioning_deadline>now() returning submission.* into removed;
 if not found then raise exception using errcode='40001',message='captioning_closed'; end if;
 insert into public.picture_caption_moderation_audits(round_id,party_member_id,caption,removed_by_host_id) values(removed.round_id,removed.party_member_id,removed.caption,p_host_id);
 select round.* into active_round from public.picture_caption_rounds round where round.id=removed.round_id for update;
 update public.picture_caption_rounds set captioning_deadline=least(captioning_hard_deadline,now()+interval '5 seconds') where id=active_round.id and captioning_hard_deadline is not null;
 update public.game_sessions set revision=revision+1 where id=session_record.id returning revision into next_revision;
 insert into public.command_receipts values(p_host_id,p_command_id,'remove_picture_caption_submission',jsonb_build_object('gameSessionId',session_record.id,'sessionRevision',next_revision));
 return query select session_record.id,next_revision;
end; $$;