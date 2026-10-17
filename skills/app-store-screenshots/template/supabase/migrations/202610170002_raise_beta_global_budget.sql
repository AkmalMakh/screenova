begin;

-- The original global caps (ai 100, import 50, upload 500 per day across ALL
-- accounts) are too low for a real beta cohort: a few active testers exhaust
-- the shared pool and block everyone else. Raise the global ceilings 10x so
-- concurrent testers do not collide, while the per-user caps (unchanged) stay
-- the real spend guard. Body is otherwise identical to the original function.
create or replace function public.consume_beta_budget(kind text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare per_user integer; total integer; daily_user_limit integer; daily_global_limit integer;
  today date := (now() at time zone 'utc')::date;
begin
  if auth.uid() is null or not exists(select 1 from public.beta_members where user_id = auth.uid()) then return false; end if;
  if kind not in ('ai', 'upload', 'import') or kind is null then return false; end if;
  daily_user_limit := case kind when 'ai' then 20 when 'import' then 10 else 100 end;
  daily_global_limit := case kind when 'ai' then 1000 when 'import' then 500 else 5000 end;
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

commit;
