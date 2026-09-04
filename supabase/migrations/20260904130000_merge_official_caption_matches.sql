-- Reverses #63: a Player submission whose normalized text exactly matches the Official caption
-- is indistinguishable from it anyway, so it now merges into that one candidate instead of
-- producing a second, identical-looking card. The merged candidate stays is_official with no
-- author (unchanged domain rule), so the matching Player earns no author-side credit for it.
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
 select candidate.id,submission.party_member_id from public.picture_caption_candidates candidate join public.picture_caption_submissions submission on submission.round_id=candidate.round_id and lower(regexp_replace(btrim(submission.caption),'\s+',' ','g'))=candidate.normalized_caption where candidate.round_id=p_round_id and not candidate.is_official;
end; $$;
