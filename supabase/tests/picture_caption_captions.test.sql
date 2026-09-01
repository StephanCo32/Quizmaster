begin;

create extension if not exists pgtap with schema extensions;
create temporary table tap_results (result text) on commit drop;
insert into tap_results select plan(11);

insert into auth.users (id, email) values
    ('11111111-bbbb-4111-8111-111111111111', 'caption-host@example.com'),
    ('22222222-bbbb-4222-8222-222222222222', 'caption-player@example.com');
insert into public.content_admin_roles (user_id) values ('11111111-bbbb-4111-8111-111111111111');
insert into public.picture_caption_templates (id, created_by_user_id, name, picture_url, official_caption) values ('33333333-bbbb-4333-8333-333333333333', '11111111-bbbb-4111-8111-111111111111', 'Caption picture', 'https://example.com/picture.jpg', 'Caption this');
select public.create_party('11111111-bbbb-4111-8111-111111111111', '44444444-bbbb-4444-8444-444444444444', 0);
select public.open_party_lobby('11111111-bbbb-4111-8111-111111111111', (select id from public.parties limit 1), '55555555-bbbb-4555-8555-555555555555', 0);
select public.join_party('22222222-bbbb-4222-8222-222222222222', (select code from public.parties limit 1), 'Ada', '66666666-bbbb-4666-8666-666666666666', 1);
select public.set_party_member_ready('22222222-bbbb-4222-8222-222222222222', (select id from public.party_members limit 1), '77777777-bbbb-4777-8777-777777777777', true, 2);
select public.add_picture_caption_round('11111111-bbbb-4111-8111-111111111111', (select id from public.parties limit 1), '33333333-bbbb-4333-8333-333333333333', '88888888-bbbb-4888-8888-888888888888', 3, 120, 90, 120);
select public.start_picture_caption_session('11111111-bbbb-4111-8111-111111111111', (select id from public.parties limit 1), '99999999-bbbb-4999-8999-999999999999', 4);

insert into tap_results select lives_ok($$select * from public.submit_picture_caption('22222222-bbbb-4222-8222-222222222222', (select code from public.parties limit 1), 'aaaaaaaa-bbbb-4aaa-8aaa-aaaaaaaaaaaa', 5, E'  Hello\r\nworld  ')$$, 'eligible Player can submit one caption during Captioning');
insert into tap_results select is((select caption from public.player_picture_caption_submission_projection('22222222-bbbb-4222-8222-222222222222', (select code from public.parties limit 1))), E'Hello\nworld', 'submission trims edges and normalizes CRLF');
select public.submit_picture_caption('22222222-bbbb-4222-8222-222222222222', (select code from public.parties limit 1), 'abababac-bbbb-4aba-8aba-abababababab', 6, 'Edited caption');
insert into tap_results select is((select caption from public.player_picture_caption_submission_projection('22222222-bbbb-4222-8222-222222222222', (select code from public.parties limit 1))), 'Edited caption', 'Player can edit their caption before close');
insert into tap_results select is((select count(*) from public.picture_caption_submissions), 1::bigint, 'caption edit preserves one submission per eligible Player');
insert into tap_results select throws_ok($$select * from public.submit_picture_caption('22222222-bbbb-4222-8222-222222222222', (select code from public.parties limit 1), 'abababab-bbbb-4aba-8aba-abababababab', (select revision from public.game_sessions limit 1), E'one\ntwo\nthree\nfour')$$, '22023', 'invalid_caption', 'caption validation rejects more than three lines');
insert into tap_results select is((select nickname from public.host_picture_caption_submissions_projection('11111111-bbbb-4111-8111-111111111111', (select id from public.parties limit 1)) limit 1), 'Ada', 'Host projection identifies the caption author');
insert into tap_results select lives_ok($$select * from public.remove_picture_caption_submission('11111111-bbbb-4111-8111-111111111111', (select id from public.parties limit 1), (select id from public.picture_caption_submissions limit 1), 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', (select revision from public.game_sessions limit 1))$$, 'Host can remove a caption during Captioning');
insert into tap_results select is((select count(*) from public.picture_caption_moderation_audits), 1::bigint, 'moderation records an immutable audit');
insert into tap_results select lives_ok($$select * from public.close_picture_captioning('11111111-bbbb-4111-8111-111111111111', (select id from public.parties limit 1), 'cdcdcdcd-bbbb-4cdc-8cdc-cdcdcdcdcdcd', (select revision from public.game_sessions limit 1), true)$$, 'Host can close Captioning with no valid captions');
insert into tap_results select is((select state from public.picture_caption_rounds limit 1), 'completed', 'zero captions skip Voting into Results');

insert into auth.users (id, email) values ('11111111-cccc-4111-8111-111111111111', 'voting-host@example.com'), ('22222222-cccc-4222-8222-222222222222', 'voting-player@example.com');
select public.create_party('11111111-cccc-4111-8111-111111111111', '44444444-cccc-4444-8444-444444444444', 0);
select public.open_party_lobby('11111111-cccc-4111-8111-111111111111', (select id from public.parties where host_id='11111111-cccc-4111-8111-111111111111'), '55555555-cccc-4555-8555-555555555555', 0);
select public.join_party('22222222-cccc-4222-8222-222222222222', (select code from public.parties where host_id='11111111-cccc-4111-8111-111111111111'), 'Bea', '66666666-cccc-4666-8666-666666666666', 1);
select public.set_party_member_ready('22222222-cccc-4222-8222-222222222222', (select id from public.party_members where player_id='22222222-cccc-4222-8222-222222222222'), '77777777-cccc-4777-8777-777777777777', true, 2);
select public.add_picture_caption_round('11111111-cccc-4111-8111-111111111111', (select id from public.parties where host_id='11111111-cccc-4111-8111-111111111111'), '33333333-bbbb-4333-8333-333333333333', '88888888-cccc-4888-8888-888888888888', 3, 120, 90, 120);
select public.start_picture_caption_session('11111111-cccc-4111-8111-111111111111', (select id from public.parties where host_id='11111111-cccc-4111-8111-111111111111'), '99999999-cccc-4999-8999-999999999999', 4);
select public.submit_picture_caption('22222222-cccc-4222-8222-222222222222', (select code from public.parties where host_id='11111111-cccc-4111-8111-111111111111'), 'aaaaaaaa-cccc-4aaa-8aaa-aaaaaaaaaaaa', 5, 'Only caption');
select public.close_picture_captioning('11111111-cccc-4111-8111-111111111111', (select id from public.parties where host_id='11111111-cccc-4111-8111-111111111111'), 'bbbbbbbb-cccc-4bbb-8bbb-bbbbbbbbbbbb', 6, false);
insert into tap_results select is((select phase from public.picture_caption_rounds where game_session_id=(select current_game_session_id from public.parties where host_id='11111111-cccc-4111-8111-111111111111')), 'voting', 'one valid caption proceeds to Voting');

insert into tap_results select * from finish();
do $$ declare failures text; begin select string_agg(result, E'\n') into failures from tap_results where result like 'not ok%'; if failures is not null then raise exception using message = failures; end if; end; $$;
select result from tap_results;
rollback;