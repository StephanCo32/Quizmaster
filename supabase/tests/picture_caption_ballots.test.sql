begin;
create extension if not exists pgtap with schema extensions;
create temporary table tap_results (result text) on commit drop;
insert into tap_results select plan(10);
insert into auth.users (id,email) values ('11111111-dddd-4111-8111-111111111111','ballot-host@example.com'),('22222222-dddd-4222-8222-222222222222','ballot-one@example.com'),('33333333-dddd-4333-8333-333333333333','ballot-two@example.com');
insert into public.content_admin_roles(user_id) values('11111111-dddd-4111-8111-111111111111');
insert into public.picture_caption_templates(id,created_by_user_id,name,picture_url,official_caption) values('44444444-dddd-4444-8444-444444444444','11111111-dddd-4111-8111-111111111111','Ballot picture','https://example.com/picture.jpg','Caption this');
select public.create_party('11111111-dddd-4111-8111-111111111111','55555555-dddd-4555-8555-555555555555',0);
select public.open_party_lobby('11111111-dddd-4111-8111-111111111111',(select id from public.parties limit 1),'66666666-dddd-4666-8666-666666666666',0);
select public.join_party('22222222-dddd-4222-8222-222222222222',(select code from public.parties limit 1),'Ada','77777777-dddd-4777-8777-777777777777',1);
select public.join_party('33333333-dddd-4333-8333-333333333333',(select code from public.parties limit 1),'Bea','88888888-dddd-4888-8888-888888888888',2);
select public.set_party_member_ready('22222222-dddd-4222-8222-222222222222',(select id from public.party_members where player_id='22222222-dddd-4222-8222-222222222222'),'99999999-dddd-4999-8999-999999999999',true,3);
select public.set_party_member_ready('33333333-dddd-4333-8333-333333333333',(select id from public.party_members where player_id='33333333-dddd-4333-8333-333333333333'),'aaaaaaaa-dddd-4aaa-8aaa-aaaaaaaaaaaa',true,4);
select public.add_picture_caption_round('11111111-dddd-4111-8111-111111111111',(select id from public.parties limit 1),'44444444-dddd-4444-8444-444444444444','bbbbbbbb-dddd-4bbb-8bbb-bbbbbbbbbbbb',5,120,90,75);
select public.start_picture_caption_session('11111111-dddd-4111-8111-111111111111',(select id from public.parties limit 1),'cccccccc-dddd-4ccc-8ccc-cccccccccccc',6);
select public.submit_picture_caption('22222222-dddd-4222-8222-222222222222',(select code from public.parties limit 1),'dddddddd-dddd-4ddd-8ddd-dddddddddddd',7,'Same   Caption');
select public.submit_picture_caption('33333333-dddd-4333-8333-333333333333',(select code from public.parties limit 1),'eeeeeeee-dddd-4eee-8eee-eeeeeeeeeeee',8,'same caption');
select public.close_picture_captioning('11111111-dddd-4111-8111-111111111111',(select id from public.parties limit 1),'ffffffff-dddd-4fff-8fff-ffffffffffff',9,false);
insert into tap_results select is((select count(*) from public.picture_caption_candidates),2::bigint,'normalised-identical captions merge into one candidate, plus the always-present Official caption');
insert into tap_results select is((select count(*) from public.picture_caption_candidate_authors),2::bigint,'every matching submitter is retained as a co-author');
insert into tap_results select lives_ok($$select * from public.cast_picture_caption_ballot((select member.player_id from public.picture_caption_turn_order turn join public.picture_caption_rounds round on round.id=turn.round_id and round.turn_index=turn.position join public.party_members member on member.id=turn.party_member_id where round.game_session_id=(select current_game_session_id from public.parties where host_id='11111111-dddd-4111-8111-111111111111')),(select code from public.parties limit 1),'10101010-dddd-4010-8010-101010101010',10,(select id from public.picture_caption_candidates where not is_official limit 1))$$,'the current-turn Player can cast a ballot');
insert into tap_results select throws_ok($$select * from public.cast_picture_caption_ballot((select member.player_id from public.picture_caption_round_members eligible join public.party_members member on member.id=eligible.party_member_id where eligible.round_id=(select id from public.picture_caption_rounds where game_session_id=(select current_game_session_id from public.parties where host_id='11111111-dddd-4111-8111-111111111111')) and member.id<>(select turn.party_member_id from public.picture_caption_turn_order turn join public.picture_caption_rounds round on round.id=turn.round_id and round.turn_index=turn.position where round.game_session_id=(select current_game_session_id from public.parties where host_id='11111111-dddd-4111-8111-111111111111'))),(select code from public.parties limit 1),'11111111-dddd-4111-8111-111111111111',(select revision from public.game_sessions limit 1),(select id from public.picture_caption_candidates where not is_official limit 1))$$,'40001','not_your_turn','a Player cannot vote outside their turn');
insert into tap_results select lives_ok($$select * from public.force_skip_picture_caption_turn('11111111-dddd-4111-8111-111111111111',(select id from public.parties limit 1),'12121212-dddd-4012-8012-121212121212',(select revision from public.game_sessions limit 1))$$,'Host can force-skip the final turn, committing the result');
insert into tap_results select is((select score from public.party_members where player_id='22222222-dddd-4222-8222-222222222222'),1,'every co-author of the selected candidate receives one point');

