begin;

-- Credits follow what each AI call costs once design runs on Claude
-- (measured 2026-11-08):
--   ai_draft  a first draft on Opus 5.5 (new deck, App Store import,
--             screenshot analysis), $0.29-0.36, budgeted at $0.50  40 credits
--   ai_edit   a design-chat change on Sonnet 5.5, ~$0.04, up to ~$0.10
--                                                                  10 credits
-- 400 credits keep one member's worst case near $5, so a $500 beta budget
-- covers 100 members even if every one of them spends everything.
--
-- Only the first 100 members get AI. Later sign-ups still get a private
-- workspace, the manual editor, templates and export: ai_access = false and
-- 0 credits, so even consume_beta_budget_v2 (kept for rollback) refuses them.
alter table public.beta_members
  add column ai_access boolean not null default true;
alter table public.beta_members alter column credits set default 400;

-- Everyone already here starts over at 400 under the new prices.
update public.beta_members set credits = 400 where ai_access;

create or replace function public.enroll_confirmed_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare seats integer;
begin
  if new.email is null or new.email_confirmed_at is null or coalesce(new.is_anonymous, false) then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.email_confirmed_at is not null then
    -- Do not silently restore access revoked by removing a membership row.
    return new;
  end if;
  -- One enrollment at a time, so two sign-ups can't both take seat 100.
  perform pg_advisory_xact_lock(hashtextextended('screenova-ai-seats', 0));
  select count(*) into seats from public.beta_members where ai_access;
  insert into public.beta_members(user_id, ai_access, credits)
    values(new.id, seats < 100, case when seats < 100 then 400 else 0 end)
    on conflict(user_id) do nothing;
  return new;
end;
$$;
revoke all on function public.enroll_confirmed_user() from public, anon, authenticated;

-- consume_beta_budget_v3 verdicts: v2's ('ok', 'global', 'user', 'credits',
-- 'denied'), plus 'waitlist' for an AI kind from a member without an AI seat.
-- Both AI kinds share the 'ai' usage row and its daily caps; the global cap
-- drops from 1000 to 150 calls a day.
create or replace function public.consume_beta_budget_v3(kind text) returns text
language plpgsql security definer set search_path = '' as $$
declare per_user integer; total integer; daily_user_limit integer; daily_global_limit integer;
  credit_cost integer; spent integer; bucket text; has_ai boolean;
  today date := (now() at time zone 'utc')::date;
begin
  select m.ai_access into has_ai from public.beta_members m where m.user_id = auth.uid();
  if auth.uid() is null or has_ai is null then return 'denied'; end if;
  if kind is null or kind not in ('ai_draft', 'ai_edit', 'upload', 'import') then return 'denied'; end if;
  bucket := case when kind in ('ai_draft', 'ai_edit') then 'ai' else kind end;
  if bucket = 'ai' and not has_ai then return 'waitlist'; end if;
  daily_user_limit := case bucket when 'ai' then 20 when 'import' then 10 else 100 end;
  daily_global_limit := case bucket when 'ai' then 150 when 'import' then 500 else 5000 end;
  credit_cost := case kind when 'ai_draft' then 40 when 'ai_edit' then 10 else 0 end;
  -- Same lock key as v2, so both versions serialize on one daily pool.
  perform pg_advisory_xact_lock(hashtextextended('screenova-budget-' || bucket || today::text, 0));
  select coalesce(sum(u.attempts),0), coalesce(sum(u.attempts) filter(where u.user_id=auth.uid()),0)
    into total, per_user from public.beta_usage u where u.day=today and u.kind=bucket;
  if total >= daily_global_limit then return 'global'; end if;
  if per_user >= daily_user_limit then return 'user'; end if;
  if credit_cost > 0 then
    update public.beta_members m set credits = m.credits - credit_cost
      where m.user_id = auth.uid() and m.credits >= credit_cost;
    get diagnostics spent = row_count;
    if spent = 0 then return 'credits'; end if;
  end if;
  insert into public.beta_usage(user_id, day, kind, attempts) values(auth.uid(), today, bucket, 1)
    on conflict on constraint beta_usage_pkey do update set attempts=public.beta_usage.attempts+1;
  return 'ok';
end;
$$;
revoke all on function public.consume_beta_budget_v3(text) from public, anon, authenticated;
grant execute on function public.consume_beta_budget_v3(text) to authenticated;

commit;
