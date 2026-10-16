begin;

-- Public registration does not make workspaces public. Enroll only confirmed,
-- non-anonymous email accounts; existing owner policies and quotas still apply.
create function public.enroll_confirmed_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.email is null or new.email_confirmed_at is null or coalesce(new.is_anonymous, false) then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.email_confirmed_at is not null then
    -- Do not silently restore access revoked by removing a membership row.
    return new;
  end if;
  insert into public.beta_members(user_id) values(new.id) on conflict(user_id) do nothing;
  return new;
end;
$$;
revoke all on function public.enroll_confirmed_user() from public, anon, authenticated;

create trigger screenova_enroll_confirmed_user
after insert or update of email_confirmed_at on auth.users
for each row execute function public.enroll_confirmed_user();

-- One-time enrollment for any verified accounts created before this migration.
insert into public.beta_members(user_id)
select id from auth.users
where email is not null and email_confirmed_at is not null and not coalesce(is_anonymous, false)
on conflict(user_id) do nothing;

commit;
