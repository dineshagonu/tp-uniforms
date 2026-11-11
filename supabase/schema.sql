-- =====================================================================
-- T&P Uniforms — Supabase schema
-- Run this whole file once in Supabase Dashboard → SQL Editor → New query
-- =====================================================================
create extension if not exists pgcrypto;

-- ---------- Categories (School / College / Industrial / Hospital) ----------
create table if not exists public.categories (
  id    uuid primary key default gen_random_uuid(),
  name  text not null,
  slug  text not null unique,
  sort  int  not null default 0
);

-- ---------- Schools / institutions ----------
create table if not exists public.schools (
  id           uuid primary key default gen_random_uuid(),
  category_id  uuid references public.categories(id) on delete set null,
  name         text not null,
  slug         text not null unique,
  city         text,
  logo_url     text,
  banner_url   text,
  is_featured  boolean not null default false,   -- shows in the home-page image slider (max 10)
  is_active    boolean not null default true,
  sort         int not null default 0,
  created_at   timestamptz not null default now()
);
create index if not exists schools_category_idx on public.schools(category_id) where is_active;
create index if not exists schools_featured_idx on public.schools(is_featured, sort) where is_active;
create index if not exists schools_name_idx on public.schools using btree (lower(name));

-- ---------- Products (each uniform item for a school) ----------
create table if not exists public.products (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references public.schools(id) on delete cascade,
  name        text not null,
  item_type   text not null,                       -- shirt, pant, short, skirt, chudidhar, ...
  classes     text[] not null default '{}',        -- e.g. {'1st','2nd','3rd'}; empty = all classes
  sizes       text[] not null default '{}',        -- e.g. {'22','24','26'}; empty = no size choice
  price       numeric(10,2) not null check (price >= 0),
  mrp         numeric(10,2),
  image_url   text,
  description text,
  is_active   boolean not null default true,
  sort        int not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists products_school_idx  on public.products(school_id) where is_active;
create index if not exists products_classes_idx on public.products using gin(classes);

-- ---------- Profiles (one per login; role decides admin access) ----------
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  full_name  text,
  phone      text,
  role       text not null default 'customer' check (role in ('customer','admin')),
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, phone, full_name)
    values (new.id, new.phone, nullif(new.raw_user_meta_data->>'full_name', ''))
    on conflict do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- ---------- Orders ----------
create table if not exists public.orders (
  id                  uuid primary key default gen_random_uuid(),
  order_no            bigint generated always as identity (start with 100001) unique,
  user_id             uuid references auth.users(id) on delete set null,
  customer_name       text not null,
  phone               text not null,
  email               text,
  address             text not null,
  city                text not null,
  state               text not null,
  pincode             text not null check (pincode ~ '^[1-9][0-9]{5}$'),
  subtotal            numeric(10,2) not null,
  shipping            numeric(10,2) not null default 0,
  total               numeric(10,2) not null,
  payment_method      text not null check (payment_method in ('cod','online')),
  payment_status      text not null default 'pending'
                        check (payment_status in ('pending','paid','failed','cod','refunded')),
  status              text not null default 'placed'
                        check (status in ('placed','confirmed','in_production','shipped','delivered','cancelled')),
  razorpay_order_id   text unique,
  razorpay_payment_id text,
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists orders_user_idx    on public.orders(user_id, created_at desc);
create index if not exists orders_created_idx on public.orders(created_at desc);
create index if not exists orders_status_idx  on public.orders(status);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end $$;
drop trigger if exists orders_touch on public.orders;
create trigger orders_touch before update on public.orders
  for each row execute function public.touch_updated_at();

create table if not exists public.order_items (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references public.orders(id) on delete cascade,
  product_id   uuid references public.products(id) on delete set null,
  school_name  text,
  product_name text not null,
  item_type    text,
  class_name   text,
  size         text,
  qty          int not null check (qty > 0 and qty <= 100),
  unit_price   numeric(10,2) not null,
  line_total   numeric(10,2) not null
);
create index if not exists order_items_order_idx on public.order_items(order_id);

-- =====================================================================
-- Row Level Security
-- Orders are only ever INSERTED by the server (service-role key), so
-- customers can never set their own prices or mark orders paid.
-- =====================================================================
alter table public.categories  enable row level security;
alter table public.schools     enable row level security;
alter table public.products    enable row level security;
alter table public.profiles    enable row level security;
alter table public.orders      enable row level security;
alter table public.order_items enable row level security;

drop policy if exists "categories read"  on public.categories;
drop policy if exists "categories admin" on public.categories;
create policy "categories read"  on public.categories for select using (true);
create policy "categories admin" on public.categories for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "schools read"  on public.schools;
drop policy if exists "schools admin" on public.schools;
create policy "schools read"  on public.schools for select using (is_active or public.is_admin());
create policy "schools admin" on public.schools for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "products read"  on public.products;
drop policy if exists "products admin" on public.products;
create policy "products read"  on public.products for select using (is_active or public.is_admin());
create policy "products admin" on public.products for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "profiles read own"    on public.profiles;
drop policy if exists "profiles admin update" on public.profiles;
create policy "profiles read own"     on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy "profiles admin update" on public.profiles for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists "orders read own"     on public.orders;
drop policy if exists "orders admin update" on public.orders;
create policy "orders read own"     on public.orders for select using (user_id = auth.uid() or public.is_admin());
create policy "orders admin update" on public.orders for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists "order items read own" on public.order_items;
create policy "order items read own" on public.order_items for select using (
  exists (select 1 from public.orders o
          where o.id = order_id and (o.user_id = auth.uid() or public.is_admin()))
);

-- =====================================================================
-- Storage bucket for uploaded images (public read, admin write)
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('uniforms', 'uniforms', true)
on conflict (id) do nothing;

drop policy if exists "uniforms public read"  on storage.objects;
drop policy if exists "uniforms admin insert" on storage.objects;
drop policy if exists "uniforms admin update" on storage.objects;
drop policy if exists "uniforms admin delete" on storage.objects;
create policy "uniforms public read"  on storage.objects for select using (bucket_id = 'uniforms');
create policy "uniforms admin insert" on storage.objects for insert with check (bucket_id = 'uniforms' and public.is_admin());
create policy "uniforms admin update" on storage.objects for update using (bucket_id = 'uniforms' and public.is_admin());
create policy "uniforms admin delete" on storage.objects for delete using (bucket_id = 'uniforms' and public.is_admin());

-- =====================================================================
-- Seed categories
-- =====================================================================
insert into public.categories (name, slug, sort) values
  ('School Uniforms',     'school-uniforms',     1),
  ('College Uniforms',    'college-uniforms',    2),
  ('Industrial Uniforms', 'industrial-uniforms', 3),
  ('Hospital Uniforms',   'hospital-uniforms',   4)
on conflict (slug) do nothing;

-- =====================================================================
-- Make yourself admin (run AFTER creating your user in Auth → Users):
--   update public.profiles set role = 'admin'
--   where id = (select id from auth.users where email = 'sales@tandp.co.in');
-- =====================================================================
