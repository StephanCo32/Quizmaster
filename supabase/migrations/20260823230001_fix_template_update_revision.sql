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
