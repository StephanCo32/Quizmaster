begin;

create extension if not exists pgtap with schema extensions;
create temporary table tap_results (result text) on commit drop;
insert into tap_results select plan(17);

insert into auth.users (id, email) values
    ('33333333-3333-4333-8333-333333333333', 'content-admin@example.com'),
    ('44444444-4444-4444-8444-444444444444', 'ordinary-host@example.com');
insert into public.content_admin_roles (user_id) values ('33333333-3333-4333-8333-333333333333');

insert into tap_results select has_table('public', 'picture_caption_templates', 'template table exists');
insert into tap_results select has_function('public', 'create_picture_caption_template', array['uuid', 'uuid', 'text', 'text', 'text'], 'create RPC exists');
insert into tap_results select has_function('public', 'grant_content_admin', array['uuid', 'uuid'], 'grant RPC exists');
insert into tap_results select has_function('public', 'revoke_content_admin', array['uuid', 'uuid'], 'revoke RPC exists');
insert into tap_results select lives_ok($$select public.grant_content_admin('33333333-3333-4333-8333-333333333333', '44444444-4444-4444-8444-444444444444')$$, 'an administrator can grant the capability');
insert into tap_results select ok(public.content_admin_check('44444444-4444-4444-8444-444444444444'), 'granted administrator has the capability');
insert into tap_results select lives_ok($$select public.revoke_content_admin('33333333-3333-4333-8333-333333333333', '44444444-4444-4444-8444-444444444444')$$, 'an administrator can revoke another administrator');
insert into tap_results select throws_ok($$select public.revoke_content_admin('33333333-3333-4333-8333-333333333333', '33333333-3333-4333-8333-333333333333')$$, '23514', 'final_content_admin', 'the final administrator cannot be revoked');
insert into tap_results select lives_ok($$select * from public.create_picture_caption_template('33333333-3333-4333-8333-333333333333', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Sunset', 'https://example.com/sunset.jpg', 'Write a caption')$$, 'content admin can create a template');
insert into tap_results select is((select count(*) from public.picture_caption_templates), 1::bigint, 'one template is stored');
insert into tap_results select lives_ok($$select * from public.create_picture_caption_template('33333333-3333-4333-8333-333333333333', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Sunset', 'https://example.com/sunset.jpg', null)$$, 'duplicate names and URLs are accepted');
insert into tap_results select is((select count(*) from public.picture_caption_templates), 2::bigint, 'duplicate template remains distinct');
insert into tap_results select throws_ok($$select * from public.create_picture_caption_template('44444444-4444-4444-8444-444444444444', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'Denied', 'https://example.com/denied.jpg', null)$$, '42501', 'not_content_admin', 'ordinary hosts cannot mutate templates');
insert into tap_results select throws_ok($$select * from public.create_picture_caption_template('33333333-3333-4333-8333-333333333333', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', '', 'https://example.com/invalid.jpg', null)$$, '23514', null, 'invalid names are rejected');
insert into tap_results select is((select count(*) from public.picture_caption_templates_projection('44444444-4444-4444-8444-444444444444')), 0::bigint, 'ordinary hosts cannot browse the catalog');
insert into tap_results select lives_ok($$select * from public.update_picture_caption_template('33333333-3333-4333-8333-333333333333', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', (select id from public.picture_caption_templates where name = 'Sunset' limit 1), 'Updated', 'https://example.com/updated.jpg', null, 0)$$, 'content admin can update with the expected revision');
insert into tap_results select throws_ok($$select * from public.update_picture_caption_template('33333333-3333-4333-8333-333333333333', 'ffffffff-ffff-4fff-8fff-ffffffffffff', (select id from public.picture_caption_templates where name = 'Updated' limit 1), 'Stale', 'https://example.com/stale.jpg', null, 0)$$, '40001', 'stale_revision', 'stale updates are rejected');

insert into tap_results select * from finish();
do $$ declare failures text; begin select string_agg(result, E'\n') into failures from tap_results where result like 'not ok%'; if failures is not null then raise exception using message = failures; end if; end; $$;
select result from tap_results;
rollback;
