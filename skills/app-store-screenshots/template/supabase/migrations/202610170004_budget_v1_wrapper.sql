begin;

-- Keep the v1 name forever as a boolean view of v2. Earlier deployments call
-- consume_beta_budget by name; dropping it would make `vercel rollback` to any
-- of them fail every upload, import and AI request. One source of truth for
-- limits and counting lives in consume_beta_budget_v2.
-- A SQL-standard body (begin atomic) makes Postgres record that v1 depends on
-- v2, so `drop function consume_beta_budget_v2` fails loudly instead of
-- silently breaking every older deployment. To retire v2 one day, first
-- restore v1's standalone body from 202610170002, then drop v2.
create or replace function public.consume_beta_budget(kind text) returns boolean
language sql security definer set search_path = ''
begin atomic
  select public.consume_beta_budget_v2(kind) = 'ok';
end;
revoke all on function public.consume_beta_budget(text) from public, anon, authenticated;
grant execute on function public.consume_beta_budget(text) to authenticated;

commit;
