-- Co-authored candidates (same normalized caption from multiple Players) were fanning out into
-- one row per author via a plain LEFT JOIN, rendering as separate duplicate cards instead of one
-- merged card listing every co-author. Aggregate into arrays instead, matching voter_nicknames/colors.
drop function public.host_picture_caption_reveal_projection(uuid,uuid);
create function public.host_picture_caption_reveal_projection(p_host_id uuid,p_party_id uuid) returns table(candidate_id uuid,letter text,caption text,is_official boolean,author_nicknames text[],author_colors text[],voter_nicknames text[],voter_colors text[],revealed boolean,game_session_id uuid,session_revision bigint) language sql stable security definer set search_path='' as $$
 select candidate.id,chr(65+candidate.display_position),candidate.caption,candidate.is_official,
   (select array_agg(member.nickname order by member.created_at) from public.picture_caption_candidate_authors author join public.party_members member on member.id=author.party_member_id where author.candidate_id=candidate.id),
   (select array_agg(member.color order by member.created_at) from public.picture_caption_candidate_authors author join public.party_members member on member.id=author.party_member_id where author.candidate_id=candidate.id),
   (select array_agg(voter.nickname order by ballot.cast_at) from public.picture_caption_ballots ballot join public.party_members voter on voter.id=ballot.party_member_id where ballot.candidate_id=candidate.id),
   (select array_agg(voter.color order by ballot.cast_at) from public.picture_caption_ballots ballot join public.party_members voter on voter.id=ballot.party_member_id where ballot.candidate_id=candidate.id),
   candidate.revealed_at is not null,session.id,session.revision
 from public.parties party join public.game_sessions session on session.id=party.current_game_session_id join public.picture_caption_rounds round on round.game_session_id=session.id and round.state='active' and round.phase in ('revealing','results') join public.picture_caption_candidates candidate on candidate.round_id=round.id
 where party.host_id=p_host_id and party.id=p_party_id order by candidate.display_position;
$$;

drop function public.display_picture_caption_reveal_projection(uuid,text);
create function public.display_picture_caption_reveal_projection(p_display_session_id uuid,p_party_code text) returns table(candidate_id uuid,letter text,caption text,is_official boolean,revealed boolean,author_nicknames text[],author_colors text[],voter_nicknames text[],voter_colors text[],game_session_id uuid,session_revision bigint) language sql stable security definer set search_path='' as $$
 select candidate.id,chr(65+candidate.display_position),candidate.caption,
   case when candidate.revealed_at is not null then candidate.is_official else null end,
   candidate.revealed_at is not null,
   case when candidate.revealed_at is not null then (select array_agg(member.nickname order by member.created_at) from public.picture_caption_candidate_authors author join public.party_members member on member.id=author.party_member_id where author.candidate_id=candidate.id) else null end,
   case when candidate.revealed_at is not null then (select array_agg(member.color order by member.created_at) from public.picture_caption_candidate_authors author join public.party_members member on member.id=author.party_member_id where author.candidate_id=candidate.id) else null end,
   (select array_agg(voter.nickname order by ballot.cast_at) from public.picture_caption_ballots ballot join public.party_members voter on voter.id=ballot.party_member_id where ballot.candidate_id=candidate.id),
   (select array_agg(voter.color order by ballot.cast_at) from public.picture_caption_ballots ballot join public.party_members voter on voter.id=ballot.party_member_id where ballot.candidate_id=candidate.id),
   session.id,session.revision
 from public.display_sessions display_session join public.parties party on party.id=display_session.party_id join public.game_sessions session on session.id=party.current_game_session_id join public.picture_caption_rounds round on round.game_session_id=session.id and round.state='active' and round.phase in ('revealing','results') join public.picture_caption_candidates candidate on candidate.round_id=round.id
 where display_session.id=p_display_session_id and display_session.revoked_at is null and party.code=upper(trim(p_party_code)) order by candidate.display_position;
$$;

drop function public.player_picture_caption_reveal_projection(uuid,text);
create function public.player_picture_caption_reveal_projection(p_player_id uuid,p_party_code text) returns table(candidate_id uuid,letter text,caption text,is_official boolean,revealed boolean,author_nicknames text[],author_colors text[],game_session_id uuid,session_revision bigint) language sql stable security definer set search_path='' as $$
 select candidate.id,chr(65+candidate.display_position),candidate.caption,
   case when candidate.revealed_at is not null then candidate.is_official else null end,
   candidate.revealed_at is not null,
   case when candidate.revealed_at is not null then (select array_agg(member.nickname order by member.created_at) from public.picture_caption_candidate_authors author join public.party_members member on member.id=author.party_member_id where author.candidate_id=candidate.id) else null end,
   case when candidate.revealed_at is not null then (select array_agg(member.color order by member.created_at) from public.picture_caption_candidate_authors author join public.party_members member on member.id=author.party_member_id where author.candidate_id=candidate.id) else null end,
   session.id,session.revision
 from public.parties party join public.game_sessions session on session.id=party.current_game_session_id join public.picture_caption_rounds round on round.game_session_id=session.id and round.state='active' and round.phase in ('revealing','results') join public.picture_caption_candidates candidate on candidate.round_id=round.id
 where party.code=upper(trim(p_party_code)) and exists(select 1 from public.party_members member where member.player_id=p_player_id and member.party_id=party.id) order by candidate.display_position;
