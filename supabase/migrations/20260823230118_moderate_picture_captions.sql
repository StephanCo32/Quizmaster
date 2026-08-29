create function public.host_picture_caption_submissions_projection(p_host_id uuid,p_party_id uuid)
returns table (submission_id uuid,member_id uuid,nickname text,caption text,submitted_at timestamptz,updated_at timestamptz,game_session_id uuid,session_revision bigint)
language sql stable security definer set search_path='' as $$
 select submission.id,member.id,member.nickname,submission.caption,submission.submitted_at,submission.updated_at,session.id,session.revision from public.parties party join public.game_sessions session on session.id=party.current_game_session_id join public.picture_caption_rounds round on round.game_session_id=session.id and round.state='active' join public.picture_caption_submissions submission on submission.round_id=round.id join public.party_members member on member.id=submission.party_member_id where party.host_id=p_host_id and party.id=p_party_id order by submission.submitted_at;
$$;

create function public.remove_picture_caption_submission(p_host_id uuid,p_party_id uuid,p_submission_id uuid,p_command_id uuid,p_expected_revision bigint)
returns table (game_session_id uuid,session_revision bigint)
language plpgsql security definer set search_path='' as $$
declare existing jsonb; session_record public.game_sessions; removed public.picture_caption_submissions; next_revision bigint;
begin
 select response into existing from public.command_receipts where actor_id=p_host_id and command_id=p_command_id;
 if found then return query select (existing->>'gameSessionId')::uuid,(existing->>'sessionRevision')::bigint; return; end if;
 select session.* into session_record from public.parties party join public.game_sessions session on session.id=party.current_game_session_id where party.host_id=p_host_id and party.id=p_party_id and session.revision=p_expected_revision for update of session;
 if not found then raise exception using errcode='40001',message='stale_revision'; end if;
 delete from public.picture_caption_submissions submission using public.picture_caption_rounds round where submission.id=p_submission_id and submission.round_id=round.id and round.game_session_id=session_record.id and round.state='active' and round.phase='captioning' and round.captioning_deadline is not null and round.captioning_deadline>now() returning submission.* into removed;
 if not found then raise exception using errcode='40001',message='captioning_closed'; end if;
 insert into public.picture_caption_moderation_audits(round_id,party_member_id,caption,removed_by_host_id) values(removed.round_id,removed.party_member_id,removed.caption,p_host_id);
 update public.game_sessions set revision=revision+1 where id=session_record.id returning revision into next_revision;
 insert into public.command_receipts values(p_host_id,p_command_id,'remove_picture_caption_submission',jsonb_build_object('gameSessionId',session_record.id,'sessionRevision',next_revision));
 return query select session_record.id,next_revision;
end; $$;

create function public.host_picture_caption_completion_projection(p_host_id uuid,p_party_id uuid)
returns table (eligible_count integer,submission_count integer,game_session_id uuid,session_revision bigint)
language sql stable security definer set search_path='' as $$
 select count(eligible.party_member_id)::integer,count(submission.id)::integer,session.id,session.revision from public.parties party join public.game_sessions session on session.id=party.current_game_session_id join public.picture_caption_rounds round on round.game_session_id=session.id and round.state='active' left join public.picture_caption_round_members eligible on eligible.round_id=round.id left join public.picture_caption_submissions submission on submission.round_id=round.id and submission.party_member_id=eligible.party_member_id where party.host_id=p_host_id and party.id=p_party_id group by session.id,session.revision;
$$;
create function public.display_picture_caption_completion_projection(p_display_session_id uuid,p_party_code text)
returns table (eligible_count integer,submission_count integer,game_session_id uuid,session_revision bigint)
language sql stable security definer set search_path='' as $$
 select count(eligible.party_member_id)::integer,count(submission.id)::integer,session.id,session.revision from public.display_sessions display_session join public.parties party on party.id=display_session.party_id join public.game_sessions session on session.id=party.current_game_session_id join public.picture_caption_rounds round on round.game_session_id=session.id and round.state='active' left join public.picture_caption_round_members eligible on eligible.round_id=round.id left join public.picture_caption_submissions submission on submission.round_id=round.id and submission.party_member_id=eligible.party_member_id where display_session.id=p_display_session_id and display_session.revoked_at is null and party.code=upper(trim(p_party_code)) group by session.id,session.revision;
$$;

revoke all on function public.host_picture_caption_submissions_projection(uuid,uuid),public.remove_picture_caption_submission(uuid,uuid,uuid,uuid,bigint),public.host_picture_caption_completion_projection(uuid,uuid),public.display_picture_caption_completion_projection(uuid,text) from public,anon,authenticated;
grant execute on function public.host_picture_caption_submissions_projection(uuid,uuid),public.remove_picture_caption_submission(uuid,uuid,uuid,uuid,bigint),public.host_picture_caption_completion_projection(uuid,uuid),public.display_picture_caption_completion_projection(uuid,text) to service_role;