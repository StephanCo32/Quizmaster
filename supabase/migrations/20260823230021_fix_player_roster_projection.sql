create or replace function public.player_party_lobby_projection(p_player_id uuid, p_party_code text)
returns table (member_id uuid, party_id uuid, nickname text, color text, score integer, ready boolean, access_status text, party_code text, session_state text, joining_open boolean, session_revision bigint)
language sql stable security definer set search_path = ''
as $$
    select member.id, member.party_id, member.nickname, member.color, member.score, member.ready, member.access_status, party.code, session.state, session.joining_open, session.revision
    from public.party_members as member join public.parties as party on party.id = member.party_id join public.game_sessions as session on session.id = party.current_game_session_id
    where member.party_id in (select own_member.party_id from public.party_members as own_member where own_member.player_id = p_player_id and own_member.party_id = party.id and own_member.access_status = 'joined')
      and party.code = upper(trim(p_party_code)) and member.access_status = 'joined'
    order by (member.player_id = p_player_id) desc, member.created_at;
$$;
