-- Run this ONLY if you already ran schema.sql before mobile-OTP login was added.
-- Saves the customer's mobile number and name into their profile on sign-up.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, phone, full_name)
    values (new.id, new.phone, nullif(new.raw_user_meta_data->>'full_name', ''))
    on conflict do nothing;
  return new;
end $$;

create index if not exists profiles_phone_idx on public.profiles(phone);
