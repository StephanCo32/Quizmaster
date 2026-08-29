begin;

create extension if not exists pgtap with schema extensions;
create temporary table tap_results (result text) on commit drop;
insert into tap_results select plan(9);

insert into auth.users (id, email) values
    ('10101010-1010-4010-8010-101010101010', 'display-host@example.com'),
    ('20202020-2020-4020-8020-202020202020', 'display-player@example.com'),
    ('30303030-3030-4030-8030-303030303030', 'other-host@example.com');

select public.create_party('10101010-1010-4010-8010-101010101010', '40404040-4040-4040-8040-404040404040', 0);
select public.open_party_lobby('10101010-1010-4010-8010-101010101010', (select id from public.parties limit 1), '50505050-5050-4050-8050-505050505050', 0);
select public.join_party('20202020-2020-4020-8020-202020202020', (select code from public.parties limit 1), 'Ada', '60606060-6060-4060-8060-606060606060', 1);

insert into tap_results select lives_ok($$select * from public.authorize_display_session('10101010-1010-4010-8010-101010101010', (select id from public.parties limit 1), '70707070-7070-4070-8070-707070707070', '80808080-8080-4080-8080-808080808080')$$, 'Host can authorize a Display session');
insert into tap_results select is((select count(*) from public.display_party_projection('80808080-8080-4080-8080-808080808080', (select code from public.parties limit 1))), 1::bigint, 'authorized Display receives its Party projection');
insert into tap_results select is((select count(*) from public.display_party_lobby_projection('80808080-8080-4080-8080-808080808080', (select code from public.parties limit 1))), 1::bigint, 'authorized Display receives a read-only roster projection');
insert into tap_results select lives_ok($$select * from public.authorize_display_session('10101010-1010-4010-8010-101010101010', (select id from public.parties limit 1), '90909090-9090-4090-8090-909090909090', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')$$, 'Host can replace the active Display session');
insert into tap_results select is_empty($$select * from public.display_party_projection('80808080-8080-4080-8080-808080808080', (select code from public.parties limit 1))$$, 'replaced Display session loses authority');
insert into tap_results select is((select count(*) from public.display_party_projection('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', (select code from public.parties limit 1))), 1::bigint, 'replacement Display session gains authority');
insert into tap_results select is((select count(*) from public.display_sessions where revoked_at is null), 1::bigint, 'only one active Display session exists for a Party');
insert into tap_results select is(public.revoke_display_session('10101010-1010-4010-8010-101010101010', (select id from public.parties limit 1)), true, 'Host can revoke the active Display session');
insert into tap_results select is_empty($$select * from public.display_party_projection('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', (select code from public.parties limit 1))$$, 'revoked Display session loses authority');
insert into tap_results select throws_ok($$select * from public.authorize_display_session('30303030-3030-4030-8030-303030303030', (select id from public.parties limit 1), 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc')$$, 'P0002', 'party_not_found', 'an unrelated Host cannot authorize a Display session');

insert into tap_results select * from finish();
do $$ declare failures text; begin select string_agg(result, E'\n') into failures from tap_results where result like 'not ok%'; if failures is not null then raise exception using message = failures; end if; end; $$;
select result from tap_results;
rollback;