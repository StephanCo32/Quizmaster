create or replace function public.start_picture_caption_session(p_host_id uuid, p_party_id uuid, p_command_id uuid, p_expected_revision bigint)
returns table (round_id uuid, game_session_id uuid, session_revision bigint, captioning_deadline timestamptz)
language plpgsql security definer set search_path = '' as $$
declare existing_response jsonb; session_record public.game_sessions; pending_round public.picture_caption_rounds; activated_round public.picture_caption_rounds; template_record public.picture_caption_templates;
begin
 select response into existing_response from public.command_receipts where actor_id=p_host_id and command_id=p_command_id;
 if found then return query select (existing_response->>'roundId')::uuid,(existing_response->>'gameSessionId')::uuid,(existing_response->>'sessionRevision')::bigint,(existing_response->>'captioningDeadline')::timestamptz; return; end if;
 select session.* into session_record from public.game_sessions session join public.parties party on party.current_game_session_id=session.id where party.id=p_party_id and party.host_id=p_host_id and session.state='lobby' and session.revision=p_expected_revision for update of session;
 if not found then raise exception using errcode='40001',message='stale_revision'; end if;
 if not exists(select 1 from public.party_members member where member.party_id=p_party_id and member.access_status='joined') then raise exception using errcode='40001',message='no_joined_players'; end if;
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

revoke all on function public.start_picture_caption_session(uuid,uuid,uuid,bigint) from public,anon,authenticated;
grant execute on function public.start_picture_caption_session(uuid,uuid,uuid,bigint) to service_role;