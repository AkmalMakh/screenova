begin;

-- A stale application revision is permanent for this request, not a transient
-- PostgreSQL serialization failure. PostgREST 14 retries 40001 indefinitely,
-- exhausting the API pool. PT409 returns a single HTTP conflict instead.
-- Replace only this error code; retain the existing function body, owner,
-- SECURITY INVOKER, search_path, grants, and all row-level security checks.
do $migration$
declare
  definition text := pg_get_functiondef('public.save_workspace(jsonb,text)'::regprocedure);
  old_raise text := 'raise exception ''Workspace changed in another session'' using errcode = ''40001'';';
  new_raise text := 'raise exception ''Workspace changed in another session'' using errcode = ''PT409'';';
begin
  if position(old_raise in definition) > 0 then
    execute replace(definition, old_raise, new_raise);
  elsif position(new_raise in definition) = 0 then
    raise exception 'Unexpected save_workspace definition; inspect before migrating';
  end if;
end;
$migration$;

commit;
