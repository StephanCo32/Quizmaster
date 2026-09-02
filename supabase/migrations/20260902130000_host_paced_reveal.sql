alter table public.picture_caption_candidates add column revealed_at timestamptz;
alter table public.picture_caption_reveals drop column paused_at;

drop function public.resolve_picture_caption_reveal(uuid);

-- Idempotent: revealing an already-revealed candidate is a silent no-op, not an error.
create function public.reveal_picture_caption_candidate(p_host_id uuid,p_party_id uuid,p_command_id uuid,p_expected_revision bigint,p_candidate_id uuid) returns table(game_session_id uuid,session_revision bigint) language plpgsql security definer set search_path='' as $$
declare existing jsonb; session_record public.game_sessions; active_round public.picture_caption_rounds; next_revision bigint;
begin
 select response into existing from public.command_receipts where actor_id=p_host_id and command_id=p_command_id; if found then return query select(existing->>'gameSessionId')::uuid,(existing->>'sessionRevision')::bigint; return; end if;
 select session.* into session_record from public.parties party join public.game_sessions session on session.id=party.current_game_session_id where party.host_id=p_host_id and party.id=p_party_id and session.revision=p_expected_revision for update of session; if not found then raise exception using errcode='40001',message='stale_revision'; end if;
 select round.* into active_round from public.picture_caption_rounds round where round.game_session_id=session_record.id and round.state='active' and round.phase='revealing' for update; if not found then raise exception using errcode='40001',message='result_unavailable'; end if;
 if not exists(select 1 from public.picture_caption_candidates where id=p_candidate_id and round_id=active_round.id) then raise exception using errcode='P0002',message='candidate_not_found'; end if;
 update public.picture_caption_candidates set revealed_at=now() where id=p_candidate_id and revealed_at is null;
 update public.game_sessions set revision=revision+1 where id=session_record.id returning revision into next_revision; insert into public.command_receipts values(p_host_id,p_command_id,'reveal_picture_caption_candidate',jsonb_build_object('gameSessionId',session_record.id,'sessionRevision',next_revision)); return query select session_record.id,next_revision;
end; $$;

create or replace function public.continue_picture_caption_round(p_host_id uuid,p_party_id uuid,p_command_id uuid,p_expected_revision bigint) returns table(game_session_id uuid,session_revision bigint) language plpgsql security definer set search_path='' as $$
declare existing jsonb; session_record public.game_sessions; active_round public.picture_caption_rounds; next_revision bigint; candidate_count integer; revealed_count integer;
begin
 select response into existing from public.command_receipts where actor_id=p_host_id and command_id=p_command_id; if found then return query select(existing->>'gameSessionId')::uuid,(existing->>'sessionRevision')::bigint; return; end if;
 select session.* into session_record from public.parties party join public.game_sessions session on session.id=party.current_game_session_id where party.host_id=p_host_id and party.id=p_party_id and session.revision=p_expected_revision for update of session; if not found then raise exception using errcode='40001',message='stale_revision'; end if;
 select round.* into active_round from public.picture_caption_rounds round where round.game_session_id=session_record.id and round.state='active' and round.phase in ('revealing','results') for update; if not found then raise exception using errcode='40001',message='result_unavailable'; end if;
 if active_round.phase='revealing' then
  select count(*) into candidate_count from public.picture_caption_candidates where round_id=active_round.id;
  select count(*) into revealed_count from public.picture_caption_candidates where round_id=active_round.id and revealed_at is not null;
  if revealed_count<candidate_count then raise exception using errcode='40001',message='reveal_incomplete'; end if;
  update public.picture_caption_rounds set phase='results' where id=active_round.id;
 else
  update public.picture_caption_rounds set state='completed',phase=null where id=active_round.id;
 end if;
 update public.game_sessions set revision=revision+1 where id=session_record.id returning revision into next_revision; insert into public.command_receipts values(p_host_id,p_command_id,'continue_picture_caption_round',jsonb_build_object('gameSessionId',session_record.id,'sessionRevision',next_revision)); return query select session_record.id,next_revision;
end; $$;

