create table public.picture_caption_round_members (
    round_id uuid not null references public.picture_caption_rounds(id) on delete cascade,
    party_member_id uuid not null references public.party_members(id) on delete restrict,
    score_at_start integer not null,
    primary key (round_id, party_member_id)
);

alter table public.picture_caption_round_members enable row level security;
revoke all on table public.picture_caption_round_members from public, anon, authenticated;

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
  insert into public.picture_caption_rounds(game_session_id,template_id,position,captioning_seconds,voting_seconds,caption_grapheme_limit) values(session_record.id,p_template_id,coalesce((select max(round.position)+1 from public.picture_caption_rounds round where round.game_session_id=session_record.id),0),coalesce(p_captioning_seconds,120),coalesce(p_voting_seconds,90),coalesce(p_caption_grapheme_limit,120));
 else
  select round.* into target from public.picture_caption_rounds round where round.id=p_round_id and round.game_session_id=session_record.id and round.state='pending' for update;
  if not found then raise exception using errcode='40001',message='stale_revision'; end if;
  if p_action='delete' then
   delete from public.picture_caption_rounds where id=target.id;
  elsif p_action='duplicate' then
   insert into public.picture_caption_rounds(game_session_id,template_id,position,captioning_seconds,voting_seconds,caption_grapheme_limit) values(session_record.id,target.template_id,(select coalesce(max(round.position)+1,0) from public.picture_caption_rounds round where round.game_session_id=session_record.id),target.captioning_seconds,target.voting_seconds,target.caption_grapheme_limit);
  elsif p_action='edit' then
   if p_template_id is not null and not exists(select 1 from public.picture_caption_templates template where template.id=p_template_id) then raise exception using errcode='P0002',message='template_not_found'; end if;
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

create or replace function public.start_picture_caption_session(p_host_id uuid, p_party_id uuid, p_command_id uuid, p_expected_revision bigint)
returns table (round_id uuid, game_session_id uuid, session_revision bigint, captioning_deadline timestamptz)
language plpgsql security definer set search_path = '' as $$
declare existing_response jsonb; session_record public.game_sessions; pending_round public.picture_caption_rounds; activated_round public.picture_caption_rounds; template_record public.picture_caption_templates;
begin
 select response into existing_response from public.command_receipts where actor_id=p_host_id and command_id=p_command_id;
 if found then return query select (existing_response->>'roundId')::uuid,(existing_response->>'gameSessionId')::uuid,(existing_response->>'sessionRevision')::bigint,(existing_response->>'captioningDeadline')::timestamptz; return; end if;
 select session.* into session_record from public.game_sessions session join public.parties party on party.current_game_session_id=session.id where party.id=p_party_id and party.host_id=p_host_id and session.state='lobby' and session.revision=p_expected_revision for update of session;
 if not found then raise exception using errcode='40001',message='stale_revision'; end if;
 if exists(select 1 from public.party_members member where member.party_id=p_party_id and member.access_status='joined' and not member.ready) then raise exception using errcode='40001',message='players_not_ready'; end if;
 select round.* into pending_round from public.picture_caption_rounds round where round.game_session_id=session_record.id and round.state='pending' order by round.position limit 1 for update;
 if not found then raise exception using errcode='40001',message='no_pending_round'; end if;
 select template.* into template_record from public.picture_caption_templates template where template.id=pending_round.template_id for key share;
 if not found then raise exception using errcode='40001',message='no_pending_round'; end if;
 update public.picture_caption_rounds round set state='active',phase='captioning',snapshot_template_revision=template_record.revision,snapshot_picture_url=template_record.picture_url,snapshot_prompt=template_record.prompt,captioning_deadline=now()+make_interval(secs=>round.captioning_seconds) where round.id=pending_round.id returning round.* into activated_round;
 insert into public.picture_caption_round_members(round_id,party_member_id,score_at_start) select activated_round.id,member.id,member.score from public.party_members member where member.party_id=p_party_id and member.access_status='joined';
 update public.game_sessions set state='live',joining_open=false,revision=revision+1 where id=session_record.id returning revision into session_record.revision;
 insert into public.command_receipts values(p_host_id,p_command_id,'start_picture_caption_session',jsonb_build_object('roundId',activated_round.id,'gameSessionId',session_record.id,'sessionRevision',session_record.revision,'captioningDeadline',activated_round.captioning_deadline));
 return query select activated_round.id,session_record.id,session_record.revision,activated_round.captioning_deadline;
end; $$;

create or replace function public.host_picture_caption_round_picture(p_host_id uuid,p_party_id uuid,p_round_id uuid)
returns text language sql stable security definer set search_path='' as $$
 select coalesce(round.snapshot_picture_url,template.picture_url) from public.parties party join public.game_sessions session on session.id=party.current_game_session_id join public.picture_caption_rounds round on round.game_session_id=session.id left join public.picture_caption_templates template on template.id=round.template_id where party.host_id=p_host_id and party.id=p_party_id and round.id=p_round_id;
$$;
create or replace function public.player_picture_caption_round_picture(p_player_id uuid,p_party_code text,p_round_id uuid)
returns text language sql stable security definer set search_path='' as $$
 select round.snapshot_picture_url from public.party_members member join public.parties party on party.id=member.party_id join public.game_sessions session on session.id=party.current_game_session_id join public.picture_caption_rounds round on round.game_session_id=session.id and round.state='active' where member.player_id=p_player_id and member.access_status='joined' and party.code=upper(trim(p_party_code)) and round.id=p_round_id;
$$;
create or replace function public.display_picture_caption_round_picture(p_display_session_id uuid,p_party_code text,p_round_id uuid)
returns text language sql stable security definer set search_path='' as $$
 select round.snapshot_picture_url from public.display_sessions display_session join public.parties party on party.id=display_session.party_id join public.game_sessions session on session.id=party.current_game_session_id join public.picture_caption_rounds round on round.game_session_id=session.id and round.state='active' where display_session.id=p_display_session_id and display_session.revoked_at is null and party.code=upper(trim(p_party_code)) and round.id=p_round_id;
$$;

revoke all on function public.mutate_picture_caption_round(uuid,uuid,uuid,uuid,bigint,text,uuid,integer,integer,integer,integer),public.start_picture_caption_session(uuid,uuid,uuid,bigint),public.host_picture_caption_round_picture(uuid,uuid,uuid),public.player_picture_caption_round_picture(uuid,text,uuid),public.display_picture_caption_round_picture(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.mutate_picture_caption_round(uuid,uuid,uuid,uuid,bigint,text,uuid,integer,integer,integer,integer),public.start_picture_caption_session(uuid,uuid,uuid,bigint),public.host_picture_caption_round_picture(uuid,uuid,uuid),public.player_picture_caption_round_picture(uuid,text,uuid),public.display_picture_caption_round_picture(uuid,text,uuid) to service_role;