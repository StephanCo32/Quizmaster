-- Host should always see who voted for each candidate, even once Reveal starts (the live
-- ballot tally in host_picture_caption_ballots_projection is scoped to phase='voting' only).
-- Display already showed voter colors during Voting; carry that same data into Reveal so a
-- revealed card can show voters distinctly from its author.
drop function public.host_picture_caption_reveal_projection(uuid,uuid);
create function public.host_picture_caption_reveal_projection(p_host_id uuid,p_party_id uuid) returns table(candidate_id uuid,letter text,caption text,is_official boolean,author_nickname text,author_color text,voter_nicknames text[],voter_colors text[],revealed boolean,game_session_id uuid,session_revision bigint) language sql stable security definer set search_path='' as $$
 select candidate.id,chr(65+candidate.display_position),candidate.caption,candidate.is_official,author.nickname,author.color,
   (select array_agg(voter.nickname order by ballot.cast_at) from public.picture_caption_ballots ballot join public.party_members voter on voter.id=ballot.party_member_id where ballot.candidate_id=candidate.id),
   (select array_agg(voter.color order by ballot.cast_at) from public.picture_caption_ballots ballot join public.party_members voter on voter.id=ballot.party_member_id where ballot.candidate_id=candidate.id),
   candidate.revealed_at is not null,session.id,session.revision
 from public.parties party join public.game_sessions session on session.id=party.current_game_session_id join public.picture_caption_rounds round on round.game_session_id=session.id and round.state='active' and round.phase in ('revealing','results') join public.picture_caption_candidates candidate on candidate.round_id=round.id
 left join public.picture_caption_candidate_authors candidate_author on candidate_author.candidate_id=candidate.id left join public.party_members author on author.id=candidate_author.party_member_id
 where party.host_id=p_host_id and party.id=p_party_id order by candidate.display_position;
$$;

drop function public.display_picture_caption_reveal_projection(uuid,text);
create function public.display_picture_caption_reveal_projection(p_display_session_id uuid,p_party_code text) returns table(candidate_id uuid,letter text,caption text,is_official boolean,revealed boolean,author_nickname text,author_color text,voter_nicknames text[],voter_colors text[],game_session_id uuid,session_revision bigint) language sql stable security definer set search_path='' as $$
 select candidate.id,chr(65+candidate.display_position),candidate.caption,
   case when candidate.revealed_at is not null then candidate.is_official else null end,
   candidate.revealed_at is not null,
   case when candidate.revealed_at is not null then author.nickname else null end,
   case when candidate.revealed_at is not null then author.color else null end,
   (select array_agg(voter.nickname order by ballot.cast_at) from public.picture_caption_ballots ballot join public.party_members voter on voter.id=ballot.party_member_id where ballot.candidate_id=candidate.id),
   (select array_agg(voter.color order by ballot.cast_at) from public.picture_caption_ballots ballot join public.party_members voter on voter.id=ballot.party_member_id where ballot.candidate_id=candidate.id),
   session.id,session.revision
 from public.display_sessions display_session join public.parties party on party.id=display_session.party_id join public.game_sessions session on session.id=party.current_game_session_id join public.picture_caption_rounds round on round.game_session_id=session.id and round.state='active' and round.phase in ('revealing','results') join public.picture_caption_candidates candidate on candidate.round_id=round.id
 left join public.picture_caption_candidate_authors candidate_author on candidate_author.candidate_id=candidate.id left join public.party_members author on author.id=candidate_author.party_member_id
 where display_session.id=p_display_session_id and display_session.revoked_at is null and party.code=upper(trim(p_party_code)) order by candidate.display_position;
$$;

revoke all on function public.host_picture_caption_reveal_projection(uuid,uuid),public.display_picture_caption_reveal_projection(uuid,text) from public,anon,authenticated;
grant execute on function public.host_picture_caption_reveal_projection(uuid,uuid),public.display_picture_caption_reveal_projection(uuid,text) to service_role;

