create function public.host_picture_caption_rounds_projection(p_host_id uuid, p_party_id uuid)
returns table (round_id uuid, round_position integer, state text, template_id uuid, name text, picture_url text, prompt text, captioning_seconds integer, voting_seconds integer, caption_grapheme_limit integer, phase text, captioning_deadline timestamptz, paused_remaining_seconds integer, game_session_id uuid, session_revision bigint)
language sql stable security definer set search_path = '' as $$
 select round.id, round.position, round.state, round.template_id, template.name, coalesce(round.snapshot_picture_url, template.picture_url), coalesce(round.snapshot_prompt, template.prompt), round.captioning_seconds, round.voting_seconds, round.caption_grapheme_limit, round.phase, round.captioning_deadline, round.paused_remaining_seconds, session.id, session.revision
 from public.parties party join public.game_sessions session on session.id=party.current_game_session_id join public.picture_caption_rounds round on round.game_session_id=session.id left join public.picture_caption_templates template on template.id=round.template_id
 where party.host_id=p_host_id and party.id=p_party_id order by round.position;
$$;

create function public.mutate_picture_caption_round(p_host_id uuid,p_party_id uuid,p_round_id uuid,p_command_id uuid,p_expected_revision bigint,p_action text,p_template_id uuid default null,p_position integer default null,p_captioning_seconds integer default null,p_voting_seconds integer default null,p_caption_grapheme_limit integer default null)
returns table (game_session_id uuid, session_revision bigint)
language plpgsql security definer set search_path='' as $$
declare existing jsonb; session_record public.game_sessions; target public.picture_caption_rounds; next_revision bigint;
begin
 select response into existing from public.command_receipts where actor_id=p_host_id and command_id=p_command_id;
 if found then return query select (existing->>'gameSessionId')::uuid,(existing->>'sessionRevision')::bigint; return; end if;
 select session.* into session_record from public.game_sessions session join public.parties party on party.current_game_session_id=session.id where party.id=p_party_id and party.host_id=p_host_id and session.revision=p_expected_revision for update of session;
 if not found then raise exception using errcode='40001',message='stale_revision'; end if;
 if p_action='add' then
  if not exists(select 1 from public.picture_caption_templates where id=p_template_id) then raise exception using errcode='P0002',message='template_not_found'; end if;
  insert into public.picture_caption_rounds(game_session_id,template_id,position,captioning_seconds,voting_seconds,caption_grapheme_limit) values(session_record.id,p_template_id,coalesce((select max(r.position)+1 from public.picture_caption_rounds r where r.game_session_id=session_record.id),0),coalesce(p_captioning_seconds,120),coalesce(p_voting_seconds,90),coalesce(p_caption_grapheme_limit,120));
 elsif p_action='delete' then delete from public.picture_caption_rounds where id=p_round_id and game_session_id=session_record.id and state='pending';
 elsif p_action='duplicate' then insert into public.picture_caption_rounds(game_session_id,template_id,position,captioning_seconds,voting_seconds,caption_grapheme_limit) select session_record.id,template_id,(select coalesce(max(r.position)+1,0) from public.picture_caption_rounds r where r.game_session_id=session_record.id),captioning_seconds,voting_seconds,caption_grapheme_limit from public.picture_caption_rounds where id=p_round_id and state='pending';
 elsif p_action='edit' then update public.picture_caption_rounds set captioning_seconds=coalesce(p_captioning_seconds,captioning_seconds),voting_seconds=coalesce(p_voting_seconds,voting_seconds),caption_grapheme_limit=coalesce(p_caption_grapheme_limit,caption_grapheme_limit) where id=p_round_id and game_session_id=session_record.id and state='pending';
 elsif p_action='reorder' then update public.picture_caption_rounds set position=p_position where id=p_round_id and game_session_id=session_record.id and state='pending';
 else raise exception using errcode='22023',message='invalid_round_action'; end if;
 if not found and p_action <> 'add' then raise exception using errcode='40001',message='stale_revision'; end if;
 update public.game_sessions set revision=revision+1 where id=session_record.id returning revision into next_revision;
 insert into public.command_receipts values(p_host_id,p_command_id,'mutate_picture_caption_round',jsonb_build_object('gameSessionId',session_record.id,'sessionRevision',next_revision));
 return query select session_record.id,next_revision;
end; $$;

create function public.player_picture_caption_round_projection(p_player_id uuid,p_party_code text)
returns table (picture_url text,prompt text,phase text,captioning_deadline timestamptz,paused_remaining_seconds integer,caption_grapheme_limit integer,game_session_id uuid,session_revision bigint)
language sql stable security definer set search_path='' as $$
 select round.snapshot_picture_url,round.snapshot_prompt,round.phase,round.captioning_deadline,round.paused_remaining_seconds,round.caption_grapheme_limit,session.id,session.revision from public.party_members member join public.parties party on party.id=member.party_id join public.game_sessions session on session.id=party.current_game_session_id join public.picture_caption_rounds round on round.game_session_id=session.id and round.state='active' where member.player_id=p_player_id and member.access_status='joined' and party.code=upper(trim(p_party_code));
$$;
create function public.display_picture_caption_round_projection(p_display_session_id uuid,p_party_code text)
returns table (picture_url text,prompt text,phase text,captioning_deadline timestamptz,paused_remaining_seconds integer,caption_grapheme_limit integer,game_session_id uuid,session_revision bigint)
language sql stable security definer set search_path='' as $$
 select round.snapshot_picture_url,round.snapshot_prompt,round.phase,round.captioning_deadline,round.paused_remaining_seconds,round.caption_grapheme_limit,session.id,session.revision from public.display_sessions display_session join public.parties party on party.id=display_session.party_id join public.game_sessions session on session.id=party.current_game_session_id join public.picture_caption_rounds round on round.game_session_id=session.id and round.state='active' where display_session.id=p_display_session_id and display_session.revoked_at is null and party.code=upper(trim(p_party_code));
$$;
revoke all on function public.host_picture_caption_rounds_projection(uuid,uuid),public.mutate_picture_caption_round(uuid,uuid,uuid,uuid,bigint,text,uuid,integer,integer,integer,integer),public.player_picture_caption_round_projection(uuid,text),public.display_picture_caption_round_projection(uuid,text) from public,anon,authenticated;
grant execute on function public.host_picture_caption_rounds_projection(uuid,uuid),public.mutate_picture_caption_round(uuid,uuid,uuid,uuid,bigint,text,uuid,integer,integer,integer,integer),public.player_picture_caption_round_projection(uuid,text),public.display_picture_caption_round_projection(uuid,text) to service_role;