begin;

-- Public template gallery. A post is an opt-in, publisher-owned copy of a deck:
-- small preview images plus an allowlisted template (no screenshots, app icon
-- or generated assets; the app strips those before insert). Anyone may read
-- visible posts' public columns; only signed-in beta members publish, only as
-- themselves; owners unpublish; moderators hide. Workspaces stay private.
create table public.gallery_posts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 80),
  description text not null default '' check (char_length(description) <= 280),
  device text not null check (device in ('iphone', 'ipad', 'android', 'android-7', 'android-10', 'feature-graphic')),
  screen_count integer not null check (screen_count between 1 and 20),
  template jsonb not null check (jsonb_typeof(template) = 'object' and octet_length(template::text) <= 500000),
  previews text[] not null check (
    cardinality(previews) between 1 and 6
    and octet_length(array_to_string(previews, '')) <= 3000000
  ),
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create index gallery_posts_visible_recent on public.gallery_posts (created_at desc) where not hidden;
create index gallery_posts_owner on public.gallery_posts (owner_id);

alter table public.gallery_posts enable row level security;
revoke all on public.gallery_posts from public, anon, authenticated;
-- Visitors see the card and preview columns only: never the owner or template.
grant select (id, title, description, device, screen_count, previews, created_at) on public.gallery_posts to anon;
grant select on public.gallery_posts to authenticated;
-- Publishers write content columns only; id, owner, hidden and time are set here.
grant insert (title, description, device, screen_count, template, previews) on public.gallery_posts to authenticated;
grant delete on public.gallery_posts to authenticated;

create policy gallery_read_visible on public.gallery_posts
  for select to anon, authenticated using (not hidden);
create policy gallery_read_own on public.gallery_posts
  for select to authenticated using (owner_id = (select auth.uid()));
create policy gallery_publish_as_member on public.gallery_posts
  for insert to authenticated with check (
    owner_id = (select auth.uid())
    and not hidden
    and exists (select 1 from public.beta_members m where m.user_id = (select auth.uid()))
  );
create policy gallery_unpublish_own on public.gallery_posts
  for delete to authenticated using (owner_id = (select auth.uid()));

-- Moderators are managed by the operator in the SQL Editor (see RUNBOOK.md).
create table public.gallery_moderators (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.gallery_moderators enable row level security;
revoke all on public.gallery_moderators from public, anon, authenticated;

create function public.is_gallery_moderator() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.gallery_moderators where user_id = auth.uid());
$$;

create function public.hide_gallery_post(post_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_gallery_moderator() then
    raise exception 'Not a gallery moderator' using errcode = '42501';
  end if;
  update public.gallery_posts set hidden = true where id = post_id;
  return found;
end;
$$;

revoke all on function public.is_gallery_moderator() from public, anon;
revoke all on function public.hide_gallery_post(uuid) from public, anon;
grant execute on function public.is_gallery_moderator() to authenticated;
grant execute on function public.hide_gallery_post(uuid) to authenticated;

commit;