$$;

drop function public.picture_caption_results_projection(uuid);
create function public.picture_caption_results_projection(p_party_id uuid) returns table(caption text,points integer,is_leader boolean,is_official boolean,author_nicknames text[],author_colors text[],game_session_id uuid,session_revision bigint) language sql stable security definer set search_path='' as $$
 select candidate.caption,candidate.points,candidate.points=(select max(other.points) from public.picture_caption_candidates other where other.round_id=round.id),
   case when candidate.revealed_at is not null then candidate.is_official else null end,
   case when candidate.revealed_at is not null then (select array_agg(member.nickname order by member.created_at) from public.picture_caption_candidate_authors author join public.party_members member on member.id=author.party_member_id where author.candidate_id=candidate.id) else null end,
   case when candidate.revealed_at is not null then (select array_agg(member.color order by member.created_at) from public.picture_caption_candidate_authors author join public.party_members member on member.id=author.party_member_id where author.candidate_id=candidate.id) else null end,
   session.id,session.revision
 from public.parties party join public.game_sessions session on session.id=party.current_game_session_id join public.picture_caption_rounds round on round.game_session_id=session.id and round.state='active' and round.phase in ('revealing','results') join public.picture_caption_candidates candidate on candidate.round_id=round.id
 where party.id=p_party_id order by candidate.points desc,candidate.display_position;
$$;


drop function public.player_picture_caption_results_projection(uuid,text);
create function public.player_picture_caption_results_projection(p_player_id uuid,p_party_code text) returns table(caption text,points integer,is_leader boolean,is_official boolean,author_nicknames text[],author_colors text[],game_session_id uuid,session_revision bigint) language sql stable security definer set search_path='' as $$ select result.* from public.picture_caption_results_projection((select party.id from public.parties party join public.party_members member on member.party_id=party.id where party.code=upper(trim(p_party_code)) and member.player_id=p_player_id and member.access_status='joined')) result; $$;

drop function public.display_picture_caption_results_projection(uuid,text);
create function public.display_picture_caption_results_projection(p_display_session_id uuid,p_party_code text) returns table(caption text,points integer,is_leader boolean,is_official boolean,author_nicknames text[],author_colors text[],game_session_id uuid,session_revision bigint) language sql stable security definer set search_path='' as $$ select result.* from public.picture_caption_results_projection((select party.id from public.parties party join public.display_sessions display_session on display_session.party_id=party.id where party.code=upper(trim(p_party_code)) and display_session.id=p_display_session_id and display_session.revoked_at is null)) result; $$;

revoke all on function public.host_picture_caption_reveal_projection(uuid,uuid),public.display_picture_caption_reveal_projection(uuid,text),public.player_picture_caption_reveal_projection(uuid,text),public.picture_caption_results_projection(uuid),public.player_picture_caption_results_projection(uuid,text),public.display_picture_caption_results_projection(uuid,text) from public,anon,authenticated;
grant execute on function public.host_picture_caption_reveal_projection(uuid,uuid),public.display_picture_caption_reveal_projection(uuid,text),public.player_picture_caption_reveal_projection(uuid,text),public.picture_caption_results_projection(uuid),public.player_picture_caption_results_projection(uuid,text),public.display_picture_caption_results_projection(uuid,text) to service_role;

-- Host needs to see who hasn't submitted a caption yet, not just a bare count, to moderate the room.
drop function public.host_picture_caption_completion_projection(uuid,uuid);
create function public.host_picture_caption_completion_projection(p_host_id uuid,p_party_id uuid)
returns table (eligible_count integer,submission_count integer,missing_nicknames text[],missing_colors text[],game_session_id uuid,session_revision bigint)
language sql stable security definer set search_path='' as $$
 select count(eligible.party_member_id)::integer,count(submission.id)::integer,
   (select array_agg(member.nickname order by member.created_at) from public.picture_caption_round_members outstanding join public.party_members member on member.id=outstanding.party_member_id where outstanding.round_id=round.id and not exists(select 1 from public.picture_caption_submissions submitted where submitted.round_id=round.id and submitted.party_member_id=outstanding.party_member_id)),
   (select array_agg(member.color order by member.created_at) from public.picture_caption_round_members outstanding join public.party_members member on member.id=outstanding.party_member_id where outstanding.round_id=round.id and not exists(select 1 from public.picture_caption_submissions submitted where submitted.round_id=round.id and submitted.party_member_id=outstanding.party_member_id)),
   session.id,session.revision
 from public.parties party join public.game_sessions session on session.id=party.current_game_session_id join public.picture_caption_rounds round on round.game_session_id=session.id and round.state='active' left join public.picture_caption_round_members eligible on eligible.round_id=round.id left join public.picture_caption_submissions submission on submission.round_id=round.id and submission.party_member_id=eligible.party_member_id where party.host_id=p_host_id and party.id=p_party_id group by round.id,session.id,session.revision;
$$;

revoke all on function public.host_picture_caption_completion_projection(uuid,uuid) from public,anon,authenticated;
grant execute on function public.host_picture_caption_completion_projection(uuid,uuid) to service_role;
