-- Raise the default per-player voting turn length from 30 to 300 seconds, per host feedback.
alter table public.picture_caption_rounds drop constraint picture_caption_rounds_voting_seconds_check;
alter table public.picture_caption_rounds add constraint picture_caption_rounds_voting_seconds_check check (voting_seconds between 5 and 600);
alter table public.picture_caption_rounds alter column voting_seconds set default 300;

create or replace function public.mutate_picture_caption_round(p_host_id uuid,p_party_id uuid,p_round_id uuid,p_command_id uuid,p_expected_revision bigint,p_action text,p_template_id uuid default null,p_position integer default null,p_captioning_seconds integer default null,p_voting_seconds integer default null,p_caption_grapheme_limit integer default null)
returns table (game_session_id uuid, session_revision bigint)
language plpgsql security definer set search_path='' as $$
declare existing jsonb; session_record public.game_sessions; target public.picture_caption_rounds; next_revision bigint; target_position integer; pending_count integer;
begin
 select response into existing from public.command_receipts where actor_id=p_host_id and command_id=p_command_id;
 if found then return query select (existing->>'gameSessionId')::uuid,(existing->>'sessionRevision')::bigint; return; end if;
 select session.* into session_record from public.game_sessions session join public.parties party on party.current_game_session_id=session.id where party.id=p_party_id and party.host_id=p_host_id and session.revision=p_expected_revision for update of session;
 if not found then raise exception using errcode='40001',message='stale_revision'; end if;
 if p_action not in ('add','delete','duplicate','edit','reorder') then raise exception using errcode='22023',message='invalid_round_action'; end if;
 if session_record.state in ('setup','lobby') then null;
 elsif session_record.state='live' and p_action='add' and not exists(select 1 from public.picture_caption_rounds round where round.game_session_id=session_record.id and round.state='active') then null;
 else raise exception using errcode='40001',message='round_configuration_unavailable'; end if;
 if p_action='add' then
  if p_template_id is null or not exists(select 1 from public.picture_caption_templates template where template.id=p_template_id) then raise exception using errcode='P0002',message='template_not_found'; end if;
  if exists(select 1 from public.picture_caption_templates template where template.id=p_template_id and (template.official_caption is null or btrim(template.official_caption)='')) then raise exception using errcode='22023',message='official_caption_required'; end if;
  insert into public.picture_caption_rounds(game_session_id,template_id,position,captioning_seconds,voting_seconds,caption_grapheme_limit) values(session_record.id,p_template_id,coalesce((select max(round.position)+1 from public.picture_caption_rounds round where round.game_session_id=session_record.id),0),coalesce(p_captioning_seconds,120),coalesce(p_voting_seconds,300),coalesce(p_caption_grapheme_limit,75));
 else
  select round.* into target from public.picture_caption_rounds round where round.id=p_round_id and round.game_session_id=session_record.id and round.state='pending' for update;
  if not found then raise exception using errcode='40001',message='stale_revision'; end if;
  if p_action='delete' then
   delete from public.picture_caption_rounds where id=target.id;
  elsif p_action='duplicate' then
   insert into public.picture_caption_rounds(game_session_id,template_id,position,captioning_seconds,voting_seconds,caption_grapheme_limit) values(session_record.id,target.template_id,(select coalesce(max(round.position)+1,0) from public.picture_caption_rounds round where round.game_session_id=session_record.id),target.captioning_seconds,target.voting_seconds,target.caption_grapheme_limit);
  elsif p_action='edit' then
   if p_template_id is not null and not exists(select 1 from public.picture_caption_templates template where template.id=p_template_id) then raise exception using errcode='P0002',message='template_not_found'; end if;
   if p_template_id is not null and exists(select 1 from public.picture_caption_templates template where template.id=p_template_id and (template.official_caption is null or btrim(template.official_caption)='')) then raise exception using errcode='22023',message='official_caption_required'; end if;
   update public.picture_caption_rounds set template_id=coalesce(p_template_id,template_id),captioning_seconds=coalesce(p_captioning_seconds,captioning_seconds),voting_seconds=coalesce(p_voting_seconds,voting_seconds),caption_grapheme_limit=coalesce(p_caption_grapheme_limit,caption_grapheme_limit) where id=target.id;
  else
   select count(*) into pending_count from public.picture_caption_rounds round where round.game_session_id=session_record.id and round.state='pending';
   if p_position is null or p_position < 0 or p_position >= pending_count then raise exception using errcode='22023',message='invalid_round_position'; end if;
   target_position := p_position;
   if target.position <> target_position then
    update public.picture_caption_rounds set position=position+1000000 where id=target.id;
    if target_position < target.position then
     update public.picture_caption_rounds set position=position+1000000 where game_session_id=session_record.id and state='pending' and position>=target_position and position<target.position;
     update public.picture_caption_rounds set position=position-999999 where game_session_id=session_record.id and state='pending' and position>=1000000 and position<2000000;
    else
     update public.picture_caption_rounds set position=position+1000000 where game_session_id=session_record.id and state='pending' and position>target.position and position<=target_position;
     update public.picture_caption_rounds set position=position-1000001 where game_session_id=session_record.id and state='pending' and position>=1000000 and position<2000000;
    end if;
    update public.picture_caption_rounds set position=target_position where id=target.id;
   end if;
  end if;
 end if;
 update public.game_sessions set revision=revision+1 where id=session_record.id returning revision into next_revision;
 insert into public.command_receipts values(p_host_id,p_command_id,'mutate_picture_caption_round',jsonb_build_object('gameSessionId',session_record.id,'sessionRevision',next_revision));
 return query select session_record.id,next_revision;
end; $$;
