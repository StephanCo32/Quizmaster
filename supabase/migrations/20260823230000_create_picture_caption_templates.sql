create table public.content_admin_roles (
    user_id uuid primary key references auth.users(id) on delete cascade,
    granted_by_user_id uuid references auth.users(id) on delete set null,
    created_at timestamptz not null default now()
);

create table public.picture_caption_templates (
    id uuid primary key default gen_random_uuid(),
    created_by_user_id uuid not null references auth.users(id) on delete restrict,
    name text not null check (char_length(name) between 1 and 100),
    picture_url text not null check (picture_url ~ '^https://[^[:space:]]+$'),
    prompt text check (prompt is null or char_length(prompt) <= 280),
    revision bigint not null default 0 check (revision >= 0),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.content_admin_roles enable row level security;
alter table public.picture_caption_templates enable row level security;
revoke all on table public.content_admin_roles from anon, authenticated;
revoke all on table public.picture_caption_templates from anon, authenticated;

create or replace function public.ensure_content_admin(p_user_id uuid)
returns boolean language plpgsql security definer set search_path = ''
as $$
begin
    insert into public.content_admin_roles (user_id) values (p_user_id) on conflict do nothing;
    return true;
end;
$$;

create or replace function public.content_admin_check(p_user_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.content_admin_roles where user_id = p_user_id); $$;

create or replace function public.create_picture_caption_template(
    p_admin_id uuid, p_command_id uuid, p_name text, p_picture_url text, p_prompt text
)
returns table (template_id uuid, name text, picture_url text, prompt text, revision bigint, created_at timestamptz, updated_at timestamptz)
language plpgsql security definer set search_path = ''
as $$
declare existing_response jsonb; created_template public.picture_caption_templates; command_response jsonb;
begin
    if not public.content_admin_check(p_admin_id) then raise exception using errcode = '42501', message = 'not_content_admin'; end if;
    select response into existing_response from public.command_receipts where actor_id = p_admin_id and command_id = p_command_id;
    if found then return query select (existing_response->>'templateId')::uuid, existing_response->>'name', existing_response->>'pictureUrl', existing_response->>'prompt', (existing_response->>'revision')::bigint, (existing_response->>'createdAt')::timestamptz, (existing_response->>'updatedAt')::timestamptz; return; end if;
    insert into public.picture_caption_templates (created_by_user_id, name, picture_url, prompt) values (p_admin_id, p_name, p_picture_url, p_prompt) returning * into created_template;
    command_response := jsonb_build_object('templateId', created_template.id, 'name', created_template.name, 'pictureUrl', created_template.picture_url, 'prompt', created_template.prompt, 'revision', created_template.revision, 'createdAt', created_template.created_at, 'updatedAt', created_template.updated_at);
    insert into public.command_receipts (actor_id, command_id, command_name, response) values (p_admin_id, p_command_id, 'create_picture_caption_template', command_response);
    return query select created_template.id, created_template.name, created_template.picture_url, created_template.prompt, created_template.revision, created_template.created_at, created_template.updated_at;
end;
$$;

create or replace function public.update_picture_caption_template(
    p_admin_id uuid, p_command_id uuid, p_template_id uuid, p_name text, p_picture_url text, p_prompt text, p_expected_revision bigint
)
returns table (template_id uuid, name text, picture_url text, prompt text, revision bigint, created_at timestamptz, updated_at timestamptz)
language plpgsql security definer set search_path = ''
as $$
declare existing_response jsonb; updated_template public.picture_caption_templates; command_response jsonb;
begin
    if not public.content_admin_check(p_admin_id) then raise exception using errcode = '42501', message = 'not_content_admin'; end if;
    select response into existing_response from public.command_receipts where actor_id = p_admin_id and command_id = p_command_id;
    if found then return query select (existing_response->>'templateId')::uuid, existing_response->>'name', existing_response->>'pictureUrl', existing_response->>'prompt', (existing_response->>'revision')::bigint, (existing_response->>'createdAt')::timestamptz, (existing_response->>'updatedAt')::timestamptz; return; end if;
    update public.picture_caption_templates as template set name = p_name, picture_url = p_picture_url, prompt = p_prompt, revision = template.revision + 1, updated_at = now() where template.id = p_template_id and template.revision = p_expected_revision returning template.* into updated_template;
    if not found then
        if exists (select 1 from public.picture_caption_templates where id = p_template_id) then raise exception using errcode = '40001', message = 'stale_revision'; end if;
        raise exception using errcode = 'P0002', message = 'template_not_found';
    end if;
    command_response := jsonb_build_object('templateId', updated_template.id, 'name', updated_template.name, 'pictureUrl', updated_template.picture_url, 'prompt', updated_template.prompt, 'revision', updated_template.revision, 'createdAt', updated_template.created_at, 'updatedAt', updated_template.updated_at);
    insert into public.command_receipts (actor_id, command_id, command_name, response) values (p_admin_id, p_command_id, 'update_picture_caption_template', command_response);
    return query select updated_template.id, updated_template.name, updated_template.picture_url, updated_template.prompt, updated_template.revision, updated_template.created_at, updated_template.updated_at;
end;
$$;

create or replace function public.delete_picture_caption_template(p_admin_id uuid, p_command_id uuid, p_template_id uuid, p_expected_revision bigint)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare existing_response jsonb; deleted_count integer;
begin
    if not public.content_admin_check(p_admin_id) then raise exception using errcode = '42501', message = 'not_content_admin'; end if;
    select response into existing_response from public.command_receipts where actor_id = p_admin_id and command_id = p_command_id;
    if found then return (existing_response->>'deleted')::boolean; end if;
    delete from public.picture_caption_templates where id = p_template_id and revision = p_expected_revision;
    get diagnostics deleted_count = row_count;
    if deleted_count = 0 and exists (select 1 from public.picture_caption_templates where id = p_template_id) then raise exception using errcode = '40001', message = 'stale_revision'; end if;
    insert into public.command_receipts (actor_id, command_id, command_name, response) values (p_admin_id, p_command_id, 'delete_picture_caption_template', jsonb_build_object('deleted', deleted_count > 0));
    return deleted_count > 0;
end;
$$;

create or replace function public.picture_caption_templates_projection(p_admin_id uuid)
returns table (template_id uuid, name text, picture_url text, prompt text, revision bigint, created_at timestamptz, updated_at timestamptz)
language sql stable security definer set search_path = ''
as $$ select id, name, picture_url, prompt, revision, created_at, updated_at from public.picture_caption_templates where public.content_admin_check(p_admin_id) order by created_at desc; $$;

create or replace function public.picture_caption_template_by_id(p_template_id uuid)
returns table (template_id uuid, picture_url text)
language sql stable security definer set search_path = ''
as $$ select id, picture_url from public.picture_caption_templates where id = p_template_id; $$;

revoke all on function public.ensure_content_admin(uuid) from public, anon, authenticated;
revoke all on function public.content_admin_check(uuid) from public, anon, authenticated;
revoke all on function public.create_picture_caption_template(uuid, uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.update_picture_caption_template(uuid, uuid, uuid, text, text, text, bigint) from public, anon, authenticated;
revoke all on function public.delete_picture_caption_template(uuid, uuid, uuid, bigint) from public, anon, authenticated;
revoke all on function public.picture_caption_templates_projection(uuid) from public, anon, authenticated;
revoke all on function public.picture_caption_template_by_id(uuid) from public, anon, authenticated;
grant execute on function public.ensure_content_admin(uuid) to service_role;
grant execute on function public.content_admin_check(uuid) to service_role;
grant execute on function public.create_picture_caption_template(uuid, uuid, text, text, text) to service_role;
grant execute on function public.update_picture_caption_template(uuid, uuid, uuid, text, text, text, bigint) to service_role;
grant execute on function public.delete_picture_caption_template(uuid, uuid, uuid, bigint) to service_role;
grant execute on function public.picture_caption_templates_projection(uuid) to service_role;
grant execute on function public.picture_caption_template_by_id(uuid) to service_role;