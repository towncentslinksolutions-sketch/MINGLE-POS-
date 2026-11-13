-- MINGLE POS: customer and supplier order management.
-- Run in Supabase SQL Editor before using the Orders dashboard.

create table if not exists public.customer_orders (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  order_number text not null,
  customer_id uuid references public.customers(id) on delete set null,
  customer_name text not null,
  customer_phone text not null default '',
  status text not null default 'pending'
    check (status in ('pending','confirmed','processing','ready','completed','cancelled')),
  payment_status text not null default 'unpaid'
    check (payment_status in ('unpaid','partial','paid')),
  total numeric(12,2) not null default 0 check (total >= 0),
  notes text not null default '',
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, order_number)
);

create table if not exists public.customer_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.customer_orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  quantity numeric(12,2) not null check (quantity > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  line_total numeric(12,2) not null check (line_total >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.supplier_orders (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  order_number text not null,
  supplier_name text not null,
  supplier_phone text not null default '',
  status text not null default 'draft'
    check (status in ('draft','placed','partially_received','received','cancelled')),
  payment_status text not null default 'unpaid'
    check (payment_status in ('unpaid','partial','paid')),
  total numeric(12,2) not null default 0 check (total >= 0),
  expected_date date,
  notes text not null default '',
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, order_number)
);

create table if not exists public.supplier_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.supplier_orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  quantity numeric(12,2) not null check (quantity > 0),
  unit_cost numeric(12,2) not null check (unit_cost >= 0),
  line_total numeric(12,2) not null check (line_total >= 0),
  created_at timestamptz not null default now()
);

create index if not exists customer_orders_owner_created_idx
  on public.customer_orders(owner_id, created_at desc);
create index if not exists supplier_orders_owner_created_idx
  on public.supplier_orders(owner_id, created_at desc);
create index if not exists customer_order_items_order_idx
  on public.customer_order_items(order_id);
create index if not exists supplier_order_items_order_idx
  on public.supplier_order_items(order_id);

alter table public.customer_orders enable row level security;
alter table public.customer_order_items enable row level security;
alter table public.supplier_orders enable row level security;
alter table public.supplier_order_items enable row level security;

drop policy if exists "Business members manage customer orders" on public.customer_orders;
create policy "Business members manage customer orders" on public.customer_orders
  for all to authenticated
  using (owner_id = public.current_business_owner_id())
  with check (owner_id = public.current_business_owner_id());

drop policy if exists "Business members manage customer order items" on public.customer_order_items;
create policy "Business members manage customer order items" on public.customer_order_items
  for all to authenticated
  using (exists (
    select 1 from public.customer_orders o
    where o.id = customer_order_items.order_id
      and o.owner_id = public.current_business_owner_id()
  ))
  with check (exists (
    select 1 from public.customer_orders o
    where o.id = customer_order_items.order_id
      and o.owner_id = public.current_business_owner_id()
  ));

drop policy if exists "Business members manage supplier orders" on public.supplier_orders;
create policy "Business members manage supplier orders" on public.supplier_orders
  for all to authenticated
  using (owner_id = public.current_business_owner_id())
  with check (owner_id = public.current_business_owner_id());

drop policy if exists "Business members manage supplier order items" on public.supplier_order_items;
create policy "Business members manage supplier order items" on public.supplier_order_items
  for all to authenticated
  using (exists (
    select 1 from public.supplier_orders o
    where o.id = supplier_order_items.order_id
      and o.owner_id = public.current_business_owner_id()
  ))
  with check (exists (
    select 1 from public.supplier_orders o
    where o.id = supplier_order_items.order_id
      and o.owner_id = public.current_business_owner_id()
  ));

grant select, insert, update, delete on public.customer_orders to authenticated;
grant select, insert, update, delete on public.customer_order_items to authenticated;
grant select, insert, update, delete on public.supplier_orders to authenticated;
grant select, insert, update, delete on public.supplier_order_items to authenticated;
