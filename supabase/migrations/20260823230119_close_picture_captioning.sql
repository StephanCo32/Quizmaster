alter table public.picture_caption_rounds add column captioning_hard_deadline timestamptz;
alter table public.picture_caption_rounds add column paused_hard_remaining_seconds integer check (paused_hard_remaining_seconds is null or paused_hard_remaining_seconds >= 0);

create or replace function public.start_picture_caption_session(p_host_id uuid, p_party_id uuid, p_command_id uuid, p_expected_revision bigint)
returns table (round_id uuid, game_session_id uuid, session_revision bigint, captioning_deadline timestamptz)
language plpgsql security definer set search_path = '' as $$
declare existing_response jsonb; session_record public.game_sessions; pending_round public.picture_caption_rounds; activated_round public.picture_caption_rounds; template_record public.picture_caption_templates;
begin
 select response into existing_response from public.command_receipts where actor_id=p_host_id and command_id=p_command_id;
 if found then return query select (existing_response->>'roundId')::uuid,(existing_response->>'gameSessionId')::uuid,(existing_response->>'sessionRevision')::bigint,(existing_response->>'captioningDeadline')::timestamptz; return; end if;
 select session.* into session_record from public.game_sessions session join public.parties party on party.current_game_session_id=session.id where party.id=p_party_id and party.host_id=p_host_id and session.state='lobby' and session.revision=p_expected_revision for update of session;
 if not found then raise exception using errcode='40001',message='stale_revision'; end if;
 if exists(select 1 from public.party_members member where member.party_id=p_party_id and member.access_status='joined' and not member.ready) then raise exception using errcode='40001',message='players_not_ready'; end if;
 select round.* into pending_round from public.picture_caption_rounds round where round.game_session_id=session_record.id and round.state='pending' order by round.position limit 1 for update;
 if not found then raise exception using errcode='40001',message='no_pending_round'; end if;
 select template.* into template_record from public.picture_caption_templates template where template.id=pending_round.template_id for key share;
 if not found then raise exception using errcode='40001',message='no_pending_round'; end if;
 update public.picture_caption_rounds round set state='active',phase='captioning',snapshot_template_revision=template_record.revision,snapshot_picture_url=template_record.picture_url,snapshot_prompt=template_record.prompt,captioning_deadline=now()+make_interval(secs=>round.captioning_seconds),captioning_hard_deadline=now()+make_interval(secs=>round.captioning_seconds) where round.id=pending_round.id returning round.* into activated_round;
 insert into public.picture_caption_round_members(round_id,party_member_id,score_at_start) select activated_round.id,member.id,member.score from public.party_members member where member.party_id=p_party_id and member.access_status='joined';
 update public.game_sessions set state='live',joining_open=false,revision=revision+1 where id=session_record.id returning revision into session_record.revision;
 insert into public.command_receipts values(p_host_id,p_command_id,'start_picture_caption_session',jsonb_build_object('roundId',activated_round.id,'gameSessionId',session_record.id,'sessionRevision',session_record.revision,'captioningDeadline',activated_round.captioning_deadline));
 return query select activated_round.id,session_record.id,session_record.revision,activated_round.captioning_deadline;
end; $$;

