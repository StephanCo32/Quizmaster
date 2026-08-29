drop function public.player_picture_caption_round_projection(uuid,text);
drop function public.display_picture_caption_round_projection(uuid,text);

create function public.host_picture_caption_template_catalog(p_host_id uuid,p_party_id uuid)
returns table (template_id uuid,name text,prompt text,revision bigint)
language sql stable security definer set search_path='' as $$
 select template.id,template.name,template.prompt,template.revision from public.picture_caption_templates template where exists(select 1 from public.parties party where party.id=p_party_id and party.host_id=p_host_id) order by template.name;
$$;
create function public.player_picture_caption_round_projection(p_player_id uuid,p_party_code text)
returns table (round_id uuid,prompt text,phase text,captioning_deadline timestamptz,paused_remaining_seconds integer,caption_grapheme_limit integer,game_session_id uuid,session_revision bigint)
language sql stable security definer set search_path='' as $$
 select round.id,round.snapshot_prompt,round.phase,round.captioning_deadline,round.paused_remaining_seconds,round.caption_grapheme_limit,session.id,session.revision from public.party_members member join public.parties party on party.id=member.party_id join public.game_sessions session on session.id=party.current_game_session_id join public.picture_caption_rounds round on round.game_session_id=session.id and round.state='active' where member.player_id=p_player_id and member.access_status='joined' and party.code=upper(trim(p_party_code));
$$;
create function public.display_picture_caption_round_projection(p_display_session_id uuid,p_party_code text)
returns table (round_id uuid,prompt text,phase text,captioning_deadline timestamptz,paused_remaining_seconds integer,caption_grapheme_limit integer,game_session_id uuid,session_revision bigint)
language sql stable security definer set search_path='' as $$
 select round.id,round.snapshot_prompt,round.phase,round.captioning_deadline,round.paused_remaining_seconds,round.caption_grapheme_limit,session.id,session.revision from public.display_sessions display_session join public.parties party on party.id=display_session.party_id join public.game_sessions session on session.id=party.current_game_session_id join public.picture_caption_rounds round on round.game_session_id=session.id and round.state='active' where display_session.id=p_display_session_id and display_session.revoked_at is null and party.code=upper(trim(p_party_code));
$$;
revoke all on function public.host_picture_caption_template_catalog(uuid,uuid),public.player_picture_caption_round_projection(uuid,text),public.display_picture_caption_round_projection(uuid,text) from public,anon,authenticated;
grant execute on function public.host_picture_caption_template_catalog(uuid,uuid),public.player_picture_caption_round_projection(uuid,text),public.display_picture_caption_round_projection(uuid,text) to service_role;