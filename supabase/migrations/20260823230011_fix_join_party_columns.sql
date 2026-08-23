create or replace function public.join_party(p_player_id uuid, p_party_code text, p_nickname text, p_command_id uuid)
returns table (member_id uuid, party_id uuid, nickname text, color text, score integer, ready boolean, access_status text)
language plpgsql security definer set search_path = ''
as $$
declare existing_response jsonb; member public.party_members; party_record public.parties; session_record public.game_sessions; command_response jsonb;
begin
    select receipt.response into existing_response from public.command_receipts as receipt where receipt.actor_id = p_player_id and receipt.command_id = p_command_id;
    if found then return query select (existing_response->>'memberId')::uuid, (existing_response->>'partyId')::uuid, existing_response->>'nickname', existing_response->>'color', (existing_response->>'score')::integer, (existing_response->>'ready')::boolean, existing_response->>'accessStatus'; return; end if;
    select party.* into party_record from public.parties as party where party.code = upper(trim(p_party_code));
    if not found then raise exception using errcode = 'P0002', message = 'party_not_found'; end if;
    select session.* into session_record from public.game_sessions as session where session.id = party_record.current_game_session_id;
    select party_member.* into member from public.party_members as party_member where party_member.party_id = party_record.id and party_member.player_id = p_player_id;
    if found then
        if member.access_status = 'removed' then raise exception using errcode = '42501', message = 'player_removed'; end if;
    elsif session_record.state <> 'lobby' or not session_record.joining_open then
        raise exception using errcode = '42501', message = 'joining_closed';
    else
        if exists (select 1 from public.party_members as other_member where other_member.party_id = party_record.id and lower(other_member.nickname) = lower(trim(p_nickname)) and other_member.access_status = 'joined') then raise exception using errcode = '23505', message = 'nickname_taken'; end if;
        insert into public.party_members (party_id, player_id, nickname, color) values (party_record.id, p_player_id, trim(p_nickname), '#' || substr(md5(p_player_id::text), 1, 6)) returning * into member;
    end if;
    command_response := jsonb_build_object('memberId', member.id, 'partyId', member.party_id, 'nickname', member.nickname, 'color', member.color, 'score', member.score, 'ready', member.ready, 'accessStatus', member.access_status);
    insert into public.command_receipts (actor_id, command_id, command_name, response) values (p_player_id, p_command_id, 'join_party', command_response);
    return query select member.id, member.party_id, member.nickname, member.color, member.score, member.ready, member.access_status;
end;
$$;
