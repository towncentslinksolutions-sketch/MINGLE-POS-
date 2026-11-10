create table if not exists public.business_applications (
  id uuid primary key default gen_random_uuid(),
  business_name text not null,
  owner_name text not null,
  email text not null,
  phone text not null,
  business_type text not null,
  location text not null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  admin_notes text not null default '',
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists business_applications_status_created_idx
  on public.business_applications (status, created_at desc);

alter table public.business_applications enable row level security;
revoke all on public.business_applications from anon, authenticated;
grant all on public.business_applications to service_role;