-- MINGLE POS: Salon and beauty module foundation.
-- Run this migration in the Supabase SQL Editor before enabling salon screens.

alter table public.business_settings
  add column if not exists business_type text not null default 'Retail',
  add column if not exists online_booking_enabled boolean not null default false;

create table if not exists public.salon_services (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 120),
  description text not null default '',
  duration_minutes integer not null default 30 check (duration_minutes between 5 and 1440),
  price numeric(12,2) not null default 0 check (price >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, name)
);

create index if not exists salon_services_owner_active_idx
  on public.salon_services (owner_id, active, name);

create table if not exists public.salon_staff_commission_settings (
  owner_id uuid not null references auth.users(id) on delete cascade,
  stylist_user_id uuid not null references auth.users(id) on delete cascade,
  commission_rate numeric(5,2) not null check (commission_rate between 0 and 100),
  updated_at timestamptz not null default now(),
  primary key (owner_id, stylist_user_id)
);

create table if not exists public.salon_appointments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  service_id uuid not null references public.salon_services(id) on delete restrict,
  stylist_user_id uuid not null references auth.users(id) on delete restrict,
  customer_name text not null check (length(trim(customer_name)) between 1 and 120),
  customer_phone text not null default '',
  customer_email text not null default '',
  booking_source text not null default 'walk_in'
    check (booking_source in ('online', 'walk_in')),
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'completed', 'cancelled', 'no_show')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  amount_charged numeric(12,2) not null default 0 check (amount_charged >= 0),
  notes text not null default '',
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create index if not exists salon_appointments_owner_start_idx
  on public.salon_appointments (owner_id, starts_at desc);
create index if not exists salon_appointments_stylist_start_idx
  on public.salon_appointments (owner_id, stylist_user_id, starts_at);

create table if not exists public.salon_commissions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  appointment_id uuid not null unique references public.salon_appointments(id) on delete restrict,
  stylist_user_id uuid not null references auth.users(id) on delete restrict,
  service_name text not null,
  gross_amount numeric(12,2) not null check (gross_amount >= 0),
  commission_rate numeric(5,2) not null check (commission_rate between 0 and 100),
  commission_amount numeric(12,2) not null check (commission_amount >= 0),
  payout_status text not null default 'pending'
    check (payout_status in ('pending', 'paid')),
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists salon_commissions_owner_status_idx
  on public.salon_commissions (owner_id, payout_status, created_at desc);
create index if not exists salon_commissions_stylist_idx
  on public.salon_commissions (owner_id, stylist_user_id, created_at desc);

-- Commission amounts are snapshotted once, when an appointment is marked completed.
create or replace function public.record_salon_commission()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_rate numeric(5,2);
  v_service_name text;
  v_gross numeric(12,2);
begin
  if new.status = 'completed'
     and (tg_op = 'INSERT' or old.status is distinct from 'completed') then
    select commission_rate
      into v_rate
      from public.salon_staff_commission_settings
     where owner_id = new.owner_id
       and stylist_user_id = new.stylist_user_id;

    if not found then
      raise exception 'Set a commission rate for this stylist before completing the appointment.';
    end if;

    select name, new.amount_charged
      into v_service_name, v_gross
      from public.salon_services
     where id = new.service_id
       and owner_id = new.owner_id;

    if not found then
      raise exception 'The selected salon service was not found for this business.';
    end if;

    insert into public.salon_commissions (
      owner_id, appointment_id, stylist_user_id, service_name,
      gross_amount, commission_rate, commission_amount
    ) values (
      new.owner_id, new.id, new.stylist_user_id, v_service_name,
      v_gross, v_rate, round(v_gross * v_rate / 100, 2)
    )
    on conflict (appointment_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists salon_appointment_commission_trigger on public.salon_appointments;
create trigger salon_appointment_commission_trigger
  after insert or update of status on public.salon_appointments
  for each row execute function public.record_salon_commission();

alter table public.salon_services enable row level security;
alter table public.salon_staff_commission_settings enable row level security;
alter table public.salon_appointments enable row level security;
alter table public.salon_commissions enable row level security;

drop policy if exists "Business members manage salon services" on public.salon_services;
create policy "Business members manage salon services"
  on public.salon_services for all to authenticated
  using (owner_id = public.current_business_owner_id())
  with check (owner_id = public.current_business_owner_id());

drop policy if exists "Business owners manage stylist commission settings" on public.salon_staff_commission_settings;
create policy "Business owners manage stylist commission settings"
  on public.salon_staff_commission_settings for all to authenticated
  using (
    owner_id = public.current_business_owner_id()
    and exists (
      select 1 from public.business_memberships bm
       where bm.owner_id = salon_staff_commission_settings.owner_id
         and bm.user_id = auth.uid()
         and bm.active = true
         and bm.role = 'owner'
    )
  )
  with check (
    owner_id = public.current_business_owner_id()
    and exists (
      select 1 from public.business_memberships bm
       where bm.owner_id = salon_staff_commission_settings.owner_id
         and bm.user_id = auth.uid()
         and bm.active = true
         and bm.role = 'owner'
    )
  );

drop policy if exists "Business members manage salon appointments" on public.salon_appointments;
create policy "Business members manage salon appointments"
  on public.salon_appointments for all to authenticated
  using (owner_id = public.current_business_owner_id())
  with check (owner_id = public.current_business_owner_id());

drop policy if exists "Business members read salon commissions" on public.salon_commissions;
create policy "Business members read salon commissions"
  on public.salon_commissions for select to authenticated
  using (owner_id = public.current_business_owner_id());

drop policy if exists "Business owners update salon commission payouts" on public.salon_commissions;
create policy "Business owners update salon commission payouts"
  on public.salon_commissions for update to authenticated
  using (
    owner_id = public.current_business_owner_id()
    and exists (
      select 1 from public.business_memberships bm
       where bm.owner_id = salon_commissions.owner_id
         and bm.user_id = auth.uid()
         and bm.active = true
         and bm.role = 'owner'
    )
  )
  with check (
    owner_id = public.current_business_owner_id()
    and exists (
      select 1 from public.business_memberships bm
       where bm.owner_id = salon_commissions.owner_id
         and bm.user_id = auth.uid()
         and bm.active = true
         and bm.role = 'owner'
    )
  );

grant select, insert, update, delete on public.salon_services to authenticated;
grant select, insert, update, delete on public.salon_staff_commission_settings to authenticated;
grant select, insert, update, delete on public.salon_appointments to authenticated;
grant select, update on public.salon_commissions to authenticated;
