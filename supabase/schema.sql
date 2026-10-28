-- ============================================================
-- MIEFLOW — DATABASE SCHEMA (canonical and idempotent)
-- ============================================================
-- Run in the Supabase SQL Editor of the SAME project that
-- NEXT_PUBLIC_SUPABASE_URL points to. Safe on an empty project and on an
-- existing one (create ... if not exists / drop ... if exists).
--
-- Result:
--   User A   -> only User A's data
--   User B   -> only User B's data
--   New user -> empty dashboard until they create their own data
--
-- Legacy rows without owner_id are given to the OLDEST Supabase account
-- (so register at least one account first). To hand them to another
-- account instead, see "OPTIONAL: MOVE LEGACY DATA" at the end of this file.
--
-- Contents: tables, owner_id backfill, indexes, RLS, Storage policies,
--           payment-method constraint, notifications, atomic checkout
--           RPC (public.create_sale).
-- ============================================================

create extension if not exists pgcrypto;

-- Buat tabel jika project masih kosong. Aman juga dijalankan pada project lama.
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  color text not null default '#111827',
  created_at timestamptz not null default now(),
  owner_id uuid references auth.users(id) on delete cascade
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  price numeric(12,2) not null default 0 check(price>=0),
  cost numeric(12,2) not null default 0 check(cost>=0),
  stock integer not null default 0 check(stock>=0),
  image_url text,
  category_id uuid references public.categories(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  owner_id uuid references auth.users(id) on delete cascade
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  email text,
  notes text,
  created_at timestamptz not null default now(),
  owner_id uuid references auth.users(id) on delete cascade
);

create table if not exists public.promotions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text unique,
  discount_percent numeric(5,2) not null default 0 check(discount_percent between 0 and 100),
  active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  owner_id uuid references auth.users(id) on delete cascade
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  customer_id uuid references public.customers(id) on delete set null,
  status text not null default 'completed' check(status in('pending','completed','cancelled')),
  payment_method text not null default 'cash' check(payment_method in('cash','qris','card')),
  subtotal numeric(12,2) not null default 0,
  discount numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  amount_paid numeric(12,2) not null default 0,
  change_due numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  cashier_id uuid references auth.users(id),
  owner_id uuid references auth.users(id) on delete cascade
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  quantity integer not null check(quantity>0),
  unit_price numeric(12,2) not null default 0,
  line_total numeric(12,2) not null default 0,
  owner_id uuid references auth.users(id) on delete cascade
);

create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  quantity_delta integer not null,
  reason text not null,
  order_id uuid references public.orders(id) on delete set null,
  created_at timestamptz not null default now(),
  actor_id uuid references auth.users(id),
  owner_id uuid references auth.users(id) on delete cascade
);

create index if not exists products_category_idx on public.products(category_id);
create index if not exists orders_created_at_idx on public.orders(created_at desc);
create index if not exists order_items_order_idx on public.order_items(order_id);
create index if not exists stock_movements_product_idx on public.stock_movements(product_id,created_at desc);

-- ---------- Tambahkan owner_id ke semua tabel tenant ----------
alter table if exists public.categories add column if not exists owner_id uuid references auth.users(id) on delete cascade;
alter table if exists public.products add column if not exists owner_id uuid references auth.users(id) on delete cascade;
alter table if exists public.customers add column if not exists owner_id uuid references auth.users(id) on delete cascade;
alter table if exists public.promotions add column if not exists owner_id uuid references auth.users(id) on delete cascade;
alter table if exists public.orders add column if not exists owner_id uuid references auth.users(id) on delete cascade;
alter table if exists public.order_items add column if not exists owner_id uuid references auth.users(id) on delete cascade;
alter table if exists public.stock_movements add column if not exists owner_id uuid references auth.users(id) on delete cascade;

-- Pastikan kolom dasar tetap tersedia pada project lama.
alter table if exists public.products add column if not exists description text;
alter table if exists public.products add column if not exists price numeric(12,2) not null default 0;
alter table if exists public.products add column if not exists cost numeric(12,2) not null default 0;
alter table if exists public.products add column if not exists stock integer not null default 0;
alter table if exists public.products add column if not exists image_url text;
alter table if exists public.products add column if not exists category_id uuid;
alter table if exists public.products add column if not exists is_active boolean not null default true;
alter table if exists public.products add column if not exists created_at timestamptz not null default now();
alter table if exists public.products add column if not exists updated_at timestamptz not null default now();

