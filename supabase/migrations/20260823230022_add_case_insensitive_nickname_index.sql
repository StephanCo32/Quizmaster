create unique index if not exists party_members_party_nickname_ci_key
on public.party_members (party_id, lower(nickname))
where access_status = 'joined';
