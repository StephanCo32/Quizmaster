create table public.party_members (
    id uuid primary key default gen_random_uuid(),
    party_id uuid not null references public.parties(id) on delete cascade,
    player_id uuid not null,
    nickname text not null check (char_length(nickname) between 1 and 30),
    color text not null check (color ~ '^#[0-9A-Fa-f]{6}$'),
    score integer not null default 0,
    ready boolean not null default false,
    access_status text not null default 'joined' check (access_status in ('joined', 'removed')),
    created_at timestamptz not null default now(),
    unique (party_id, player_id),
    unique (party_id, nickname)
);

alter table public.party_members enable row level security;
revoke all on table public.party_members from anon, authenticated;

create or replace function public.open_party_lobby(p_host_id uuid, p_party_id uuid, p_command_id uuid, p_expected_revision bigint)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare existing_response jsonb; changed_count integer;
begin
    select response into existing_response from public.command_receipts where actor_id = p_host_id and command_id = p_command_id;
    if found then return (existing_response->>'opened')::boolean; end if;
    update public.game_sessions as session set state = 'lobby', joining_open = true, revision = session.revision + 1
    from public.parties as party where session.id = party.current_game_session_id and party.id = p_party_id and party.host_id = p_host_id and session.state = 'setup' and party.revision = p_expected_revision;
    get diagnostics changed_count = row_count;
    if changed_count = 0 then raise exception using errcode = '40001', message = 'stale_revision'; end if;
    insert into public.command_receipts (actor_id, command_id, command_name, response) values (p_host_id, p_command_id, 'open_party_lobby', jsonb_build_object('opened', true));
    return true;
end;
$$;

create or replace function public.join_party(p_player_id uuid, p_party_code text, p_nickname text, p_command_id uuid)
returns table (member_id uuid, party_id uuid, nickname text, color text, score integer, ready boolean, access_status text)
language plpgsql security definer set search_path = ''
as $$
declare existing_response jsonb; member public.party_members; party_record public.parties; session_record public.game_sessions; command_response jsonb;
begin
    select response into existing_response from public.command_receipts where actor_id = p_player_id and command_id = p_command_id;
    if found then return query select (existing_response->>'memberId')::uuid, (existing_response->>'partyId')::uuid, existing_response->>'nickname', existing_response->>'color', (existing_response->>'score')::integer, (existing_response->>'ready')::boolean, existing_response->>'accessStatus'; return; end if;
    select party.* into party_record from public.parties as party where party.code = upper(trim(p_party_code));
    if not found then raise exception using errcode = 'P0002', message = 'party_not_found'; end if;
    select session.* into session_record from public.game_sessions as session where session.id = party_record.current_game_session_id;
    select * into member from public.party_members where party_id = party_record.id and player_id = p_player_id;
    if found then
        if member.access_status = 'removed' then raise exception using errcode = '42501', message = 'player_removed'; end if;
    elsif session_record.state <> 'lobby' or not session_record.joining_open then
        raise exception using errcode = '42501', message = 'joining_closed';
    else
        if exists (select 1 from public.party_members where party_id = party_record.id and lower(nickname) = lower(trim(p_nickname)) and access_status = 'joined') then raise exception using errcode = '23505', message = 'nickname_taken'; end if;
        insert into public.party_members (party_id, player_id, nickname, color) values (party_record.id, p_player_id, trim(p_nickname), '#' || substr(md5(p_player_id::text), 1, 6)) returning * into member;
    end if;
    command_response := jsonb_build_object('memberId', member.id, 'partyId', member.party_id, 'nickname', member.nickname, 'color', member.color, 'score', member.score, 'ready', member.ready, 'accessStatus', member.access_status);
    insert into public.command_receipts (actor_id, command_id, command_name, response) values (p_player_id, p_command_id, 'join_party', command_response);
    return query select member.id, member.party_id, member.nickname, member.color, member.score, member.ready, member.access_status;
end;
$$;

revoke all on function public.open_party_lobby(uuid, uuid, uuid, bigint) from public, anon, authenticated;
revoke all on function public.join_party(uuid, text, text, uuid) from public, anon, authenticated;
grant execute on function public.open_party_lobby(uuid, uuid, uuid, bigint) to service_role;
grant execute on function public.join_party(uuid, text, text, uuid) to service_role;
