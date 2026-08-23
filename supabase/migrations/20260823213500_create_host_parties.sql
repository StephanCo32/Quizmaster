create table public.parties (
    id uuid primary key default gen_random_uuid(),
    host_id uuid not null references auth.users(id) on delete cascade,
    code text not null unique check (code ~ '^[A-Z0-9]{6}$'),
    current_game_session_id uuid,
    revision bigint not null default 0 check (revision >= 0),
    created_at timestamptz not null default now()
);

create table public.game_sessions (
    id uuid primary key default gen_random_uuid(),
    party_id uuid not null references public.parties(id) on delete cascade,
    state text not null default 'setup' check (state in ('setup', 'lobby', 'live', 'finished')),
    revision bigint not null default 0 check (revision >= 0),
    joining_open boolean not null default false,
    created_at timestamptz not null default now()
);

alter table public.parties
add constraint parties_current_game_session_id_fkey
foreign key (current_game_session_id)
references public.game_sessions(id)
on delete restrict;

create table public.command_receipts (
    actor_id uuid not null references auth.users(id) on delete cascade,
    command_id uuid not null,
    command_name text not null,
    response jsonb not null,
    created_at timestamptz not null default now(),
    primary key (actor_id, command_id)
);

alter table public.parties enable row level security;
alter table public.game_sessions enable row level security;
alter table public.command_receipts enable row level security;

revoke all on table public.parties from anon, authenticated;
revoke all on table public.game_sessions from anon, authenticated;
revoke all on table public.command_receipts from anon, authenticated;

create or replace function public.create_party(
    p_host_id uuid,
    p_command_id uuid,
    p_expected_revision bigint
)
returns table (
    party_id uuid,
    party_code text,
    game_session_id uuid,
    revision bigint
)
language plpgsql
security definer
set search_path = ''
as $$
declare
    existing_response jsonb;
    created_party_id uuid;
    created_party_code text;
    created_game_session_id uuid;
    command_response jsonb;
begin
    select receipt.response
    into existing_response
    from public.command_receipts as receipt
    where receipt.actor_id = p_host_id
      and receipt.command_id = p_command_id;

    if found then
        return query
        select
            (existing_response ->> 'partyId')::uuid,
            existing_response ->> 'partyCode',
            (existing_response ->> 'gameSessionId')::uuid,
            (existing_response ->> 'revision')::bigint;
        return;
    end if;

    if p_expected_revision <> 0 then
        raise exception using errcode = '40001', message = 'stale_revision';
    end if;

    created_party_code := upper(substr(encode(extensions.gen_random_bytes(4), 'hex'), 1, 6));

    insert into public.parties (host_id, code)
    values (p_host_id, created_party_code)
    returning id into created_party_id;

    insert into public.game_sessions (party_id)
    values (created_party_id)
    returning id into created_game_session_id;

    update public.parties
    set current_game_session_id = created_game_session_id
    where id = created_party_id;

    command_response := jsonb_build_object(
        'partyId', created_party_id,
        'partyCode', created_party_code,
        'gameSessionId', created_game_session_id,
        'revision', 0
    );

    insert into public.command_receipts (actor_id, command_id, command_name, response)
    values (p_host_id, p_command_id, 'create_party', command_response);

    return query
    select created_party_id, created_party_code, created_game_session_id, 0::bigint;
end;
$$;

create or replace function public.host_parties_projection(p_host_id uuid)
returns table (
    party_id uuid,
    party_code text,
    game_session_id uuid,
    game_session_state text,
    revision bigint,
    created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
    select
        party.id,
        party.code,
        session.id,
        session.state,
        party.revision,
        party.created_at
    from public.parties as party
    join public.game_sessions as session
      on session.id = party.current_game_session_id
    where party.host_id = p_host_id
    order by party.created_at desc;
$$;

create or replace function public.host_party_projection(
    p_host_id uuid,
    p_party_id uuid
)
returns table (
    party_id uuid,
    party_code text,
    game_session_id uuid,
    game_session_state text,
    revision bigint,
    created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
    select projection.*
    from public.host_parties_projection(p_host_id) as projection
    where projection.party_id = p_party_id;
$$;

revoke all on function public.create_party(uuid, uuid, bigint) from public, anon, authenticated;
revoke all on function public.host_parties_projection(uuid) from public, anon, authenticated;
revoke all on function public.host_party_projection(uuid, uuid) from public, anon, authenticated;

grant execute on function public.create_party(uuid, uuid, bigint) to service_role;
grant execute on function public.host_parties_projection(uuid) to service_role;
grant execute on function public.host_party_projection(uuid, uuid) to service_role;