insert into auth.users (id,email) values ('11111111-ffff-4111-8111-111111111111','official-host@example.com'),('22222222-ffff-4222-8222-222222222222','official-author@example.com'),('33333333-ffff-4333-8333-333333333333','official-voter@example.com');
insert into public.picture_caption_templates(id,created_by_user_id,name,picture_url,official_caption) values('44444444-ffff-4444-8444-444444444444','11111111-ffff-4111-8111-111111111111','Official picture','https://example.com/official.jpg','Exact match caption');
select public.create_party('11111111-ffff-4111-8111-111111111111','55555555-ffff-4555-8555-555555555555',0);
select public.open_party_lobby('11111111-ffff-4111-8111-111111111111',(select id from public.parties where host_id='11111111-ffff-4111-8111-111111111111'),'66666666-ffff-4666-8666-666666666666',0);
select public.join_party('22222222-ffff-4222-8222-222222222222',(select code from public.parties where host_id='11111111-ffff-4111-8111-111111111111'),'Cid','77777777-ffff-4777-8777-777777777777',1);
select public.join_party('33333333-ffff-4333-8333-333333333333',(select code from public.parties where host_id='11111111-ffff-4111-8111-111111111111'),'Dee','88888888-ffff-4888-8888-888888888888',2);
select public.set_party_member_ready('22222222-ffff-4222-8222-222222222222',(select id from public.party_members where player_id='22222222-ffff-4222-8222-222222222222'),'99999999-ffff-4999-8999-999999999999',true,3);
select public.set_party_member_ready('33333333-ffff-4333-8333-333333333333',(select id from public.party_members where player_id='33333333-ffff-4333-8333-333333333333'),'aaaaaaaa-ffff-4aaa-8aaa-aaaaaaaaaaaa',true,4);
select public.add_picture_caption_round('11111111-ffff-4111-8111-111111111111',(select id from public.parties where host_id='11111111-ffff-4111-8111-111111111111'),'44444444-ffff-4444-8444-444444444444','bbbbbbbb-ffff-4bbb-8bbb-bbbbbbbbbbbb',5,120,90,75);
select public.start_picture_caption_session('11111111-ffff-4111-8111-111111111111',(select id from public.parties where host_id='11111111-ffff-4111-8111-111111111111'),'cccccccc-ffff-4ccc-8ccc-cccccccccccc',6);
select public.submit_picture_caption('22222222-ffff-4222-8222-222222222222',(select code from public.parties where host_id='11111111-ffff-4111-8111-111111111111'),'dddddddd-ffff-4ddd-8ddd-dddddddddddd',7,'Exact match caption');
select public.close_picture_captioning('11111111-ffff-4111-8111-111111111111',(select id from public.parties where host_id='11111111-ffff-4111-8111-111111111111'),'eeeeeeee-ffff-4eee-8eee-eeeeeeeeeeee',8,true);
insert into tap_results select is((select count(*) from public.picture_caption_candidates where round_id=(select id from public.picture_caption_rounds where game_session_id=(select current_game_session_id from public.parties where host_id='11111111-ffff-4111-8111-111111111111'))),1::bigint,'a Player caption identical to the Official caption merges into that one candidate');
insert into tap_results select is((select count(*) from public.picture_caption_candidate_authors where candidate_id in (select id from public.picture_caption_candidates where round_id=(select id from public.picture_caption_rounds where game_session_id=(select current_game_session_id from public.parties where host_id='11111111-ffff-4111-8111-111111111111')) and is_official)),1::bigint,'the Player whose caption matched the Official caption is credited as its co-author');
-- Turn order is randomized, so force-skip whichever of Cid/Dee goes first if it's Cid (whose caption
-- merged into the Official candidate), guaranteeing Dee is the one who casts the Official-caption ballot.
do $body$
declare v_party_id uuid; v_round_id uuid; v_current_member_id uuid; v_cid_member_id uuid; v_official_candidate_id uuid; v_revision bigint;
begin
 select id into v_party_id from public.parties where host_id='11111111-ffff-4111-8111-111111111111';
 select id into v_round_id from public.picture_caption_rounds where game_session_id=(select current_game_session_id from public.parties where id=v_party_id);
 select id into v_cid_member_id from public.party_members where party_id=v_party_id and player_id='22222222-ffff-4222-8222-222222222222';
 select id into v_official_candidate_id from public.picture_caption_candidates where round_id=v_round_id and is_official;
 select turn.party_member_id into v_current_member_id from public.picture_caption_turn_order turn join public.picture_caption_rounds round on round.id=turn.round_id and round.turn_index=turn.position where turn.round_id=v_round_id;
 if v_current_member_id=v_cid_member_id then
  select revision into v_revision from public.game_sessions where id=(select current_game_session_id from public.parties where id=v_party_id);
  perform public.force_skip_picture_caption_turn('11111111-ffff-4111-8111-111111111111',v_party_id,gen_random_uuid(),v_revision);
 end if;
 select revision into v_revision from public.game_sessions where id=(select current_game_session_id from public.parties where id=v_party_id);
 perform public.cast_picture_caption_ballot('33333333-ffff-4333-8333-333333333333',(select code from public.parties where id=v_party_id),gen_random_uuid(),v_revision,v_official_candidate_id);
 if (select phase from public.picture_caption_rounds where id=v_round_id)='voting' then
  select revision into v_revision from public.game_sessions where id=(select current_game_session_id from public.parties where id=v_party_id);
  perform public.force_skip_picture_caption_turn('11111111-ffff-4111-8111-111111111111',v_party_id,gen_random_uuid(),v_revision);
 end if;
end;
$body$;
insert into tap_results select is((select score from public.party_members member join public.picture_caption_ballots ballot on ballot.party_member_id=member.id join public.picture_caption_candidates candidate on candidate.id=ballot.candidate_id where candidate.is_official),1,'the voter for the Official caption is scored directly');
insert into tap_results select is((select score from public.party_members where player_id='22222222-ffff-4222-8222-222222222222'),1,'the Player whose caption matched the Official caption is also scored as its co-author');
insert into tap_results select * from finish();
do $$ declare failures text; begin select string_agg(result,E'\n') into failures from tap_results where result like 'not ok%'; if failures is not null then raise exception using message=failures; end if; end $$;
select result from tap_results;
rollback;