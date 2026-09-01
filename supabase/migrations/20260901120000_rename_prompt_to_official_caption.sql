alter table public.picture_caption_templates rename column prompt to official_caption;
alter table public.picture_caption_templates rename constraint picture_caption_templates_prompt_check to picture_caption_templates_official_caption_check;
alter table public.picture_caption_rounds rename column snapshot_prompt to snapshot_official_caption;

drop function public.create_picture_caption_template(uuid, uuid, text, text, text);
create function public.create_picture_caption_template(
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
    insert into public.picture_caption_templates (created_by_user_id, name, picture_url, official_caption) values (p_admin_id, p_name, p_picture_url, p_official_caption) returning * into created_template;
    command_response := jsonb_build_object('templateId', created_template.id, 'name', created_template.name, 'pictureUrl', created_template.picture_url, 'officialCaption', created_template.official_caption, 'revision', created_template.revision, 'createdAt', created_template.created_at, 'updatedAt', created_template.updated_at);
    insert into public.command_receipts (actor_id, command_id, command_name, response) values (p_admin_id, p_command_id, 'create_picture_caption_template', command_response);
    return query select created_template.id, created_template.name, created_template.picture_url, created_template.official_caption, created_template.revision, created_template.created_at, created_template.updated_at;
end;
$$;

drop function public.update_picture_caption_template(uuid, uuid, uuid, text, text, text, bigint);
create function public.update_picture_caption_template(
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

drop function public.picture_caption_templates_projection(uuid);
create function public.picture_caption_templates_projection(p_admin_id uuid)
returns table (template_id uuid, name text, picture_url text, official_caption text, revision bigint, created_at timestamptz, updated_at timestamptz)
language sql stable security definer set search_path = ''
as $$ select id, name, picture_url, official_caption, revision, created_at, updated_at from public.picture_caption_templates where public.content_admin_check(p_admin_id) order by created_at desc; $$;

drop function public.host_picture_caption_template_catalog(uuid,uuid);
create function public.host_picture_caption_template_catalog(p_host_id uuid,p_party_id uuid)
returns table (template_id uuid,name text,official_caption text,revision bigint)
language sql stable security definer set search_path='' as $$
 select template.id,template.name,template.official_caption,template.revision from public.picture_caption_templates template where exists(select 1 from public.parties party where party.id=p_party_id and party.host_id=p_host_id) order by template.name;
$$;

drop function public.host_picture_caption_rounds_projection(uuid,uuid);
create function public.host_picture_caption_rounds_projection(p_host_id uuid, p_party_id uuid)
returns table (round_id uuid, round_position integer, state text, template_id uuid, name text, picture_url text, official_caption text, captioning_seconds integer, voting_seconds integer, caption_grapheme_limit integer, phase text, captioning_deadline timestamptz, paused_remaining_seconds integer, game_session_id uuid, session_revision bigint)
language sql stable security definer set search_path = '' as $$
 select round.id, round.position, round.state, round.template_id, template.name, coalesce(round.snapshot_picture_url, template.picture_url), coalesce(round.snapshot_official_caption, template.official_caption), round.captioning_seconds, round.voting_seconds, round.caption_grapheme_limit, round.phase, round.captioning_deadline, round.paused_remaining_seconds, session.id, session.revision
 from public.parties party join public.game_sessions session on session.id=party.current_game_session_id join public.picture_caption_rounds round on round.game_session_id=session.id left join public.picture_caption_templates template on template.id=round.template_id
 where party.host_id=p_host_id and party.id=p_party_id order by round.position;
$$;

drop function public.player_picture_caption_round_projection(uuid,text);
create function public.player_picture_caption_round_projection(p_player_id uuid,p_party_code text)
returns table (round_id uuid,official_caption text,phase text,captioning_deadline timestamptz,paused_remaining_seconds integer,caption_grapheme_limit integer,game_session_id uuid,session_revision bigint)
language sql stable security definer set search_path='' as $$
 select round.id,round.snapshot_official_caption,round.phase,round.captioning_deadline,round.paused_remaining_seconds,round.caption_grapheme_limit,session.id,session.revision from public.party_members member join public.parties party on party.id=member.party_id join public.game_sessions session on session.id=party.current_game_session_id join public.picture_caption_rounds round on round.game_session_id=session.id and round.state='active' where member.player_id=p_player_id and member.access_status='joined' and party.code=upper(trim(p_party_code));
$$;

drop function public.display_picture_caption_round_projection(uuid,text);
create function public.display_picture_caption_round_projection(p_display_session_id uuid,p_party_code text)
returns table (round_id uuid,official_caption text,phase text,captioning_deadline timestamptz,paused_remaining_seconds integer,caption_grapheme_limit integer,game_session_id uuid,session_revision bigint)
language sql stable security definer set search_path='' as $$
 select round.id,round.snapshot_official_caption,round.phase,round.captioning_deadline,round.paused_remaining_seconds,round.caption_grapheme_limit,session.id,session.revision from public.display_sessions display_session join public.parties party on party.id=display_session.party_id join public.game_sessions session on session.id=party.current_game_session_id join public.picture_caption_rounds round on round.game_session_id=session.id and round.state='active' where display_session.id=p_display_session_id and display_session.revoked_at is null and party.code=upper(trim(p_party_code));
$$;

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
 update public.picture_caption_rounds round set state='active',phase='captioning',snapshot_template_revision=template_record.revision,snapshot_picture_url=template_record.picture_url,snapshot_official_caption=template_record.official_caption,captioning_deadline=now()+make_interval(secs=>round.captioning_seconds),captioning_hard_deadline=now()+make_interval(secs=>round.captioning_seconds) where round.id=pending_round.id returning round.* into activated_round;
 insert into public.picture_caption_round_members(round_id,party_member_id,score_at_start) select activated_round.id,member.id,member.score from public.party_members member where member.party_id=p_party_id and member.access_status='joined';
 update public.game_sessions set state='live',joining_open=false,revision=revision+1 where id=session_record.id returning revision into session_record.revision;
 insert into public.command_receipts values(p_host_id,p_command_id,'start_picture_caption_session',jsonb_build_object('roundId',activated_round.id,'gameSessionId',session_record.id,'sessionRevision',session_record.revision,'captioningDeadline',activated_round.captioning_deadline));
 return query select activated_round.id,session_record.id,session_record.revision,activated_round.captioning_deadline;
end; $$;

-- DROP FUNCTION clears prior grants, so every renamed function's privileges are restated here to match what it had before.
revoke all on function public.create_picture_caption_template(uuid, uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.update_picture_caption_template(uuid, uuid, uuid, text, text, text, bigint) from public, anon, authenticated;
revoke all on function public.picture_caption_templates_projection(uuid) from public, anon, authenticated;
grant execute on function public.create_picture_caption_template(uuid, uuid, text, text, text) to service_role;
grant execute on function public.update_picture_caption_template(uuid, uuid, uuid, text, text, text, bigint) to service_role;
grant execute on function public.picture_caption_templates_projection(uuid) to service_role;

revoke all on function public.host_picture_caption_rounds_projection(uuid,uuid),public.player_picture_caption_round_projection(uuid,text),public.display_picture_caption_round_projection(uuid,text) from public,anon,authenticated;
grant execute on function public.host_picture_caption_rounds_projection(uuid,uuid),public.player_picture_caption_round_projection(uuid,text),public.display_picture_caption_round_projection(uuid,text) to service_role;

revoke all on function public.host_picture_caption_template_catalog(uuid,uuid) from public,anon,authenticated;
grant execute on function public.host_picture_caption_template_catalog(uuid,uuid) to service_role;
