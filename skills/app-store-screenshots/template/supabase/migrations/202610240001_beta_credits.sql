begin;

-- Lifetime design credits for the beta. Every member starts with 300; one AI
-- request (design, deck suggestion, screenshot analysis) costs 10, so a member
-- gets 30 AI calls for the whole beta on top of the daily caps below. Uploads
-- and imports cost no credits. Members can read their own balance (the
-- existing member_self policy) but never change it: the column is only
-- written by consume_beta_budget_v2, which runs as the definer.
alter table public.beta_members
  add column credits integer not null default 300 check (credits >= 0);

-- consume_beta_budget_v2 verdicts (see 202610170003 for the first four):
--   'ok'       allowed                                          +1 attempt, -10 credits for 'ai'
--   'global'   shared daily pool for this kind is exhausted     unchanged
--   'user'     this account's daily cap is exhausted            unchanged
--   'credits'  this account's lifetime AI credits are spent     unchanged
--   'denied'   no session, not a beta member, or unknown kind   unchanged
-- Credits are checked after the daily caps so a daily cap is never reported
-- as "out of credits". The deduction is a single conditional UPDATE, so two
-- concurrent requests cannot both spend the last 10 credits.
create or replace function public.consume_beta_budget_v2(kind text) returns text
language plpgsql security definer set search_path = '' as $$
declare per_user integer; total integer; daily_user_limit integer; daily_global_limit integer;
  credit_cost integer; spent integer;
  today date := (now() at time zone 'utc')::date;
begin
  if auth.uid() is null or not exists(select 1 from public.beta_members where user_id = auth.uid()) then return 'denied'; end if;
  if kind is null or kind not in ('ai', 'upload', 'import') then return 'denied'; end if;
  daily_user_limit := case kind when 'ai' then 20 when 'import' then 10 else 100 end;
  daily_global_limit := case kind when 'ai' then 1000 when 'import' then 500 else 5000 end;
  credit_cost := case kind when 'ai' then 10 else 0 end;
  perform pg_advisory_xact_lock(hashtextextended('screenova-budget-' || kind || today::text, 0));
  select coalesce(sum(u.attempts),0), coalesce(sum(u.attempts) filter(where u.user_id=auth.uid()),0)
    into total, per_user from public.beta_usage u where u.day=today and u.kind=consume_beta_budget_v2.kind;
  if total >= daily_global_limit then return 'global'; end if;
  if per_user >= daily_user_limit then return 'user'; end if;
  if credit_cost > 0 then
    update public.beta_members m set credits = m.credits - credit_cost
      where m.user_id = auth.uid() and m.credits >= credit_cost;
    get diagnostics spent = row_count;
    if spent = 0 then return 'credits'; end if;
  end if;
  insert into public.beta_usage(user_id, day, kind, attempts) values(auth.uid(), today, kind, 1)
    on conflict on constraint beta_usage_pkey do update set attempts=public.beta_usage.attempts+1;
  return 'ok';
end;
$$;
revoke all on function public.consume_beta_budget_v2(text) from public, anon, authenticated;
grant execute on function public.consume_beta_budget_v2(text) to authenticated;

commit;
