begin;

create extension if not exists pgtap with schema extensions;
create temporary table tap_results (result text) on commit drop;
create temporary table second_party (party_id uuid) on commit drop;
insert into tap_results select plan(27);

insert into auth.users (id, email) values
    ('55555555-5555-4555-8555-555555555555', 'lobby-host@example.com'),
    ('66666666-6666-4666-8666-666666666666', 'player-one@example.com'),
    ('77777777-7777-4777-8777-777777777777', 'player-two@example.com');
select public.create_party('55555555-5555-4555-8555-555555555555', '11111111-aaaa-4aaa-8aaa-111111111111', 0);
select public.open_party_lobby('55555555-5555-4555-8555-555555555555', (select id from public.parties limit 1), '22222222-aaaa-4aaa-8aaa-222222222222', 0);

insert into tap_results select has_table('public', 'party_members', 'party members table exists');
insert into tap_results select is((select state from public.game_sessions limit 1), 'lobby', 'Host can open the lobby');
insert into tap_results select lives_ok($$select * from public.join_party('66666666-6666-4666-8666-666666666666', (select code from public.parties limit 1), 'Ada', '33333333-aaaa-4aaa-8aaa-333333333333', 1)$$, 'a Player can join an open lobby');
insert into tap_results select is((select revision from public.game_sessions limit 1), 2::bigint, 'joining advances the Game session revision');
insert into tap_results select is((select count(*) from public.party_members), 1::bigint, 'one membership is stored');
insert into tap_results select throws_ok($$select * from public.join_party('77777777-7777-4777-8777-777777777777', (select code from public.parties limit 1), 'Ada', '44444444-aaaa-4aaa-8aaa-444444444444', 2)$$, '23505', 'nickname_taken', 'nicknames are unique within a Party');
insert into tap_results select throws_ok($$select * from public.join_party('77777777-7777-4777-8777-777777777777', (select code from public.parties limit 1), 'aDa', '44444446-aaaa-4aaa-8aaa-444444444444', 2)$$, '23505', 'nickname_taken', 'nickname uniqueness is case insensitive');
insert into tap_results select lives_ok($$select * from public.join_party('77777777-7777-4777-8777-777777777777', (select code from public.parties limit 1), 'Bea', '44444445-aaaa-4aaa-8aaa-444444444444', 2)$$, 'another Player can join with a distinct nickname');
insert into tap_results select lives_ok($$select * from public.join_party('66666666-6666-4666-8666-666666666666', (select code from public.parties limit 1), 'Changed', '55555555-aaaa-4aaa-8aaa-555555555555', 3)$$, 'an existing Player can rejoin idempotently');
insert into tap_results select is((select count(*) from public.party_members), 2::bigint, 'rejoin does not duplicate membership');
insert into tap_results select lives_ok($$select * from public.change_party_member_nickname('66666666-6666-4666-8666-666666666666', (select id from public.party_members where player_id = '66666666-6666-4666-8666-666666666666'), '88888888-aaaa-4aaa-8aaa-888888888888', 'Alice', 3)$$, 'a Player can change nickname in the Lobby');
insert into tap_results select is((select revision from public.game_sessions limit 1), 4::bigint, 'nickname changes advance the Game session revision');
insert into tap_results select lives_ok($$select * from public.set_party_member_ready('66666666-6666-4666-8666-666666666666', (select id from public.party_members where player_id = '66666666-6666-4666-8666-666666666666'), '99999999-aaaa-4aaa-8aaa-999999999999', true, 4)$$, 'a Player can toggle readiness');
insert into tap_results select is((select revision from public.game_sessions limit 1), 5::bigint, 'readiness changes advance the Game session revision');
insert into tap_results select is((select ready from public.party_members where player_id = '66666666-6666-4666-8666-666666666666'), true, 'readiness is persisted');
insert into tap_results select is((select count(*) from public.player_party_lobby_projection('66666666-6666-4666-8666-666666666666', (select code from public.parties order by created_at limit 1))), 2::bigint, 'a Player can see the full Party roster');
insert into tap_results select is((select game_session_id from public.player_party_lobby_projection('66666666-6666-4666-8666-666666666666', (select code from public.parties order by created_at limit 1)) limit 1), (select id from public.game_sessions order by created_at limit 1), 'Player projections expose synchronization identity');
insert into tap_results select lives_ok($$select * from public.set_party_joining('55555555-5555-4555-8555-555555555555', (select id from public.parties order by created_at limit 1), '12121212-aaaa-4aaa-8aaa-121212121212', 5, false)$$, 'Host can close joining');
insert into tap_results select throws_ok($$select * from public.join_party('55555555-5555-4555-8555-555555555555', (select code from public.parties order by created_at limit 1), 'Host', '13131313-aaaa-4aaa-8aaa-131313131313', 6)$$, '42501', 'joining_closed', 'closed admission rejects new Players');
insert into tap_results select lives_ok($$select * from public.set_party_member_access('55555555-5555-4555-8555-555555555555', (select id from public.parties order by created_at limit 1), (select id from public.party_members where player_id = '66666666-6666-4666-8666-666666666666'), '14141414-aaaa-4aaa-8aaa-141414141414', 6, 'removed')$$, 'Host can remove a Player');
insert into tap_results select throws_ok($$select * from public.join_party('66666666-6666-4666-8666-666666666666', (select code from public.parties order by created_at limit 1), 'Alice', '15151515-aaaa-4aaa-8aaa-151515151515', 7)$$, '42501', 'player_removed', 'removed Player cannot rejoin');
insert into tap_results select lives_ok($$select * from public.set_party_member_access('55555555-5555-4555-8555-555555555555', (select id from public.parties order by created_at limit 1), (select id from public.party_members where player_id = '66666666-6666-4666-8666-666666666666'), '16161616-aaaa-4aaa-8aaa-161616161616', 7, 'joined')$$, 'Host can restore a Player');
insert into tap_results select isnt((select party_code from public.rotate_party_code('55555555-5555-4555-8555-555555555555', (select id from public.parties order by created_at limit 1), '17171717-aaaa-4aaa-8aaa-171717171717', 8)), (select code from public.parties order by created_at limit 1), 'Host can rotate the Party code');
insert into tap_results select throws_ok($$select * from public.set_party_member_ready('66666666-6666-4666-8666-666666666666', (select id from public.party_members where player_id = '66666666-6666-4666-8666-666666666666'), 'aaaaaaaa-bbbb-4aaa-8aaa-aaaaaaaaaaaa', false, 0)$$, '40001', 'stale_revision', 'stale readiness commands are rejected');
insert into second_party select party_id from public.create_party('55555555-5555-4555-8555-555555555555', 'bbbbbbbb-aaaa-4aaa-8aaa-bbbbbbbbbbbb', 0);
select public.open_party_lobby('55555555-5555-4555-8555-555555555555', (select party_id from second_party), 'cccccccc-aaaa-4aaa-8aaa-cccccccccccc', 0);
insert into tap_results select lives_ok($$select * from public.join_party('66666666-6666-4666-8666-666666666666', (select code from public.parties where id = (select party_id from second_party)), 'Alice', 'dddddddd-aaaa-4aaa-8aaa-dddddddddddd', 1)$$, 'the same Browser identity can join another Party');
update public.game_sessions set joining_open = false where state = 'lobby';
insert into tap_results select lives_ok($$select * from public.join_party('77777777-7777-4777-8777-777777777777', (select code from public.parties order by created_at limit 1), 'Bea', '66666666-aaaa-4aaa-8aaa-666666666666', 9)$$, 'an admitted player can rejoin after admission closes');
insert into tap_results select throws_ok($$select * from public.join_party('55555555-5555-4555-8555-555555555555', (select code from public.parties order by created_at limit 1), 'Host', '77777777-aaaa-4aaa-8aaa-777777777777', 9)$$, '42501', 'joining_closed', 'new players cannot join after admission closes');

insert into tap_results select * from finish();
do $$ declare failures text; begin select string_agg(result, E'\n') into failures from tap_results where result like 'not ok%'; if failures is not null then raise exception using message = failures; end if; end; $$;
select result from tap_results;
rollback;
