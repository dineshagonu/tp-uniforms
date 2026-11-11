-- =====================================================================
-- Profile details, children, district on orders.
-- Safe to run more than once. Run in Supabase → SQL Editor.
-- =====================================================================
alter table public.profiles
  add column if not exists email        text,
  add column if not exists alt_phone    text,
  add column if not exists address_line text,
  add column if not exists village      text,
  add column if not exists mandal       text,
  add column if not exists district     text,
  add column if not exists state        text,
  add column if not exists pincode      text,
  add column if not exists updated_at   timestamptz not null default now();

-- Customers may edit their own profile, but can never change their own role.
-- (SQL Editor / service role have no auth.uid(), so admins can still be promoted there.)
create or replace function public.protect_profile_role()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role and auth.uid() is not null and not public.is_admin() then
    new.role := old.role;
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists profiles_protect_role on public.profiles;
create trigger profiles_protect_role before update on public.profiles
  for each row execute function public.protect_profile_role();

drop policy if exists "profiles update own" on public.profiles;
drop policy if exists "profiles insert own" on public.profiles;
create policy "profiles update own" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy "profiles insert own" on public.profiles for insert with check (id = auth.uid() and role = 'customer');

-- Children of the parent (for quick ordering)
create table if not exists public.children (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  gender      text check (gender in ('boy','girl')),
  school_id   uuid references public.schools(id) on delete set null,
  class_name  text,
  created_at  timestamptz not null default now()
);
create index if not exists children_user_idx on public.children(user_id);
alter table public.children enable row level security;
drop policy if exists "children own" on public.children;
drop policy if exists "children admin read" on public.children;
create policy "children own" on public.children for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "children admin read" on public.children for select using (public.is_admin());

alter table public.orders add column if not exists district text;