-- No timer runs during Reveal any more; pausing only ever applies to Captioning or Voting.
create or replace function public.set_picture_caption_paused(p_host_id uuid,p_party_id uuid,p_command_id uuid,p_expected_revision bigint,p_paused boolean) returns table(game_session_id uuid,session_revision bigint) language plpgsql security definer set search_path='' as $$
declare existing_response jsonb; session_id uuid; next_revision bigint; active_round public.picture_caption_rounds;
begin
 select response into existing_response from public.command_receipts where actor_id=p_host_id and command_id=p_command_id; if found then return query select(existing_response->>'gameSessionId')::uuid,(existing_response->>'sessionRevision')::bigint; return; end if;
 select session.id into session_id from public.game_sessions session join public.parties party on party.current_game_session_id=session.id where party.id=p_party_id and party.host_id=p_host_id and session.state='live' and session.revision=p_expected_revision for update of session; if not found then raise exception using errcode='40001',message='stale_revision'; end if;
 select round.* into active_round from public.picture_caption_rounds round where round.game_session_id=session_id and round.state='active' and round.phase in ('captioning','voting') for update; if not found then raise exception using errcode='40001',message='stale_revision'; end if;
 if active_round.phase='captioning' then
   if p_paused then update public.picture_caption_rounds set paused_remaining_seconds=greatest(0,ceil(extract(epoch from captioning_deadline-now()))::integer),captioning_deadline=null where id=active_round.id and captioning_deadline is not null;
   else update public.picture_caption_rounds set captioning_deadline=now()+make_interval(secs=>paused_remaining_seconds),paused_remaining_seconds=null where id=active_round.id and paused_remaining_seconds is not null; end if;
 else
   if p_paused then update public.picture_caption_rounds set turn_paused_remaining_seconds=greatest(0,ceil(extract(epoch from turn_deadline-now()))::integer),turn_deadline=null where id=active_round.id and turn_deadline is not null;
   else update public.picture_caption_rounds set turn_deadline=now()+make_interval(secs=>turn_paused_remaining_seconds),turn_paused_remaining_seconds=null where id=active_round.id and turn_paused_remaining_seconds is not null; end if;
 end if;
 if not found then raise exception using errcode='40001',message='stale_revision'; end if;
 update public.game_sessions set revision=revision+1 where id=session_id returning revision into next_revision; insert into public.command_receipts values(p_host_id,p_command_id,'set_picture_caption_paused',jsonb_build_object('gameSessionId',session_id,'sessionRevision',next_revision)); return query select session_id,next_revision;
end; $$;

-- Reveal projections become per-candidate (letter-organized), not per-ballot: Host always sees authorship; Player/Display only once the Host has revealed that candidate.
drop function public.host_picture_caption_reveal_projection(uuid,uuid);
create function public.host_picture_caption_reveal_projection(p_host_id uuid,p_party_id uuid) returns table(candidate_id uuid,letter text,caption text,is_official boolean,author_nickname text,author_color text,revealed boolean,game_session_id uuid,session_revision bigint) language sql stable security definer set search_path='' as $$
 select candidate.id,chr(65+candidate.display_position),candidate.caption,candidate.is_official,author.nickname,author.color,candidate.revealed_at is not null,session.id,session.revision
 from public.parties party join public.game_sessions session on session.id=party.current_game_session_id join public.picture_caption_rounds round on round.game_session_id=session.id and round.state='active' and round.phase in ('revealing','results') join public.picture_caption_candidates candidate on candidate.round_id=round.id
 left join public.picture_caption_candidate_authors candidate_author on candidate_author.candidate_id=candidate.id left join public.party_members author on author.id=candidate_author.party_member_id
 where party.host_id=p_host_id and party.id=p_party_id order by candidate.display_position;
$$;

drop function public.display_picture_caption_reveal_projection(uuid,text);
create function public.display_picture_caption_reveal_projection(p_display_session_id uuid,p_party_code text) returns table(candidate_id uuid,letter text,caption text,is_official boolean,revealed boolean,author_nickname text,author_color text,game_session_id uuid,session_revision bigint) language sql stable security definer set search_path='' as $$
 select candidate.id,chr(65+candidate.display_position),candidate.caption,
   case when candidate.revealed_at is not null then candidate.is_official else null end,
   candidate.revealed_at is not null,
   case when candidate.revealed_at is not null then author.nickname else null end,
   case when candidate.revealed_at is not null then author.color else null end,
   session.id,session.revision
 from public.display_sessions display_session join public.parties party on party.id=display_session.party_id join public.game_sessions session on session.id=party.current_game_session_id join public.picture_caption_rounds round on round.game_session_id=session.id and round.state='active' and round.phase in ('revealing','results') join public.picture_caption_candidates candidate on candidate.round_id=round.id
 left join public.picture_caption_candidate_authors candidate_author on candidate_author.candidate_id=candidate.id left join public.party_members author on author.id=candidate_author.party_member_id
 where display_session.id=p_display_session_id and display_session.revoked_at is null and party.code=upper(trim(p_party_code)) order by candidate.display_position;
