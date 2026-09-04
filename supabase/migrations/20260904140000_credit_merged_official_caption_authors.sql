-- The merge in 20260904130000 left the merged candidate authorless, matching the old
-- "Official caption has no author" rule. Per further playtest feedback, a Player whose caption
-- matches the Official caption should be credited exactly like any other co-author: displayed
-- alongside "Official" in Reveal, and scored 1 point per Ballot cast for the merged candidate,
-- stacking with the Official caption's own per-voter point.
create or replace function public.materialize_picture_caption_candidates(p_round_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 insert into public.picture_caption_candidates(round_id,caption,normalized_caption,display_position,is_official)
 select p_round_id, candidate.caption, candidate.normalized_caption, row_number() over (order by md5(p_round_id::text||candidate.normalized_caption||candidate.is_official::text))::integer-1, candidate.is_official
 from (
  select min(submission.caption) as caption, lower(regexp_replace(btrim(submission.caption),'\s+',' ','g')) as normalized_caption, false as is_official
  from public.picture_caption_submissions submission
  where submission.round_id=p_round_id
    and lower(regexp_replace(btrim(submission.caption),'\s+',' ','g')) <> (select lower(regexp_replace(btrim(round.snapshot_official_caption),'\s+',' ','g')) from public.picture_caption_rounds round where round.id=p_round_id)
  group by lower(regexp_replace(btrim(submission.caption),'\s+',' ','g'))
  union all
  select round.snapshot_official_caption, lower(regexp_replace(btrim(round.snapshot_official_caption),'\s+',' ','g')), true
  from public.picture_caption_rounds round
  where round.id=p_round_id
 ) candidate;
 insert into public.picture_caption_candidate_authors(candidate_id,party_member_id)
 select candidate.id,submission.party_member_id from public.picture_caption_candidates candidate join public.picture_caption_submissions submission on submission.round_id=candidate.round_id and lower(regexp_replace(btrim(submission.caption),'\s+',' ','g'))=candidate.normalized_caption where candidate.round_id=p_round_id;
end; $$;
