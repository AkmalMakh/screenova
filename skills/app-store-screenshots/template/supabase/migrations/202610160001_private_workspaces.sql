begin;

create table public.beta_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.beta_members enable row level security;
revoke all on public.beta_members from anon, authenticated;
grant select on public.beta_members to authenticated;
create policy member_self on public.beta_members for select to authenticated using (user_id = (select auth.uid()));

create table public.workspaces (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null default 0,
  active_id text,
  project_order jsonb not null default '[]',
  updated_at timestamptz not null default now()
);
create table public.projects (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  state jsonb not null check (jsonb_typeof(state) = 'object'),
  primary key(user_id, id)
);
alter table public.workspaces enable row level security;
alter table public.projects enable row level security;
revoke all on public.workspaces, public.projects from anon, authenticated;
grant select, insert, update, delete on public.workspaces, public.projects to authenticated;
create policy workspace_owner on public.workspaces for all to authenticated
  using (user_id = (select auth.uid()) and exists(select 1 from public.beta_members where user_id = (select auth.uid())))
  with check (user_id = (select auth.uid()) and exists(select 1 from public.beta_members where user_id = (select auth.uid())));
create policy project_owner on public.projects for all to authenticated
  using (user_id = (select auth.uid()) and exists(select 1 from public.beta_members where user_id = (select auth.uid())))
  with check (user_id = (select auth.uid()) and exists(select 1 from public.beta_members where user_id = (select auth.uid())));

-- One MVCC snapshot, so revision and projects cannot come from different saves.
create function public.read_workspace() returns jsonb
language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object('revision', w.revision::text, 'state', jsonb_build_object(
    'version', 1, 'activeId', w.active_id, 'order', w.project_order,
    'projects', coalesce((select jsonb_object_agg(p.id, p.state) from public.projects p where p.user_id = auth.uid()), '{}'::jsonb)))
  from public.workspaces w where w.user_id = auth.uid();
$$;

-- Lock per account and compare revisions inside the same transaction.
create function public.save_workspace(bundle jsonb, expected_revision text) returns text
language plpgsql security invoker set search_path = '' as $$
declare current_revision bigint; next_revision bigint;
begin
  if auth.uid() is null then raise exception 'Unauthorized' using errcode = '42501'; end if;
  if jsonb_typeof(bundle->'projects') is distinct from 'object' or jsonb_typeof(bundle->'order') is distinct from 'array'
    then raise exception 'Invalid workspace'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 0));
  select revision into current_revision from public.workspaces where user_id = auth.uid() for update;
  if expected_revision is distinct from coalesce(current_revision::text, 'missing') then
    raise exception 'Workspace changed in another session' using errcode = '40001';
  end if;
  next_revision := coalesce(current_revision, 0) + 1;
  insert into public.workspaces(user_id, revision, active_id, project_order)
    values(auth.uid(), next_revision, bundle->>'activeId', bundle->'order')
    on conflict(user_id) do update set revision = excluded.revision, active_id = excluded.active_id,
      project_order = excluded.project_order, updated_at = now();
  insert into public.projects(user_id, id, state)
    select auth.uid(), key, value from jsonb_each(bundle->'projects')
    on conflict(user_id, id) do update set state = excluded.state;
  delete from public.projects where user_id = auth.uid() and not (bundle->'projects' ? id);
  return next_revision::text;
end;
$$;
revoke all on function public.read_workspace(), public.save_workspace(jsonb, text) from public, anon, authenticated;
grant execute on function public.read_workspace(), public.save_workspace(jsonb, text) to authenticated;

create table public.beta_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  kind text not null check (kind in ('ai', 'upload', 'import')),
  attempts integer not null default 0,
  primary key(user_id, day, kind)
);
alter table public.beta_usage enable row level security;
revoke all on public.beta_usage from anon, authenticated;
grant select on public.beta_usage to authenticated;
create policy usage_self on public.beta_usage for select to authenticated using (user_id = (select auth.uid()));
-- Clients cannot reset counters or choose their own limits. Failed attempts count.
create function public.consume_beta_budget(kind text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare per_user integer; total integer; daily_user_limit integer; daily_global_limit integer;
  today date := (now() at time zone 'utc')::date;
begin
  if auth.uid() is null or not exists(select 1 from public.beta_members where user_id = auth.uid()) then return false; end if;
  if kind not in ('ai', 'upload', 'import') or kind is null then return false; end if;
  daily_user_limit := case kind when 'ai' then 20 when 'import' then 10 else 100 end;
  daily_global_limit := case kind when 'ai' then 100 when 'import' then 50 else 500 end;
  perform pg_advisory_xact_lock(hashtextextended('screenova-budget-' || kind || today::text, 0));
  select coalesce(sum(u.attempts),0), coalesce(sum(u.attempts) filter(where u.user_id=auth.uid()),0)
    into total, per_user from public.beta_usage u where u.day=today and u.kind=consume_beta_budget.kind;
  if total >= daily_global_limit or per_user >= daily_user_limit then return false; end if;
  insert into public.beta_usage(user_id, day, kind, attempts) values(auth.uid(), today, kind, 1)
    on conflict on constraint beta_usage_pkey do update set attempts=public.beta_usage.attempts+1;
  return true;
end;
$$;
revoke all on function public.consume_beta_budget(text) from public, anon, authenticated;
grant execute on function public.consume_beta_budget(text) to authenticated;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values('project-assets', 'project-assets', false, 8388608, array['image/png','image/jpeg','image/webp']);
create policy private_asset_owner on storage.objects for all to authenticated
  using (bucket_id='project-assets' and (storage.foldername(name))[1]=(select auth.uid())::text
    and exists(select 1 from public.beta_members where user_id=(select auth.uid())))
  with check (bucket_id='project-assets' and (storage.foldername(name))[1]=(select auth.uid())::text
    and exists(select 1 from public.beta_members where user_id=(select auth.uid())));
commit;
