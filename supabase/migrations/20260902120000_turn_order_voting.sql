alter table public.picture_caption_rounds drop column voting_deadline;
alter table public.picture_caption_rounds drop column voting_paused_remaining_seconds;
alter table public.picture_caption_rounds add column turn_index integer;
alter table public.picture_caption_rounds add column turn_deadline timestamptz;
alter table public.picture_caption_rounds add column turn_paused_remaining_seconds integer check (turn_paused_remaining_seconds is null or turn_paused_remaining_seconds >= 0);
alter table public.picture_caption_rounds alter column voting_seconds set default 30;
alter table public.picture_caption_rounds drop constraint picture_caption_rounds_voting_seconds_check;
alter table public.picture_caption_rounds add constraint picture_caption_rounds_voting_seconds_check check (voting_seconds between 5 and 120);

create table public.picture_caption_turn_order (
    round_id uuid not null references public.picture_caption_rounds(id) on delete cascade,
    position integer not null,
    party_member_id uuid not null references public.party_members(id) on delete restrict,
    primary key (round_id, position),
    unique (round_id, party_member_id)
);
alter table public.picture_caption_turn_order enable row level security;
revoke all on table public.picture_caption_turn_order from public, anon, authenticated;

-- Fresh random start each round, then sequential by Party-join order, wrapping.
create function public.start_picture_caption_turn_order(p_round_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare eligible_count integer; start_offset integer;
begin
 select count(*) into eligible_count from public.picture_caption_round_members where round_id=p_round_id;
 if eligible_count=0 then return; end if;
 start_offset := floor(random()*eligible_count)::integer;
 insert into public.picture_caption_turn_order(round_id,position,party_member_id)
 select p_round_id, ((ordered.rn-1-start_offset+eligible_count)%eligible_count), ordered.party_member_id
 from (
  select member.id as party_member_id, row_number() over (order by member.created_at) as rn
  from public.picture_caption_round_members eligible
  join public.party_members member on member.id=eligible.party_member_id
  where eligible.round_id=p_round_id
 ) ordered;
end; $$;

-- Advances to the next turn, or commits the Voting result if the last turn just resolved.
create function public.advance_picture_caption_turn(p_round_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare eligible_count integer; current_index integer; turn_seconds integer;
begin
 select count(*) into eligible_count from public.picture_caption_turn_order where round_id=p_round_id;
 select turn_index,voting_seconds into current_index,turn_seconds from public.picture_caption_rounds where id=p_round_id;
 if current_index is null or current_index+1>=eligible_count then
  perform public.commit_picture_caption_voting_result(p_round_id);
 else
  update public.picture_caption_rounds set turn_index=turn_index+1,turn_deadline=now()+make_interval(secs=>turn_seconds),turn_paused_remaining_seconds=null where id=p_round_id;
 end if;
end; $$;

create or replace function public.close_picture_captioning(p_host_id uuid,p_party_id uuid,p_command_id uuid,p_expected_revision bigint,p_confirm_missing boolean) returns table(game_session_id uuid,session_revision bigint) language plpgsql security definer set search_path='' as $$
declare existing jsonb; session_record public.game_sessions; active_round public.picture_caption_rounds; eligible_count integer; submission_count integer; next_revision bigint;
begin
 select response into existing from public.command_receipts where actor_id=p_host_id and command_id=p_command_id; if found then return query select(existing->>'gameSessionId')::uuid,(existing->>'sessionRevision')::bigint; return; end if;
 select session.* into session_record from public.parties party join public.game_sessions session on session.id=party.current_game_session_id where party.host_id=p_host_id and party.id=p_party_id and session.revision=p_expected_revision for update of session; if not found then raise exception using errcode='40001',message='stale_revision'; end if;
 select round.* into active_round from public.picture_caption_rounds round where round.game_session_id=session_record.id and round.state='active' and round.phase='captioning' for update; if not found then raise exception using errcode='40001',message='captioning_closed'; end if;
 select count(*) into eligible_count from public.picture_caption_round_members where round_id=active_round.id; select count(*) into submission_count from public.picture_caption_submissions where round_id=active_round.id;
 if submission_count<eligible_count and not p_confirm_missing then raise exception using errcode='22023',message='close_confirmation_required'; end if;
 perform public.materialize_picture_caption_candidates(active_round.id);
 perform public.start_picture_caption_turn_order(active_round.id);
 update public.picture_caption_rounds set phase='voting',captioning_deadline=null,captioning_hard_deadline=null,paused_remaining_seconds=null,turn_index=0,turn_deadline=now()+make_interval(secs=>voting_seconds) where id=active_round.id;
 update public.game_sessions set revision=revision+1 where id=session_record.id returning revision into next_revision; insert into public.command_receipts values(p_host_id,p_command_id,'close_picture_captioning',jsonb_build_object('gameSessionId',session_record.id,'sessionRevision',next_revision)); return query select session_record.id,next_revision;
end; $$;

create or replace function public.resolve_picture_caption_deadline(p_game_session_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare round_record public.picture_caption_rounds;
begin
    select round.* into round_record
    from public.picture_caption_rounds round
    where round.game_session_id=p_game_session_id and round.state='active'
      and ((round.phase='captioning' and round.captioning_deadline is not null and round.captioning_deadline<=now())
        or (round.phase='voting' and round.turn_deadline is not null and round.turn_deadline<=now()))
    for update;
    if not found then return; end if;

    if round_record.phase='captioning' then
        perform public.materialize_picture_caption_candidates(round_record.id);
        perform public.start_picture_caption_turn_order(round_record.id);
        update public.picture_caption_rounds set phase='voting',captioning_deadline=null,captioning_hard_deadline=null,paused_remaining_seconds=null,turn_index=0,turn_deadline=now()+make_interval(secs=>voting_seconds) where id=round_record.id;
    else
        perform public.advance_picture_caption_turn(round_record.id);
    end if;
    update public.game_sessions set revision=revision+1 where id=p_game_session_id;
end;
$$;

create or replace function public.cast_picture_caption_ballot(p_player_id uuid,p_party_code text,p_command_id uuid,p_expected_revision bigint,p_candidate_id uuid) returns table(game_session_id uuid,session_revision bigint) language plpgsql security definer set search_path='' as $$
declare existing jsonb; session_record public.game_sessions; active_round public.picture_caption_rounds; member_id uuid; next_revision bigint; current_turn_member_id uuid;
begin
 select response into existing from public.command_receipts where actor_id=p_player_id and command_id=p_command_id; if found then return query select(existing->>'gameSessionId')::uuid,(existing->>'sessionRevision')::bigint; return; end if;
 select session.* into session_record from public.parties party join public.game_sessions session on session.id=party.current_game_session_id where party.code=upper(trim(p_party_code)) and session.revision=p_expected_revision for update of session; if not found then raise exception using errcode='40001',message='stale_revision'; end if;
 select round.* into active_round from public.picture_caption_rounds round where round.game_session_id=session_record.id and round.state='active' and round.phase='voting' for update; if not found then raise exception using errcode='40001',message='voting_closed'; end if;
 if active_round.turn_deadline<=now() then perform public.advance_picture_caption_turn(active_round.id); update public.game_sessions set revision=revision+1 where id=session_record.id; raise exception using errcode='40001',message='turn_expired'; end if;
 select member.id into member_id from public.party_members member join public.picture_caption_round_members eligible on eligible.party_member_id=member.id and eligible.round_id=active_round.id where member.player_id=p_player_id and member.party_id=(select id from public.parties where code=upper(trim(p_party_code))); if not found then raise exception using errcode='P0002',message='eligible_member_not_found'; end if;
 select party_member_id into current_turn_member_id from public.picture_caption_turn_order where round_id=active_round.id and position=active_round.turn_index;
 if member_id is distinct from current_turn_member_id then raise exception using errcode='40001',message='not_your_turn'; end if;
 if not exists(select 1 from public.picture_caption_candidates candidate where candidate.id=p_candidate_id and candidate.round_id=active_round.id) then raise exception using errcode='P0002',message='candidate_not_found'; end if;
 insert into public.picture_caption_ballots(round_id,party_member_id,candidate_id) values(active_round.id,member_id,p_candidate_id);
 perform public.advance_picture_caption_turn(active_round.id);
 update public.game_sessions set revision=revision+1 where id=session_record.id returning revision into next_revision; insert into public.command_receipts values(p_player_id,p_command_id,'cast_picture_caption_ballot',jsonb_build_object('gameSessionId',session_record.id,'sessionRevision',next_revision)); return query select session_record.id,next_revision;
exception when unique_violation then raise exception using errcode='40001',message='ballot_already_cast'; end; $$;

create function public.force_skip_picture_caption_turn(p_host_id uuid,p_party_id uuid,p_command_id uuid,p_expected_revision bigint) returns table(game_session_id uuid,session_revision bigint) language plpgsql security definer set search_path='' as $$
declare existing jsonb; session_record public.game_sessions; active_round public.picture_caption_rounds; next_revision bigint;
begin
 select response into existing from public.command_receipts where actor_id=p_host_id and command_id=p_command_id; if found then return query select(existing->>'gameSessionId')::uuid,(existing->>'sessionRevision')::bigint; return; end if;
 select session.* into session_record from public.parties party join public.game_sessions session on session.id=party.current_game_session_id where party.host_id=p_host_id and party.id=p_party_id and session.revision=p_expected_revision for update of session; if not found then raise exception using errcode='40001',message='stale_revision'; end if;
 select round.* into active_round from public.picture_caption_rounds round where round.game_session_id=session_record.id and round.state='active' and round.phase='voting' for update; if not found then raise exception using errcode='40001',message='voting_closed'; end if;
 perform public.advance_picture_caption_turn(active_round.id);
 update public.game_sessions set revision=revision+1 where id=session_record.id returning revision into next_revision; insert into public.command_receipts values(p_host_id,p_command_id,'force_skip_picture_caption_turn',jsonb_build_object('gameSessionId',session_record.id,'sessionRevision',next_revision)); return query select session_record.id,next_revision;
end; $$;

drop function public.close_picture_caption_voting(uuid,uuid,uuid,bigint,boolean);

create or replace function public.commit_picture_caption_voting_result(p_round_id uuid) returns boolean language plpgsql security definer set search_path='' as $$
declare ballot_count integer;
begin
 if exists(select 1 from public.picture_caption_round_results where round_id=p_round_id) then return false; end if;
 select count(*) into ballot_count from public.picture_caption_ballots where round_id=p_round_id;
 update public.picture_caption_candidates candidate set points=(select count(*) from public.picture_caption_ballots ballot where ballot.candidate_id=candidate.id) where candidate.round_id=p_round_id;
 update public.party_members member set score=score+1 from public.picture_caption_candidate_authors author join public.picture_caption_ballots ballot on ballot.candidate_id=author.candidate_id where author.party_member_id=member.id and ballot.round_id=p_round_id;
 update public.party_members member set score=score+1 from public.picture_caption_ballots ballot join public.picture_caption_candidates candidate on candidate.id=ballot.candidate_id where candidate.round_id=p_round_id and candidate.is_official and ballot.party_member_id=member.id;
 insert into public.picture_caption_round_results(round_id,ballot_count) values(p_round_id,ballot_count);
 update public.picture_caption_rounds set state='completed',phase=null,turn_deadline=null,turn_paused_remaining_seconds=null where id=p_round_id;
 return true;
end; $$;

create or replace function public.set_picture_caption_paused(p_host_id uuid,p_party_id uuid,p_command_id uuid,p_expected_revision bigint,p_paused boolean) returns table(game_session_id uuid,session_revision bigint) language plpgsql security definer set search_path='' as $$
declare existing_response jsonb; session_id uuid; next_revision bigint; active_round public.picture_caption_rounds; paused_at timestamptz;
begin
 select response into existing_response from public.command_receipts where actor_id=p_host_id and command_id=p_command_id; if found then return query select(existing_response->>'gameSessionId')::uuid,(existing_response->>'sessionRevision')::bigint; return; end if;
 select session.id into session_id from public.game_sessions session join public.parties party on party.current_game_session_id=session.id where party.id=p_party_id and party.host_id=p_host_id and session.state='live' and session.revision=p_expected_revision for update of session; if not found then raise exception using errcode='40001',message='stale_revision'; end if;
 select round.* into active_round from public.picture_caption_rounds round where round.game_session_id=session_id and round.state='active' for update; if not found then raise exception using errcode='40001',message='stale_revision'; end if;
 if active_round.phase='revealing' then
   select paused_at into paused_at from public.picture_caption_reveals where round_id=active_round.id for update;
   if p_paused and paused_at is null then update public.picture_caption_reveals set paused_at=now() where round_id=active_round.id;
   elsif not p_paused and paused_at is not null then update public.picture_caption_reveals set started_at=started_at+(now()-paused_at),paused_at=null where round_id=active_round.id;
   else raise exception using errcode='40001',message='stale_revision'; end if;
 elsif active_round.phase='captioning' then
   if p_paused then update public.picture_caption_rounds set paused_remaining_seconds=greatest(0,ceil(extract(epoch from captioning_deadline-now()))::integer),captioning_deadline=null where id=active_round.id and captioning_deadline is not null;
   else update public.picture_caption_rounds set captioning_deadline=now()+make_interval(secs=>paused_remaining_seconds),paused_remaining_seconds=null where id=active_round.id and paused_remaining_seconds is not null; end if;
 else
   if p_paused then update public.picture_caption_rounds set turn_paused_remaining_seconds=greatest(0,ceil(extract(epoch from turn_deadline-now()))::integer),turn_deadline=null where id=active_round.id and turn_deadline is not null;
   else update public.picture_caption_rounds set turn_deadline=now()+make_interval(secs=>turn_paused_remaining_seconds),turn_paused_remaining_seconds=null where id=active_round.id and turn_paused_remaining_seconds is not null; end if;
 end if;
 if not found then raise exception using errcode='40001',message='stale_revision'; end if;
 update public.game_sessions set revision=revision+1 where id=session_id returning revision into next_revision; insert into public.command_receipts values(p_host_id,p_command_id,'set_picture_caption_paused',jsonb_build_object('gameSessionId',session_id,'sessionRevision',next_revision)); return query select session_id,next_revision;
end; $$;

revoke all on function public.force_skip_picture_caption_turn(uuid,uuid,uuid,bigint) from public,anon,authenticated;
grant execute on function public.force_skip_picture_caption_turn(uuid,uuid,uuid,bigint) to service_role;

-- Player/Display/Host projections gain Turn order fields and drop caption text from Player, per the minimal-UI and turn-based redesign.
drop function public.player_picture_caption_round_projection(uuid,text);
create function public.player_picture_caption_round_projection(p_player_id uuid,p_party_code text)
returns table(round_id uuid,official_caption text,phase text,captioning_deadline timestamptz,paused_remaining_seconds integer,turn_deadline timestamptz,turn_paused_remaining_seconds integer,is_my_turn boolean,caption_grapheme_limit integer,game_session_id uuid,session_revision bigint)
language sql stable security definer set search_path='' as $$
 select round.id,round.snapshot_official_caption,round.phase,round.captioning_deadline,round.paused_remaining_seconds,round.turn_deadline,round.turn_paused_remaining_seconds,
   exists(select 1 from public.picture_caption_turn_order turn join public.party_members turn_member on turn_member.id=turn.party_member_id where turn.round_id=round.id and turn.position=round.turn_index and turn_member.player_id=p_player_id),
   round.caption_grapheme_limit,session.id,session.revision
 from public.party_members member join public.parties party on party.id=member.party_id join public.game_sessions session on session.id=party.current_game_session_id join public.picture_caption_rounds round on round.game_session_id=session.id and round.state='active' where member.player_id=p_player_id and member.access_status='joined' and party.code=upper(trim(p_party_code));
$$;

drop function public.display_picture_caption_round_projection(uuid,text);
create function public.display_picture_caption_round_projection(p_display_session_id uuid,p_party_code text)
returns table(round_id uuid,official_caption text,phase text,captioning_deadline timestamptz,paused_remaining_seconds integer,turn_deadline timestamptz,turn_paused_remaining_seconds integer,current_turn_nickname text,current_turn_color text,caption_grapheme_limit integer,game_session_id uuid,session_revision bigint)
language sql stable security definer set search_path='' as $$
 select round.id,round.snapshot_official_caption,round.phase,round.captioning_deadline,round.paused_remaining_seconds,round.turn_deadline,round.turn_paused_remaining_seconds,turn_member.nickname,turn_member.color,round.caption_grapheme_limit,session.id,session.revision
 from public.display_sessions display_session join public.parties party on party.id=display_session.party_id join public.game_sessions session on session.id=party.current_game_session_id join public.picture_caption_rounds round on round.game_session_id=session.id and round.state='active'
 left join public.picture_caption_turn_order turn on turn.round_id=round.id and turn.position=round.turn_index
 left join public.party_members turn_member on turn_member.id=turn.party_member_id
 where display_session.id=p_display_session_id and display_session.revoked_at is null and party.code=upper(trim(p_party_code));
$$;

drop function public.player_picture_caption_candidates_projection(uuid,text);
create function public.player_picture_caption_candidates_projection(p_player_id uuid,p_party_code text) returns table(candidate_id uuid,letter text,is_own boolean,own_color text,has_voted boolean,game_session_id uuid,session_revision bigint) language sql stable security definer set search_path='' as $$
 select candidate.id,chr(65+candidate.display_position),exists(select 1 from public.picture_caption_candidate_authors author join public.party_members member on member.id=author.party_member_id where author.candidate_id=candidate.id and member.player_id=p_player_id), (select member.color from public.party_members member where member.player_id=p_player_id and member.party_id=party.id),exists(select 1 from public.picture_caption_ballots ballot join public.party_members member on member.id=ballot.party_member_id where ballot.round_id=round.id and member.player_id=p_player_id),session.id,session.revision from public.parties party join public.game_sessions session on session.id=party.current_game_session_id join public.picture_caption_rounds round on round.game_session_id=session.id and round.state='active' and round.phase='voting' join public.picture_caption_candidates candidate on candidate.round_id=round.id where party.code=upper(trim(p_party_code)) and exists(select 1 from public.party_members member join public.picture_caption_round_members eligible on eligible.party_member_id=member.id and eligible.round_id=round.id where member.player_id=p_player_id and member.party_id=party.id) order by candidate.display_position;
$$;

drop function public.display_picture_caption_candidates_projection(uuid,text);
create function public.display_picture_caption_candidates_projection(p_display_session_id uuid,p_party_code text) returns table(candidate_id uuid,letter text,caption text,voter_colors text[],game_session_id uuid,session_revision bigint) language sql stable security definer set search_path='' as $$
 select candidate.id,chr(65+candidate.display_position),candidate.caption,
   (select array_agg(member.color) from public.picture_caption_ballots ballot join public.party_members member on member.id=ballot.party_member_id where ballot.candidate_id=candidate.id),
   session.id,session.revision
 from public.display_sessions display_session join public.parties party on party.id=display_session.party_id join public.game_sessions session on session.id=party.current_game_session_id join public.picture_caption_rounds round on round.game_session_id=session.id and round.state='active' and round.phase='voting' join public.picture_caption_candidates candidate on candidate.round_id=round.id where display_session.id=p_display_session_id and display_session.revoked_at is null and party.code=upper(trim(p_party_code)) order by candidate.display_position;
$$;

drop function public.host_picture_caption_rounds_projection(uuid,uuid);
create function public.host_picture_caption_rounds_projection(p_host_id uuid, p_party_id uuid)
returns table (round_id uuid, round_position integer, state text, template_id uuid, name text, picture_url text, official_caption text, captioning_seconds integer, voting_seconds integer, caption_grapheme_limit integer, phase text, captioning_deadline timestamptz, paused_remaining_seconds integer, turn_deadline timestamptz, turn_paused_remaining_seconds integer, current_turn_nickname text, eligible_voter_count integer, game_session_id uuid, session_revision bigint)
language sql stable security definer set search_path = '' as $$
 select round.id, round.position, round.state, round.template_id, template.name, coalesce(round.snapshot_picture_url, template.picture_url), coalesce(round.snapshot_official_caption, template.official_caption), round.captioning_seconds, round.voting_seconds, round.caption_grapheme_limit, round.phase, round.captioning_deadline, round.paused_remaining_seconds, round.turn_deadline, round.turn_paused_remaining_seconds, turn_member.nickname, (select count(*)::integer from public.picture_caption_turn_order turn_count where turn_count.round_id=round.id), session.id, session.revision
 from public.parties party join public.game_sessions session on session.id=party.current_game_session_id join public.picture_caption_rounds round on round.game_session_id=session.id left join public.picture_caption_templates template on template.id=round.template_id
 left join public.picture_caption_turn_order turn on turn.round_id=round.id and turn.position=round.turn_index
 left join public.party_members turn_member on turn_member.id=turn.party_member_id
 where party.host_id=p_host_id and party.id=p_party_id order by round.position;
$$;

revoke all on function public.player_picture_caption_round_projection(uuid,text),public.display_picture_caption_round_projection(uuid,text),public.player_picture_caption_candidates_projection(uuid,text),public.display_picture_caption_candidates_projection(uuid,text),public.host_picture_caption_rounds_projection(uuid,uuid) from public,anon,authenticated;
grant execute on function public.player_picture_caption_round_projection(uuid,text),public.display_picture_caption_round_projection(uuid,text),public.player_picture_caption_candidates_projection(uuid,text),public.display_picture_caption_candidates_projection(uuid,text),public.host_picture_caption_rounds_projection(uuid,uuid) to service_role;

-- close_party still referenced the retired voting_deadline/voting_paused_remaining_seconds columns.
create or replace function public.close_party(p_host_id uuid,p_party_id uuid,p_command_id uuid,p_expected_revision bigint)
returns table(game_session_id uuid,session_revision bigint)
language plpgsql security definer set search_path='' as $$
declare existing jsonb; session_record public.game_sessions; next_revision bigint;
begin
    select response into existing from public.command_receipts where actor_id=p_host_id and command_id=p_command_id;
    if found then return query select (existing->>'gameSessionId')::uuid,(existing->>'sessionRevision')::bigint; return; end if;
    select session.* into session_record from public.parties party join public.game_sessions session on session.id=party.current_game_session_id where party.id=p_party_id and party.host_id=p_host_id and session.state <> 'finished' and session.revision=p_expected_revision for update of session;
    if not found then raise exception using errcode='40001',message='stale_revision'; end if;
    update public.picture_caption_rounds round set state='completed',phase=null,captioning_deadline=null,captioning_hard_deadline=null,paused_remaining_seconds=null,turn_index=null,turn_deadline=null,turn_paused_remaining_seconds=null where round.game_session_id=session_record.id and round.state='active';
    update public.game_sessions set state='finished',joining_open=false,revision=revision+1 where id=session_record.id returning revision into next_revision;
    insert into public.command_receipts values(p_host_id,p_command_id,'close_party',jsonb_build_object('gameSessionId',session_record.id,'sessionRevision',next_revision));
    return query select session_record.id,next_revision;
end;
$$;


