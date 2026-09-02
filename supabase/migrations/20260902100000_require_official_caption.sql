create or replace function public.create_picture_caption_template(
    p_admin_id uuid, p_command_id uuid, p_name text, p_picture_url text, p_official_caption text
)
returns table (template_id uuid, name text, picture_url text, official_caption text, revision bigint, created_at timestamptz, updated_at timestamptz)
language plpgsql security definer set search_path = ''
as $$
declare existing_response jsonb; created_template public.picture_caption_templates; command_response jsonb;
begin
    if not public.content_admin_check(p_admin_id) then raise exception using errcode = '42501', message = 'not_content_admin'; end if;
    select response into existing_response from public.command_receipts where actor_id = p_admin_id and command_id = p_command_id;
    if found then return query select (existing_response->>'templateId')::uuid, existing_response->>'name', existing_response->>'pictureUrl', existing_response->>'officialCaption', (existing_response->>'revision')::bigint, (existing_response->>'createdAt')::timestamptz, (existing_response->>'updatedAt')::timestamptz; return; end if;
    if p_official_caption is null or btrim(p_official_caption) = '' then raise exception using errcode = '22023', message = 'official_caption_required'; end if;
    insert into public.picture_caption_templates (created_by_user_id, name, picture_url, official_caption) values (p_admin_id, p_name, p_picture_url, p_official_caption) returning * into created_template;
    command_response := jsonb_build_object('templateId', created_template.id, 'name', created_template.name, 'pictureUrl', created_template.picture_url, 'officialCaption', created_template.official_caption, 'revision', created_template.revision, 'createdAt', created_template.created_at, 'updatedAt', created_template.updated_at);
    insert into public.command_receipts (actor_id, command_id, command_name, response) values (p_admin_id, p_command_id, 'create_picture_caption_template', command_response);
    return query select created_template.id, created_template.name, created_template.picture_url, created_template.official_caption, created_template.revision, created_template.created_at, created_template.updated_at;
end;
$$;

create or replace function public.update_picture_caption_template(
    p_admin_id uuid, p_command_id uuid, p_template_id uuid, p_name text, p_picture_url text, p_official_caption text, p_expected_revision bigint
)
returns table (template_id uuid, name text, picture_url text, official_caption text, revision bigint, created_at timestamptz, updated_at timestamptz)
language plpgsql security definer set search_path = ''
as $$
declare existing_response jsonb; updated_template public.picture_caption_templates; command_response jsonb;
begin
    if not public.content_admin_check(p_admin_id) then raise exception using errcode = '42501', message = 'not_content_admin'; end if;
    select response into existing_response from public.command_receipts where actor_id = p_admin_id and command_id = p_command_id;
    if found then return query select (existing_response->>'templateId')::uuid, existing_response->>'name', existing_response->>'pictureUrl', existing_response->>'officialCaption', (existing_response->>'revision')::bigint, (existing_response->>'createdAt')::timestamptz, (existing_response->>'updatedAt')::timestamptz; return; end if;
    if p_official_caption is null or btrim(p_official_caption) = '' then raise exception using errcode = '22023', message = 'official_caption_required'; end if;
    update public.picture_caption_templates as template set name = p_name, picture_url = p_picture_url, official_caption = p_official_caption, revision = template.revision + 1, updated_at = now() where template.id = p_template_id and template.revision = p_expected_revision returning template.* into updated_template;
    if not found then
        if exists (select 1 from public.picture_caption_templates where id = p_template_id) then raise exception using errcode = '40001', message = 'stale_revision'; end if;
        raise exception using errcode = 'P0002', message = 'template_not_found';
    end if;
    command_response := jsonb_build_object('templateId', updated_template.id, 'name', updated_template.name, 'pictureUrl', updated_template.picture_url, 'officialCaption', updated_template.official_caption, 'revision', updated_template.revision, 'createdAt', updated_template.created_at, 'updatedAt', updated_template.updated_at);
    insert into public.command_receipts (actor_id, command_id, command_name, response) values (p_admin_id, p_command_id, 'update_picture_caption_template', command_response);
    return query select updated_template.id, updated_template.name, updated_template.picture_url, updated_template.official_caption, updated_template.revision, updated_template.created_at, updated_template.updated_at;
end;
$$;

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

create or replace function public.start_picture_caption_session(p_host_id uuid, p_party_id uuid, p_command_id uuid, p_expected_revision bigint)
returns table (round_id uuid, game_session_id uuid, session_revision bigint, captioning_deadline timestamptz)
language plpgsql security definer set search_path = '' as $$
declare existing_response jsonb; session_record public.game_sessions; pending_round public.picture_caption_rounds; activated_round public.picture_caption_rounds; template_record public.picture_caption_templates;
begin
 select response into existing_response from public.command_receipts where actor_id=p_host_id and command_id=p_command_id;
 if found then return query select (existing_response->>'roundId')::uuid,(existing_response->>'gameSessionId')::uuid,(existing_response->>'sessionRevision')::bigint,(existing_response->>'captioningDeadline')::timestamptz; return; end if;
 select session.* into session_record from public.game_sessions session join public.parties party on party.current_game_session_id=session.id where party.id=p_party_id and party.host_id=p_host_id and session.state='lobby' and session.revision=p_expected_revision for update of session;
 if not found then raise exception using errcode='40001',message='stale_revision'; end if;
 if not exists(select 1 from public.party_members member where member.party_id=p_party_id and member.access_status='joined') then raise exception using errcode='40001',message='no_joined_players'; end if;
 if exists(select 1 from public.party_members member where member.party_id=p_party_id and member.access_status='joined' and not member.ready) then raise exception using errcode='40001',message='players_not_ready'; end if;
 select round.* into pending_round from public.picture_caption_rounds round where round.game_session_id=session_record.id and round.state='pending' order by round.position limit 1 for update;
 if not found then raise exception using errcode='40001',message='no_pending_round'; end if;
 select template.* into template_record from public.picture_caption_templates template where template.id=pending_round.template_id for key share;
 if not found then raise exception using errcode='40001',message='no_pending_round'; end if;
 if template_record.official_caption is null or btrim(template_record.official_caption)='' then raise exception using errcode='40001',message='official_caption_required'; end if;
 update public.picture_caption_rounds round set state='active',phase='captioning',snapshot_template_revision=template_record.revision,snapshot_picture_url=template_record.picture_url,snapshot_official_caption=template_record.official_caption,captioning_deadline=now()+make_interval(secs=>round.captioning_seconds),captioning_hard_deadline=now()+make_interval(secs=>round.captioning_seconds) where round.id=pending_round.id returning round.* into activated_round;
 insert into public.picture_caption_round_members(round_id,party_member_id,score_at_start) select activated_round.id,member.id,member.score from public.party_members member where member.party_id=p_party_id and member.access_status='joined';
 update public.game_sessions set state='live',joining_open=false,revision=revision+1 where id=session_record.id returning revision into session_record.revision;
 insert into public.command_receipts values(p_host_id,p_command_id,'start_picture_caption_session',jsonb_build_object('roundId',activated_round.id,'gameSessionId',session_record.id,'sessionRevision',session_record.revision,'captioningDeadline',activated_round.captioning_deadline));
 return query select activated_round.id,session_record.id,session_record.revision,activated_round.captioning_deadline;
end; $$;
