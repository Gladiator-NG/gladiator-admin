alter table public.profiles
add column if not exists last_logged_in_at timestamptz;

update public.profiles as p
set last_logged_in_at = u.last_sign_in_at
from auth.users as u
where u.id = p.id
  and u.last_sign_in_at is not null
  and p.last_logged_in_at is distinct from u.last_sign_in_at;

create or replace function public.sync_profile_last_logged_in()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set
    last_logged_in_at = new.last_sign_in_at,
    updated_at = case
      when new.last_sign_in_at is distinct from last_logged_in_at then now()
      else updated_at
    end
  where id = new.id;

  return new;
end;
$$;

drop trigger if exists trg_sync_profile_last_logged_in on auth.users;

create trigger trg_sync_profile_last_logged_in
after insert or update of last_sign_in_at on auth.users
for each row
execute function public.sync_profile_last_logged_in();