create or replace function public.set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end $$;
drop trigger if exists products_updated_at on public.products;
create trigger products_updated_at before update on public.products for each row execute function public.set_updated_at();

-- ---------- Backfill data lama ----------
-- Akun pertama/tertua dianggap sebagai pemilik data lama.
do $$
declare
  legacy_owner uuid;
begin
  select id into legacy_owner
  from auth.users
  order by created_at asc
  limit 1;

  if legacy_owner is not null then
    update public.categories set owner_id = legacy_owner where owner_id is null;
    update public.products set owner_id = legacy_owner where owner_id is null;
    update public.customers set owner_id = legacy_owner where owner_id is null;
    update public.promotions set owner_id = legacy_owner where owner_id is null;
    update public.orders set owner_id = coalesce(owner_id, cashier_id, legacy_owner) where owner_id is null;

    update public.order_items oi
    set owner_id = o.owner_id
    from public.orders o
    where oi.order_id = o.id and oi.owner_id is null;

    update public.stock_movements sm
    set owner_id = coalesce(o.owner_id, p.owner_id, legacy_owner)
    from public.products p
    left join public.orders o on o.id = sm.order_id
    where sm.product_id = p.id and sm.owner_id is null;
  end if;
end $$;

-- Jika ada order lama yang owner_id masih kosong, ambil dari cashier_id.
update public.orders
set owner_id = cashier_id
where owner_id is null and cashier_id is not null;

update public.order_items oi
set owner_id = o.owner_id
from public.orders o
where oi.order_id = o.id and oi.owner_id is null and o.owner_id is not null;

update public.stock_movements sm
set owner_id = coalesce(o.owner_id, p.owner_id)
from public.products p
left join public.orders o on o.id = sm.order_id
where sm.product_id = p.id and sm.owner_id is null;

-- ---------- Index ----------
create index if not exists categories_owner_idx on public.categories(owner_id);
create index if not exists products_owner_idx on public.products(owner_id);
create index if not exists customers_owner_idx on public.customers(owner_id);
create index if not exists promotions_owner_idx on public.promotions(owner_id);
create index if not exists orders_owner_idx on public.orders(owner_id, created_at desc);
create index if not exists order_items_owner_idx on public.order_items(owner_id);
create index if not exists stock_movements_owner_idx on public.stock_movements(owner_id, created_at desc);

-- Nama kategori boleh sama di toko yang berbeda.
do $$
declare
  c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.categories'::regclass
      and contype = 'u'
      and pg_get_constraintdef(oid) ilike '%(name)%'
  loop
    execute format('alter table public.categories drop constraint if exists %I', c.conname);
  end loop;
exception when undefined_table then
  null;
end $$;
create unique index if not exists categories_owner_name_unique on public.categories(owner_id, name);

-- ---------- RLS ----------
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.customers enable row level security;
alter table public.promotions enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.stock_movements enable row level security;

do $$
declare t text;
begin
  foreach t in array array['categories','products','customers','promotions','orders','order_items','stock_movements'] loop
    execute format('drop policy if exists "auth read" on public.%I',t);
    execute format('drop policy if exists "auth insert" on public.%I',t);
    execute format('drop policy if exists "auth update" on public.%I',t);
    execute format('drop policy if exists "auth delete" on public.%I',t);
    execute format('drop policy if exists "mieflow tenant select" on public.%I',t);
    execute format('drop policy if exists "mieflow tenant insert" on public.%I',t);
    execute format('drop policy if exists "mieflow tenant update" on public.%I',t);
    execute format('drop policy if exists "mieflow tenant delete" on public.%I',t);
    execute format('create policy "mieflow tenant select" on public.%I for select to authenticated using (owner_id = auth.uid())',t);
    execute format('create policy "mieflow tenant insert" on public.%I for insert to authenticated with check (owner_id = auth.uid())',t);
    execute format('create policy "mieflow tenant update" on public.%I for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid())',t);
    execute format('create policy "mieflow tenant delete" on public.%I for delete to authenticated using (owner_id = auth.uid())',t);
  end loop;
end $$;

-- ---------- Storage ----------
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('product-images','product-images',true,5242880,array['image/jpeg','image/png','image/webp','image/gif'])
on conflict(id) do update set public=true,file_size_limit=5242880,allowed_mime_types=array['image/jpeg','image/png','image/webp','image/gif'];