create or replace function public.resolve_picture_caption_deadline(p_game_session_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare round_record public.picture_caption_rounds;
begin
 select round.* into round_record from public.picture_caption_rounds round where round.game_session_id=p_game_session_id and round.state='active' and round.phase='captioning' and round.captioning_deadline is not null and round.captioning_deadline<=now() for update;
 if not found then return; end if;
 update public.picture_caption_rounds set state=case when exists(select 1 from public.picture_caption_submissions submission where submission.round_id=round_record.id) then 'active' else 'completed' end,phase=case when exists(select 1 from public.picture_caption_submissions submission where submission.round_id=round_record.id) then 'voting' else null end,captioning_deadline=null,captioning_hard_deadline=null where id=round_record.id;
 update public.game_sessions set revision=revision+1 where id=p_game_session_id;
end; $$;

create or replace function public.submit_picture_caption(p_player_id uuid,p_party_code text,p_command_id uuid,p_expected_revision bigint,p_caption text)
returns table (game_session_id uuid, session_revision bigint)
language plpgsql security definer set search_path='' as $$
declare existing jsonb; session_record public.game_sessions; active_round public.picture_caption_rounds; member_id uuid; normalized text; next_revision bigint; eligible_count integer; submission_count integer;
begin
 select response into existing from public.command_receipts where actor_id=p_player_id and command_id=p_command_id;
 if found then return query select (existing->>'gameSessionId')::uuid,(existing->>'sessionRevision')::bigint; return; end if;
 select session.* into session_record from public.parties party join public.game_sessions session on session.id=party.current_game_session_id where party.code=upper(trim(p_party_code)) and session.revision=p_expected_revision for update of session;
 if not found then raise exception using errcode='40001',message='stale_revision'; end if;
 perform public.resolve_picture_caption_deadline(session_record.id);
 select round.* into active_round from public.picture_caption_rounds round where round.game_session_id=session_record.id and round.state='active' and round.phase='captioning' and round.captioning_deadline is not null and round.captioning_deadline>now() for update;
 if not found then raise exception using errcode='40001',message='captioning_closed'; end if;
 select member.id into member_id from public.party_members member join public.picture_caption_round_members eligible on eligible.party_member_id=member.id and eligible.round_id=active_round.id where member.player_id=p_player_id and member.party_id=(select party.id from public.parties party where party.code=upper(trim(p_party_code))) and member.access_status='joined';
 if not found then raise exception using errcode='P0002',message='eligible_member_not_found'; end if;
 normalized := public.normalize_picture_caption(p_caption, active_round.caption_grapheme_limit);
 insert into public.picture_caption_submissions(round_id,party_member_id,caption) values(active_round.id,member_id,normalized) on conflict(round_id,party_member_id) do update set caption=excluded.caption,updated_at=now();
 select count(*) into eligible_count from public.picture_caption_round_members where round_id=active_round.id;
 select count(*) into submission_count from public.picture_caption_submissions where round_id=active_round.id;
 if eligible_count>0 and eligible_count=submission_count then update public.picture_caption_rounds set captioning_deadline=least(captioning_deadline,now()+interval '5 seconds') where id=active_round.id; end if;
 update public.game_sessions set revision=revision+1 where id=session_record.id returning revision into next_revision;
 insert into public.command_receipts values(p_player_id,p_command_id,'submit_picture_caption',jsonb_build_object('gameSessionId',session_record.id,'sessionRevision',next_revision));
 return query select session_record.id,next_revision;
end; $$;

create or replace function public.close_picture_captioning(p_host_id uuid,p_party_id uuid,p_command_id uuid,p_expected_revision bigint,p_confirm_missing boolean)
returns table (game_session_id uuid,session_revision bigint)
language plpgsql security definer set search_path='' as $$
declare existing jsonb; session_record public.game_sessions; active_round public.picture_caption_rounds; eligible_count integer; submission_count integer; next_revision bigint;
begin
 select response into existing from public.command_receipts where actor_id=p_host_id and command_id=p_command_id;
 if found then return query select (existing->>'gameSessionId')::uuid,(existing->>'sessionRevision')::bigint; return; end if;
 select session.* into session_record from public.parties party join public.game_sessions session on session.id=party.current_game_session_id where party.host_id=p_host_id and party.id=p_party_id and session.revision=p_expected_revision for update of session;
 if not found then raise exception using errcode='40001',message='stale_revision'; end if;
 perform public.resolve_picture_caption_deadline(session_record.id);
 select round.* into active_round from public.picture_caption_rounds round where round.game_session_id=session_record.id and round.state='active' and round.phase='captioning' for update;
 if not found then raise exception using errcode='40001',message='captioning_closed'; end if;
 select count(*) into eligible_count from public.picture_caption_round_members where round_id=active_round.id;
 select count(*) into submission_count from public.picture_caption_submissions where round_id=active_round.id;
 if submission_count<eligible_count and not p_confirm_missing then raise exception using errcode='22023',message='close_confirmation_required'; end if;
 update public.picture_caption_rounds set state=case when submission_count=0 then 'completed' else 'active' end,phase=case when submission_count=0 then null else 'voting' end,captioning_deadline=null,captioning_hard_deadline=null where id=active_round.id;
 update public.game_sessions set revision=revision+1 where id=session_record.id returning revision into next_revision;
 insert into public.command_receipts values(p_host_id,p_command_id,'close_picture_captioning',jsonb_build_object('gameSessionId',session_record.id,'sessionRevision',next_revision));
 return query select session_record.id,next_revision;
end; $$;

revoke all on function public.resolve_picture_caption_deadline(uuid),public.close_picture_captioning(uuid,uuid,uuid,bigint,boolean) from public,anon,authenticated;
grant execute on function public.resolve_picture_caption_deadline(uuid),public.close_picture_captioning(uuid,uuid,uuid,bigint,boolean) to service_role;