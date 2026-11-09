begin;

-- Beta cohort signals. Exports render and download entirely in the browser, so
-- the server never learned that anyone finished a set; the editor now records
-- each successful export here. Feedback is what members send from the editor's
-- Feedback dialog. Members insert their own rows only and read nothing back;
-- the operator reviews both in the SQL Editor (see RUNBOOK.md).
create table public.beta_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null check (kind in ('export')),
  project_id text check (char_length(project_id) <= 100),
  detail jsonb not null default '{}'::jsonb check (jsonb_typeof(detail) = 'object' and octet_length(detail::text) <= 2000),
  created_at timestamptz not null default now()
);
create index beta_events_user_recent on public.beta_events (user_id, created_at desc);

create table public.beta_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_id text check (char_length(project_id) <= 100),
  -- "Would you use these screenshots on your store listing?"
  would_use text check (would_use in ('yes', 'maybe', 'no')),
  message text not null default '' check (char_length(message) <= 2000),
  -- Where the dialog was opened: the editor menu, or the toast after an export.
  context text not null default 'menu' check (context in ('menu', 'export')),
  created_at timestamptz not null default now(),
  check (would_use is not null or char_length(btrim(message)) > 0)
);
create index beta_feedback_user_recent on public.beta_feedback (user_id, created_at desc);

alter table public.beta_events enable row level security;
alter table public.beta_feedback enable row level security;
revoke all on public.beta_events, public.beta_feedback from public, anon, authenticated;
-- Content columns only: id, owner and time are always set here.
grant insert (kind, project_id, detail) on public.beta_events to authenticated;
grant insert (project_id, would_use, message, context) on public.beta_feedback to authenticated;

create policy beta_events_insert_own on public.beta_events
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.beta_members m where m.user_id = (select auth.uid()))
  );
create policy beta_feedback_insert_own on public.beta_feedback
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.beta_members m where m.user_id = (select auth.uid()))
  );

commit;
