alter table public.picture_caption_candidates add column is_official boolean not null default false;
alter table public.picture_caption_candidates drop constraint picture_caption_candidates_round_id_normalized_caption_key;
create unique index picture_caption_candidates_round_normalized_caption_idx on public.picture_caption_candidates (round_id, normalized_caption) where not is_official;

create or replace function public.materialize_picture_caption_candidates(p_round_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 insert into public.picture_caption_candidates(round_id,caption,normalized_caption,display_position,is_official)
 select p_round_id, candidate.caption, candidate.normalized_caption, row_number() over (order by md5(p_round_id::text||candidate.normalized_caption||candidate.is_official::text))::integer-1, candidate.is_official
 from (
  select min(submission.caption) as caption, lower(regexp_replace(btrim(submission.caption),'\s+',' ','g')) as normalized_caption, false as is_official
  from public.picture_caption_submissions submission
  where submission.round_id=p_round_id
  group by lower(regexp_replace(btrim(submission.caption),'\s+',' ','g'))
  union all
  select round.snapshot_official_caption, lower(regexp_replace(btrim(round.snapshot_official_caption),'\s+',' ','g')), true
  from public.picture_caption_rounds round
  where round.id=p_round_id
 ) candidate;
 insert into public.picture_caption_candidate_authors(candidate_id,party_member_id)
 select candidate.id,submission.party_member_id from public.picture_caption_candidates candidate join public.picture_caption_submissions submission on submission.round_id=candidate.round_id and lower(regexp_replace(btrim(submission.caption),'\s+',' ','g'))=candidate.normalized_caption where candidate.round_id=p_round_id and not candidate.is_official;
end; $$;

create or replace function public.commit_picture_caption_voting_result(p_round_id uuid) returns boolean language plpgsql security definer set search_path='' as $$
declare ballot_count integer;
begin
 if exists(select 1 from public.picture_caption_round_results where round_id=p_round_id) then return false; end if;
 select count(*) into ballot_count from public.picture_caption_ballots where round_id=p_round_id;
 update public.picture_caption_candidates candidate set points=(select count(*) from public.picture_caption_ballots ballot where ballot.candidate_id=candidate.id) where candidate.round_id=p_round_id;
 update public.party_members member set score=score+1 from public.picture_caption_candidate_authors author join public.picture_caption_ballots ballot on ballot.candidate_id=author.candidate_id where author.party_member_id=member.id and ballot.round_id=p_round_id;
 update public.party_members member set score=score+1 from public.picture_caption_ballots ballot join public.picture_caption_candidates candidate on candidate.id=ballot.candidate_id where candidate.round_id=p_round_id and candidate.is_official and ballot.party_member_id=member.id;
 insert into public.picture_caption_round_results(round_id,ballot_count) values(p_round_id,ballot_count);
 update public.picture_caption_rounds set state='completed',phase=null,voting_deadline=null,voting_paused_remaining_seconds=null where id=p_round_id;
 return true;
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
 update public.picture_caption_rounds set phase='voting',captioning_deadline=null,captioning_hard_deadline=null,paused_remaining_seconds=null,voting_deadline=now()+make_interval(secs=>voting_seconds) where id=active_round.id;
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
        or (round.phase='voting' and round.voting_deadline is not null and round.voting_deadline<=now()))
    for update;
    if not found then return; end if;

    if round_record.phase='captioning' then
        perform public.materialize_picture_caption_candidates(round_record.id);
        update public.picture_caption_rounds set phase='voting',captioning_deadline=null,captioning_hard_deadline=null,paused_remaining_seconds=null,voting_deadline=now()+make_interval(secs=>voting_seconds) where id=round_record.id;
    else
        perform public.commit_picture_caption_voting_result(round_record.id);
    end if;
    update public.game_sessions set revision=revision+1 where id=p_game_session_id;
end;
$$;
