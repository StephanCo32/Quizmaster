begin;

create extension if not exists pgtap with schema extensions;

select plan(12);

insert into auth.users (id, email)
values
    ('11111111-1111-4111-8111-111111111111', 'host-one@example.com'),
    ('22222222-2222-4222-8222-222222222222', 'host-two@example.com');

select has_table('public', 'parties', 'parties table exists');
select has_table('public', 'game_sessions', 'game_sessions table exists');
select has_function('public', 'create_party', array['uuid', 'uuid', 'bigint'], 'create_party command exists');

select lives_ok(
    $$select * from public.create_party(
        '11111111-1111-4111-8111-111111111111',
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        0
    )$$,
    'a Host can create a Party'
);

select is((select count(*) from public.parties), 1::bigint, 'one Party is created');
select is((select count(*) from public.game_sessions), 1::bigint, 'one Setup Game session is created atomically');
select is((select state from public.game_sessions limit 1), 'setup', 'the current Game session starts in Setup');
select is((select count(*) from public.command_receipts), 1::bigint, 'the command receipt is persisted');

select lives_ok(
    $$select * from public.create_party(
        '11111111-1111-4111-8111-111111111111',
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        0
    )$$,
    'replaying the command returns its original result'
);

select is((select count(*) from public.parties), 1::bigint, 'idempotent replay creates no duplicate Party');

select throws_ok(
    $$select * from public.create_party(
        '11111111-1111-4111-8111-111111111111',
        'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        1
    )$$,
    '40001',
    'stale_revision',
    'a stale expected revision is rejected'
);

select is(
    (select count(*) from public.host_parties_projection('22222222-2222-4222-8222-222222222222')),
    0::bigint,
    'another Host cannot project the Party'
);

select * from finish();
rollback;