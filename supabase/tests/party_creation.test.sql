begin;

create extension if not exists pgtap with schema extensions;
create temporary table tap_results (result text) on commit drop;

insert into tap_results select plan(12);

insert into auth.users (id, email)
values
    ('11111111-1111-4111-8111-111111111111', 'host-one@example.com'),
    ('22222222-2222-4222-8222-222222222222', 'host-two@example.com');

insert into tap_results select has_table('public', 'parties', 'parties table exists');
insert into tap_results select has_table('public', 'game_sessions', 'game_sessions table exists');
insert into tap_results select has_function('public', 'create_party', array['uuid', 'uuid', 'bigint'], 'create_party command exists');

insert into tap_results select lives_ok(
    $$select * from public.create_party(
        '11111111-1111-4111-8111-111111111111',
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        0
    )$$,
    'a Host can create a Party'
);

insert into tap_results select is((select count(*) from public.parties), 1::bigint, 'one Party is created');
insert into tap_results select is((select count(*) from public.game_sessions), 1::bigint, 'one Setup Game session is created atomically');
insert into tap_results select is((select state from public.game_sessions limit 1), 'setup', 'the current Game session starts in Setup');
insert into tap_results select is((select count(*) from public.command_receipts), 1::bigint, 'the command receipt is persisted');

insert into tap_results select lives_ok(
    $$select * from public.create_party(
        '11111111-1111-4111-8111-111111111111',
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        0
    )$$,
    'replaying the command returns its original result'
);

insert into tap_results select is((select count(*) from public.parties), 1::bigint, 'idempotent replay creates no duplicate Party');

insert into tap_results select throws_ok(
    $$select * from public.create_party(
        '11111111-1111-4111-8111-111111111111',
        'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        1
    )$$,
    '40001',
    'stale_revision',
    'a stale expected revision is rejected'
);

insert into tap_results select is(
    (select count(*) from public.host_parties_projection('22222222-2222-4222-8222-222222222222')),
    0::bigint,
    'another Host cannot project the Party'
);

insert into tap_results select * from finish();

do $$
declare
    failures text;
begin
    select string_agg(result, E'\n')
    into failures
    from tap_results
    where result like 'not ok%';

    if failures is not null then
        raise exception using message = failures;
    end if;
end;
$$;

select result from tap_results;
rollback;