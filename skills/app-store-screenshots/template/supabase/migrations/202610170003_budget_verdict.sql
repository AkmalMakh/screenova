begin;

-- consume_beta_budget_v2 returns WHY a request was refused, not just whether.
-- The app cannot tell a per-user cap from the shared global cap on its own:
-- beta_usage RLS only lets a user read their own rows. Operators need an alert
-- when the global pool runs dry, and only this function can see it.
--
--   verdict   meaning                                         counter
--   'ok'      allowed                                         +1
--   'global'  shared daily pool for this kind is exhausted    unchanged
--   'user'    this account's daily cap is exhausted           unchanged
--   'denied'  no session, not a beta member, or unknown kind  unchanged
--
-- Global is checked before per-user so a global outage is never misreported as
-- one user's limit. The advisory lock (one per kind per UTC day) serializes the
-- read-then-increment so concurrent requests cannot both take the last slot.
-- Limits and lock key are identical to 202610170002 (v1).
create or replace function public.consume_beta_budget_v2(kind text) returns text
language plpgsql security definer set search_path = '' as $$
declare per_user integer; total integer; daily_user_limit integer; daily_global_limit integer;
  today date := (now() at time zone 'utc')::date;
begin
  if auth.uid() is null or not exists(select 1 from public.beta_members where user_id = auth.uid()) then return 'denied'; end if;
  if kind is null or kind not in ('ai', 'upload', 'import') then return 'denied'; end if;
  daily_user_limit := case kind when 'ai' then 20 when 'import' then 10 else 100 end;
  daily_global_limit := case kind when 'ai' then 1000 when 'import' then 500 else 5000 end;
  perform pg_advisory_xact_lock(hashtextextended('screenova-budget-' || kind || today::text, 0));
  select coalesce(sum(u.attempts),0), coalesce(sum(u.attempts) filter(where u.user_id=auth.uid()),0)
    into total, per_user from public.beta_usage u where u.day=today and u.kind=consume_beta_budget_v2.kind;
  if total >= daily_global_limit then return 'global'; end if;
  if per_user >= daily_user_limit then return 'user'; end if;
  insert into public.beta_usage(user_id, day, kind, attempts) values(auth.uid(), today, kind, 1)
    on conflict on constraint beta_usage_pkey do update set attempts=public.beta_usage.attempts+1;
  return 'ok';
end;
$$;
revoke all on function public.consume_beta_budget_v2(text) from public, anon, authenticated;
grant execute on function public.consume_beta_budget_v2(text) to authenticated;

commit;