-- Host needs to tell "just finished Voting, awaiting Reveal" apart from "fully completed, ready
-- for the next round" -- both look identical as state='completed', phase=null.
drop function public.host_picture_caption_rounds_projection(uuid,uuid);
create function public.host_picture_caption_rounds_projection(p_host_id uuid, p_party_id uuid)
returns table (round_id uuid, round_position integer, state text, template_id uuid, name text, picture_url text, official_caption text, captioning_seconds integer, voting_seconds integer, caption_grapheme_limit integer, phase text, captioning_deadline timestamptz, paused_remaining_seconds integer, turn_deadline timestamptz, turn_paused_remaining_seconds integer, current_turn_nickname text, eligible_voter_count integer, awaiting_reveal boolean, game_session_id uuid, session_revision bigint)
language sql stable security definer set search_path = '' as $$
 select round.id, round.position, round.state, round.template_id, template.name, coalesce(round.snapshot_picture_url, template.picture_url), coalesce(round.snapshot_official_caption, template.official_caption), round.captioning_seconds, round.voting_seconds, round.caption_grapheme_limit, round.phase, round.captioning_deadline, round.paused_remaining_seconds, round.turn_deadline, round.turn_paused_remaining_seconds, turn_member.nickname, (select count(*)::integer from public.picture_caption_turn_order turn_count where turn_count.round_id=round.id),
   round.state='completed' and exists(select 1 from public.picture_caption_round_results result where result.round_id=round.id) and not exists(select 1 from public.picture_caption_reveals reveal where reveal.round_id=round.id),
   session.id, session.revision
 from public.parties party join public.game_sessions session on session.id=party.current_game_session_id join public.picture_caption_rounds round on round.game_session_id=session.id left join public.picture_caption_templates template on template.id=round.template_id
 left join public.picture_caption_turn_order turn on turn.round_id=round.id and turn.position=round.turn_index
 left join public.party_members turn_member on turn_member.id=turn.party_member_id
 where party.host_id=p_host_id and party.id=p_party_id order by round.position;
$$;

revoke all on function public.host_picture_caption_rounds_projection(uuid,uuid) from public,anon,authenticated;
grant execute on function public.host_picture_caption_rounds_projection(uuid,uuid) to service_role;

-- Only the first round could ever be activated (start_picture_caption_session requires
-- session.state='lobby'). Nothing activated round 2+ once the session went live.
create function public.start_next_picture_caption_round(p_host_id uuid, p_party_id uuid, p_command_id uuid, p_expected_revision bigint)
returns table (round_id uuid, game_session_id uuid, session_revision bigint, captioning_deadline timestamptz)
language plpgsql security definer set search_path = '' as $$
declare existing_response jsonb; session_record public.game_sessions; pending_round public.picture_caption_rounds; activated_round public.picture_caption_rounds; template_record public.picture_caption_templates;
begin
 select response into existing_response from public.command_receipts where actor_id=p_host_id and command_id=p_command_id;
 if found then return query select (existing_response->>'roundId')::uuid,(existing_response->>'gameSessionId')::uuid,(existing_response->>'sessionRevision')::bigint,(existing_response->>'captioningDeadline')::timestamptz; return; end if;
 select session.* into session_record from public.game_sessions session join public.parties party on party.current_game_session_id=session.id where party.id=p_party_id and party.host_id=p_host_id and session.state='live' and session.revision=p_expected_revision for update of session;
 if not found then raise exception using errcode='40001',message='stale_revision'; end if;
 if exists(select 1 from public.picture_caption_rounds round where round.game_session_id=session_record.id and round.state='active') then raise exception using errcode='40001',message='round_in_progress'; end if;
 if not exists(select 1 from public.party_members member where member.party_id=p_party_id and member.access_status='joined') then raise exception using errcode='40001',message='no_joined_players'; end if;
 select round.* into pending_round from public.picture_caption_rounds round where round.game_session_id=session_record.id and round.state='pending' order by round.position limit 1 for update;
 if not found then raise exception using errcode='40001',message='no_pending_round'; end if;
 select template.* into template_record from public.picture_caption_templates template where template.id=pending_round.template_id for key share;
 if not found then raise exception using errcode='40001',message='no_pending_round'; end if;
 if template_record.official_caption is null or btrim(template_record.official_caption)='' then raise exception using errcode='40001',message='official_caption_required'; end if;
 update public.picture_caption_rounds round set state='active',phase='captioning',snapshot_template_revision=template_record.revision,snapshot_picture_url=template_record.picture_url,snapshot_official_caption=template_record.official_caption,captioning_deadline=now()+make_interval(secs=>round.captioning_seconds),captioning_hard_deadline=now()+make_interval(secs=>round.captioning_seconds) where round.id=pending_round.id returning round.* into activated_round;
 insert into public.picture_caption_round_members(round_id,party_member_id,score_at_start) select activated_round.id,member.id,member.score from public.party_members member where member.party_id=p_party_id and member.access_status='joined';
 update public.game_sessions set revision=revision+1 where id=session_record.id returning revision into session_record.revision;
 insert into public.command_receipts values(p_host_id,p_command_id,'start_next_picture_caption_round',jsonb_build_object('roundId',activated_round.id,'gameSessionId',session_record.id,'sessionRevision',session_record.revision,'captioningDeadline',activated_round.captioning_deadline));
 return query select activated_round.id,session_record.id,session_record.revision,activated_round.captioning_deadline;
end; $$;

revoke all on function public.start_next_picture_caption_round(uuid,uuid,uuid,bigint) from public,anon,authenticated;
grant execute on function public.start_next_picture_caption_round(uuid,uuid,uuid,bigint) to service_role;
