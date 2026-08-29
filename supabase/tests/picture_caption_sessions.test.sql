begin;

create extension if not exists pgtap with schema extensions;
create temporary table tap_results (result text) on commit drop;
insert into tap_results select plan(11);

insert into auth.users (id, email) values
    ('11111111-aaaa-4111-8111-111111111111', 'round-host@example.com'),
    ('22222222-aaaa-4222-8222-222222222222', 'round-player@example.com');
insert into public.content_admin_roles (user_id) values ('11111111-aaaa-4111-8111-111111111111');
insert into public.picture_caption_templates (id, created_by_user_id, name, picture_url, prompt) values ('33333333-aaaa-4333-8333-333333333333', '11111111-aaaa-4111-8111-111111111111', 'First picture', 'https://example.com/picture.jpg', 'Caption this');
select public.create_party('11111111-aaaa-4111-8111-111111111111', '44444444-aaaa-4444-8444-444444444444', 0);
select public.open_party_lobby('11111111-aaaa-4111-8111-111111111111', (select id from public.parties limit 1), '55555555-aaaa-4555-8555-555555555555', 0);
select public.join_party('22222222-aaaa-4222-8222-222222222222', (select code from public.parties limit 1), 'Ada', '66666666-aaaa-4666-8666-666666666666', 1);
select public.add_picture_caption_round('11111111-aaaa-4111-8111-111111111111', (select id from public.parties limit 1), '33333333-aaaa-4333-8333-333333333333', '77777777-aaaa-4777-8777-777777777777', 2, 120, 90, 120);

insert into tap_results select throws_ok($$select * from public.start_picture_caption_session('11111111-aaaa-4111-8111-111111111111', (select id from public.parties limit 1), '88888888-aaaa-4888-8888-888888888888', 3)$$, '40001', 'players_not_ready', 'start requires every connected Player to be ready');
select public.set_party_member_ready('22222222-aaaa-4222-8222-222222222222', (select id from public.party_members limit 1), '99999999-aaaa-4999-8999-999999999999', true, 3);
insert into tap_results select lives_ok($$select * from public.start_picture_caption_session('11111111-aaaa-4111-8111-111111111111', (select id from public.parties limit 1), 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 4)$$, 'Host can start when every Player is ready');
insert into tap_results select is((select state from public.game_sessions limit 1), 'live', 'start moves the Game session live');
insert into tap_results select is((select phase from public.picture_caption_rounds limit 1), 'captioning', 'start activates Captioning');
insert into tap_results select ok((select captioning_deadline is not null from public.picture_caption_rounds limit 1), 'active round receives an authoritative deadline');
insert into tap_results select is((select joining_open from public.game_sessions limit 1), false, 'start closes new membership');
insert into tap_results select lives_ok($$select * from public.set_picture_caption_paused('11111111-aaaa-4111-8111-111111111111', (select id from public.parties limit 1), 'bbbbbbbb-aaaa-4bbb-8bbb-bbbbbbbbbbbb', 5, true)$$, 'Host can pause the active Captioning timer');
insert into tap_results select ok((select captioning_deadline is null and paused_remaining_seconds is not null from public.picture_caption_rounds limit 1), 'pause freezes the authoritative deadline');
insert into tap_results select lives_ok($$select * from public.set_picture_caption_paused('11111111-aaaa-4111-8111-111111111111', (select id from public.parties limit 1), 'cccccccc-aaaa-4ccc-8ccc-cccccccccccc', 6, false)$$, 'Host can resume the active Captioning timer');
insert into tap_results select ok((select captioning_deadline is not null and paused_remaining_seconds is null from public.picture_caption_rounds limit 1), 'resume restores the authoritative deadline');

insert into auth.users (id, email) values ('dddddddd-aaaa-4ddd-8ddd-dddddddddddd', 'empty-host@example.com');
insert into public.content_admin_roles (user_id) values ('dddddddd-aaaa-4ddd-8ddd-dddddddddddd');
select public.create_party('dddddddd-aaaa-4ddd-8ddd-dddddddddddd', 'eeeeeeee-aaaa-4eee-8eee-eeeeeeeeeeee', 0);
select public.open_party_lobby('dddddddd-aaaa-4ddd-8ddd-dddddddddddd', (select id from public.parties where host_id='dddddddd-aaaa-4ddd-8ddd-dddddddddddd'), 'ffffffff-aaaa-4fff-8fff-ffffffffffff', 0);
select public.add_picture_caption_round('dddddddd-aaaa-4ddd-8ddd-dddddddddddd', (select id from public.parties where host_id='dddddddd-aaaa-4ddd-8ddd-dddddddddddd'), '33333333-aaaa-4333-8333-333333333333', '10101010-aaaa-4010-8010-101010101010', 1, 120, 90, 120);
insert into tap_results select throws_ok($$select * from public.start_picture_caption_session('dddddddd-aaaa-4ddd-8ddd-dddddddddddd', (select id from public.parties where host_id='dddddddd-aaaa-4ddd-8ddd-dddddddddddd'), '20202020-aaaa-4020-8020-202020202020', 2)$$, '40001', 'no_joined_players', 'start requires at least one joined Player');

insert into tap_results select * from finish();
do $$ declare failures text; begin select string_agg(result, E'\n') into failures from tap_results where result like 'not ok%'; if failures is not null then raise exception using message = failures; end if; end; $$;
select result from tap_results;
rollback;