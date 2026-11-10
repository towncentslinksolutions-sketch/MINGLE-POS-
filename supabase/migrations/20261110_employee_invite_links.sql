-- MINGLE POS: one shared employee invitation link per business owner.
-- Run this once in Supabase SQL Editor.
create table if not exists public.employee_invite_links (
  owner_id uuid primary key,
  token_hash text not null unique,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.employee_invite_links enable row level security;

-- Only trusted server routes using the service-role key may access invitation tokens.
revoke all on public.employee_invite_links from anon, authenticated;
