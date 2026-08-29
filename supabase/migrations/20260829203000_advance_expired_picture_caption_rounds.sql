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
        if exists(select 1 from public.picture_caption_submissions submission where submission.round_id=round_record.id) then
            perform public.materialize_picture_caption_candidates(round_record.id);
            update public.picture_caption_rounds set phase='voting',captioning_deadline=null,captioning_hard_deadline=null,paused_remaining_seconds=null,voting_deadline=now()+make_interval(secs=>voting_seconds) where id=round_record.id;
        else
            update public.picture_caption_rounds set state='completed',phase=null,captioning_deadline=null,captioning_hard_deadline=null,paused_remaining_seconds=null where id=round_record.id;
        end if;
    else
        perform public.commit_picture_caption_voting_result(round_record.id);
    end if;
    update public.game_sessions set revision=revision+1 where id=p_game_session_id;
end;
$$;

revoke all on function public.resolve_picture_caption_deadline(uuid) from public,anon,authenticated;
grant execute on function public.resolve_picture_caption_deadline(uuid) to service_role;