$$;

drop function public.player_picture_caption_reveal_projection(uuid,text);
create function public.player_picture_caption_reveal_projection(p_player_id uuid,p_party_code text) returns table(candidate_id uuid,letter text,caption text,is_official boolean,revealed boolean,author_nickname text,author_color text,game_session_id uuid,session_revision bigint) language sql stable security definer set search_path='' as $$
 select candidate.id,chr(65+candidate.display_position),candidate.caption,
   case when candidate.revealed_at is not null then candidate.is_official else null end,
   candidate.revealed_at is not null,
   case when candidate.revealed_at is not null then author.nickname else null end,
   case when candidate.revealed_at is not null then author.color else null end,
   session.id,session.revision
 from public.parties party join public.game_sessions session on session.id=party.current_game_session_id join public.picture_caption_rounds round on round.game_session_id=session.id and round.state='active' and round.phase in ('revealing','results') join public.picture_caption_candidates candidate on candidate.round_id=round.id
 left join public.picture_caption_candidate_authors candidate_author on candidate_author.candidate_id=candidate.id left join public.party_members author on author.id=candidate_author.party_member_id
 where party.code=upper(trim(p_party_code)) and exists(select 1 from public.party_members member where member.player_id=p_player_id and member.party_id=party.id) order by candidate.display_position;
$$;

-- Results carries the Official caption too now (previously excluded by an inner join, since it has no author).
drop function public.picture_caption_results_projection(uuid);
create function public.picture_caption_results_projection(p_party_id uuid) returns table(caption text,points integer,is_leader boolean,is_official boolean,author_nickname text,author_color text,game_session_id uuid,session_revision bigint) language sql stable security definer set search_path='' as $$
 select candidate.caption,candidate.points,candidate.points=(select max(other.points) from public.picture_caption_candidates other where other.round_id=round.id),candidate.is_official,author.nickname,author.color,session.id,session.revision
 from public.parties party join public.game_sessions session on session.id=party.current_game_session_id join public.picture_caption_rounds round on round.game_session_id=session.id and round.state='active' and round.phase in ('revealing','results') join public.picture_caption_candidates candidate on candidate.round_id=round.id
 left join public.picture_caption_candidate_authors candidate_author on candidate_author.candidate_id=candidate.id left join public.party_members author on author.id=candidate_author.party_member_id
 where party.id=p_party_id order by candidate.points desc,candidate.display_position;
$$;

drop function public.player_picture_caption_results_projection(uuid,text);
create function public.player_picture_caption_results_projection(p_player_id uuid,p_party_code text) returns table(caption text,points integer,is_leader boolean,is_official boolean,author_nickname text,author_color text,game_session_id uuid,session_revision bigint) language sql stable security definer set search_path='' as $$ select result.* from public.picture_caption_results_projection((select party.id from public.parties party join public.party_members member on member.party_id=party.id where party.code=upper(trim(p_party_code)) and member.player_id=p_player_id and member.access_status='joined')) result; $$;

drop function public.display_picture_caption_results_projection(uuid,text);
create function public.display_picture_caption_results_projection(p_display_session_id uuid,p_party_code text) returns table(caption text,points integer,is_leader boolean,is_official boolean,author_nickname text,author_color text,game_session_id uuid,session_revision bigint) language sql stable security definer set search_path='' as $$ select result.* from public.picture_caption_results_projection((select party.id from public.parties party join public.display_sessions display_session on display_session.party_id=party.id where party.code=upper(trim(p_party_code)) and display_session.id=p_display_session_id and display_session.revoked_at is null)) result; $$;

revoke all on function public.reveal_picture_caption_candidate(uuid,uuid,uuid,bigint,uuid),public.host_picture_caption_reveal_projection(uuid,uuid),public.display_picture_caption_reveal_projection(uuid,text),public.player_picture_caption_reveal_projection(uuid,text),public.picture_caption_results_projection(uuid),public.player_picture_caption_results_projection(uuid,text),public.display_picture_caption_results_projection(uuid,text) from public,anon,authenticated;
grant execute on function public.reveal_picture_caption_candidate(uuid,uuid,uuid,bigint,uuid),public.host_picture_caption_reveal_projection(uuid,uuid),public.display_picture_caption_reveal_projection(uuid,text),public.player_picture_caption_reveal_projection(uuid,text),public.picture_caption_results_projection(uuid),public.player_picture_caption_results_projection(uuid,text),public.display_picture_caption_results_projection(uuid,text) to service_role;