drop policy if exists "product images public read" on storage.objects;
drop policy if exists "product images auth upload" on storage.objects;
drop policy if exists "product images auth update" on storage.objects;
drop policy if exists "product images auth delete" on storage.objects;
drop policy if exists "mieflow product images auth upload" on storage.objects;
drop policy if exists "mieflow product images auth update" on storage.objects;
drop policy if exists "mieflow product images auth delete" on storage.objects;
create policy "product images public read" on storage.objects for select using(bucket_id='product-images');
create policy "mieflow product images auth upload" on storage.objects
  for insert to authenticated
  with check (bucket_id='product-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "mieflow product images auth update" on storage.objects
  for update to authenticated
  using (bucket_id='product-images' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id='product-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "mieflow product images auth delete" on storage.objects
  for delete to authenticated
  using (bucket_id='product-images' and (storage.foldername(name))[1] = auth.uid()::text);

grant usage on schema public to authenticated;
grant select,insert,update,delete on public.categories,public.products,public.customers,public.promotions,public.orders,public.order_items,public.stock_movements to authenticated;

notify pgrst, 'reload schema';

-- ============================================================
-- CEK SETELAH RUN
-- ============================================================
-- select id,email from auth.users order by created_at;
-- select owner_id,count(*) from public.products group by owner_id;
-- select owner_id,count(*) from public.categories group by owner_id;
-- select owner_id,count(*) from public.customers group by owner_id;
-- select owner_id,count(*) from public.orders group by owner_id;
-- ============================================================

-- ---------- Notifications (stored server-side, not in localStorage) ----------
create table if not exists public.notifications (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 type text not null check (type in ('danger','warning','success','info')),
 title text not null,
 detail text not null default '',
 page text not null,
 target_id text,
 is_read boolean not null default false,
 created_at timestamptz not null default now()
);
create index if not exists notifications_owner_created_idx on public.notifications(owner_id,created_at desc);
alter table public.notifications enable row level security;
drop policy if exists "notifications_owner_only" on public.notifications;
create policy "notifications_owner_only" on public.notifications for all using (owner_id=auth.uid()) with check (owner_id=auth.uid());
grant select,insert,update,delete on public.notifications to authenticated;


-- ---------- Order notes + payment methods + checkout function ----------

alter table public.orders add column if not exists notes text;

-- Allow the current methods (cash, ewallet, atm) while staying compatible with old qris/card orders.
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conrelid='public.orders'::regclass and conname='orders_payment_method_check'
  ) then
    alter table public.orders drop constraint orders_payment_method_check;
  end if;
end $$;

alter table public.orders
  add constraint orders_payment_method_check
  check (payment_method in ('cash','ewallet','atm','qris','card'));

-- Atomic, tenant-safe checkout. The legacy 4-argument overload is dropped on purpose: two overloads where one is a
-- prefix of the other make PostgREST fail with PGRST203 ("Could not choose the best candidate function").
drop function if exists public.create_sale(uuid, text, numeric, jsonb);

-- ---------- POS stock: reduce immediately when menu is added ----------
create or replace function public.adjust_product_stock(
  p_product_id uuid,
  p_quantity_delta integer
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_user uuid := auth.uid();
  v_product public.products%rowtype;
  v_next integer;
begin
  if v_user is null then raise exception 'Login diperlukan'; end if;
  if p_quantity_delta is null or p_quantity_delta = 0 then raise exception 'Perubahan stok tidak valid'; end if;
  select * into v_product from public.products
  where id=p_product_id and owner_id=v_user and is_active=true for update;
  if not found then raise exception 'Produk tidak ditemukan pada akun ini atau nonaktif'; end if;
  v_next := v_product.stock + p_quantity_delta;
  if v_next < 0 then raise exception 'Stok % tidak mencukupi (tersisa %)',v_product.name,v_product.stock; end if;
  update public.products set stock=v_next,updated_at=now() where id=v_product.id and owner_id=v_user;
  insert into public.stock_movements(owner_id,product_id,quantity_delta,reason,actor_id)
  values(v_user,v_product.id,p_quantity_delta,case when p_quantity_delta < 0 then 'cart reservation' else 'cart release' end,v_user);
  return jsonb_build_object('id',v_product.id,'stock',v_next);
end $$;
revoke all on function public.adjust_product_stock(uuid,integer) from public;
grant execute on function public.adjust_product_stock(uuid,integer) to authenticated;

create or replace function public.create_sale(
  p_customer_id uuid,
  p_payment_method text,
  p_amount_paid numeric,
  p_items jsonb,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_user uuid := auth.uid();
  v_order_id uuid;
  v_number text;
  v_subtotal numeric := 0;
  v_total numeric := 0;
  v_paid numeric := coalesce(p_amount_paid,0);
  v_change numeric := 0;
  item jsonb;
  v_product public.products%rowtype;
  v_qty int;
  v_price numeric;
  v_customer_owner uuid;
begin
  if v_user is null then raise exception 'Login diperlukan'; end if;
  if p_items is null or jsonb_array_length(p_items)=0 then raise exception 'Keranjang kosong'; end if;
  if p_payment_method not in ('cash','ewallet','atm') then raise exception 'Metode pembayaran tidak valid'; end if;

  if p_customer_id is not null then
    select owner_id into v_customer_owner from public.customers where id=p_customer_id;
    if v_customer_owner is distinct from v_user then raise exception 'Pelanggan bukan milik akun ini'; end if;
  end if;

  for item in select * from jsonb_array_elements(p_items) loop
    v_qty := (item->>'quantity')::int;
    if v_qty is null or v_qty <= 0 then raise exception 'Jumlah produk tidak valid'; end if;
    select * into v_product from public.products
      where id=(item->>'product_id')::uuid and owner_id=v_user and is_active=true for update;
    if not found then raise exception 'Produk tidak ditemukan pada akun ini atau nonaktif'; end if;
    -- No stock check here on purpose: the quantity was already taken from products.stock by adjust_product_stock when it was added to the cart,
    -- so comparing the (reduced) stock with the cart quantity would reject any order larger than the remaining stock.
    v_subtotal := v_subtotal + v_product.price*v_qty;
  end loop;

  v_total := v_subtotal;
  if p_payment_method='cash' and v_paid<v_total then raise exception 'Uang tunai kurang'; end if;
  if p_payment_method<>'cash' then v_paid:=v_total; end if;
  v_change:=greatest(v_paid-v_total,0);
  v_number:='MF-'||to_char(now(),'YYMMDDHH24MISS')||'-'||substr(replace(gen_random_uuid()::text,'-',''),1,4);

  insert into public.orders(owner_id,order_number,customer_id,status,payment_method,subtotal,total,amount_paid,change_due,cashier_id,notes)
  values(v_user,v_number,p_customer_id,'completed',p_payment_method,v_subtotal,v_total,v_paid,v_change,v_user,nullif(trim(coalesce(p_note,'')),''))
  returning id into v_order_id;

  for item in select * from jsonb_array_elements(p_items) loop
    select * into v_product from public.products where id=(item->>'product_id')::uuid and owner_id=v_user for update;
    v_qty:=(item->>'quantity')::int;
    v_price:=v_product.price;
    insert into public.order_items(owner_id,order_id,product_id,product_name,quantity,unit_price,line_total)
    values(v_user,v_order_id,v_product.id,v_product.name,v_qty,v_price,v_price*v_qty);
    -- Stock was already reduced when the item was added to the POS cart; do not decrement again.
  end loop;

  return jsonb_build_object('id',v_order_id,'order_number',v_number,'total',v_total,'amount_paid',v_paid,'change_due',v_change,'notes',nullif(trim(coalesce(p_note,'')),''));
end $$;

revoke all on function public.create_sale(uuid,text,numeric,jsonb,text) from public;
grant execute on function public.create_sale(uuid,text,numeric,jsonb,text) to authenticated;
notify pgrst, 'reload schema';

-- ============================================================
-- OPTIONAL: MOVE LEGACY DATA TO ANOTHER ACCOUNT (commented out on purpose)
-- ============================================================
-- 1) Find the account ids:   select id, email, created_at from auth.users order by created_at;
-- 2) Replace both UUIDs below, uncomment the block and run it once.
-- Product photos live in Storage under "<user id>/products/..."; moving rows does not move those files.
--
-- do $$
-- declare
--   v_from uuid := '00000000-0000-0000-0000-000000000000';  -- current owner
--   v_to   uuid := '00000000-0000-0000-0000-000000000000';  -- new owner
-- begin
--   update public.categories      set owner_id = v_to where owner_id = v_from;
--   update public.products        set owner_id = v_to where owner_id = v_from;
--   update public.customers       set owner_id = v_to where owner_id = v_from;
--   update public.promotions      set owner_id = v_to where owner_id = v_from;
--   update public.orders          set owner_id = v_to where owner_id = v_from;
--   update public.order_items     set owner_id = v_to where owner_id = v_from;
--   update public.stock_movements set owner_id = v_to where owner_id = v_from;
--   update public.notifications   set owner_id = v_to where owner_id = v_from;
-- end $$;
