create or replace function public.grant_content_admin(p_actor_id uuid, p_target_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
begin
    if not public.content_admin_check(p_actor_id) then
        raise exception using errcode = '42501', message = 'not_content_admin';
    end if;

    if not exists (select 1 from auth.users where id = p_target_id) then
        raise exception using errcode = 'P0002', message = 'authenticated_user_not_found';
    end if;

    insert into public.content_admin_roles (user_id) values (p_target_id) on conflict do nothing;
    return true;
end;
$$;

create or replace function public.revoke_content_admin(p_actor_id uuid, p_target_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
    perform 1 from public.content_admin_roles for update;

    if not public.content_admin_check(p_actor_id) then
        raise exception using errcode = '42501', message = 'not_content_admin';
    end if;

    if exists (select 1 from public.content_admin_roles where user_id = p_target_id)
       and (select count(*) from public.content_admin_roles) = 1 then
        raise exception using errcode = '23514', message = 'final_content_admin';
    end if;

    delete from public.content_admin_roles where user_id = p_target_id;
    return true;
end;
$$;

create or replace function public.content_admin_roles_projection(p_admin_id uuid)
returns table (user_id uuid)
language sql
security definer
set search_path = public
as $$
    select user_id from public.content_admin_roles
    where public.content_admin_check(p_admin_id)
    order by user_id;
$$;

revoke all on function public.grant_content_admin(uuid, uuid) from public, anon, authenticated;
revoke all on function public.revoke_content_admin(uuid, uuid) from public, anon, authenticated;
revoke all on function public.content_admin_roles_projection(uuid) from public, anon, authenticated;
grant execute on function public.grant_content_admin(uuid, uuid) to service_role;
grant execute on function public.revoke_content_admin(uuid, uuid) to service_role;
grant execute on function public.content_admin_roles_projection(uuid) to service_role;