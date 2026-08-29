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

revoke all on function public.content_admin_roles_projection(uuid) from public, anon, authenticated;
grant execute on function public.content_admin_roles_projection(uuid) to service_role;