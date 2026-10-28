-- MIEFLOW production POS schema. Run this entire file in Supabase SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(), name text not null unique,
  color text not null default '#111827', created_at timestamptz not null default now()
);
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(), name text not null,
  description text, price numeric(12,2) not null default 0 check(price>=0),
  cost numeric(12,2) not null default 0 check(cost>=0), stock integer not null default 0 check(stock>=0),
  image_url text, category_id uuid references public.categories(id) on delete set null,
  is_active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(), name text not null, phone text, email text, notes text, created_at timestamptz not null default now()
);
create table if not exists public.promotions (
  id uuid primary key default gen_random_uuid(), name text not null, code text unique,
  discount_percent numeric(5,2) not null default 0 check(discount_percent between 0 and 100),
  active boolean not null default true, starts_at timestamptz, ends_at timestamptz, created_at timestamptz not null default now()
);
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(), order_number text not null unique,
  customer_id uuid references public.customers(id) on delete set null,
  status text not null default 'completed' check(status in('pending','completed','cancelled')),
  payment_method text not null default 'cash' check(payment_method in('cash','qris','card')),
  subtotal numeric(12,2) not null default 0, discount numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0, amount_paid numeric(12,2) not null default 0,
  change_due numeric(12,2) not null default 0, created_at timestamptz not null default now(), cashier_id uuid references auth.users(id)
);
create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null, product_name text not null,
  quantity integer not null check(quantity>0), unit_price numeric(12,2) not null default 0, line_total numeric(12,2) not null default 0
);
create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(), product_id uuid not null references public.products(id) on delete cascade,
  quantity_delta integer not null, reason text not null, order_id uuid references public.orders(id) on delete set null,
  created_at timestamptz not null default now(), actor_id uuid references auth.users(id)
);
create index if not exists products_category_idx on public.products(category_id);
create index if not exists orders_created_at_idx on public.orders(created_at desc);
create index if not exists order_items_order_idx on public.order_items(order_id);
create index if not exists stock_movements_product_idx on public.stock_movements(product_id,created_at desc);

create or replace function public.set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end $$;
drop trigger if exists products_updated_at on public.products;
create trigger products_updated_at before update on public.products for each row execute function public.set_updated_at();

-- Storage bucket for product photos.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('product-images','product-images',true,5242880,array['image/jpeg','image/png','image/webp','image/gif'])
on conflict(id) do update set public=true,file_size_limit=5242880,allowed_mime_types=array['image/jpeg','image/png','image/webp','image/gif'];

-- Checkout is atomic: order + items + stock validation + stock movements commit together.
create or replace function public.create_sale(p_customer_id uuid, p_payment_method text, p_amount_paid numeric, p_items jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_order_id uuid; v_number text; v_subtotal numeric:=0; v_total numeric:=0; v_paid numeric:=coalesce(p_amount_paid,0); v_change numeric:=0;
  item jsonb; v_product public.products%rowtype; v_qty int; v_price numeric;
begin
  if jsonb_array_length(p_items)=0 then raise exception 'Keranjang kosong'; end if;
  if p_payment_method not in ('cash','qris','card') then raise exception 'Metode pembayaran tidak valid'; end if;
  for item in select * from jsonb_array_elements(p_items) loop
    v_qty := (item->>'quantity')::int;
    if v_qty<=0 then raise exception 'Jumlah produk tidak valid'; end if;
    select * into v_product from public.products where id=(item->>'product_id')::uuid and is_active=true for update;
    if not found then raise exception 'Produk tidak ditemukan atau nonaktif'; end if;
    if v_product.stock < v_qty then raise exception 'Stok % tidak mencukupi (tersisa %)',v_product.name,v_product.stock; end if;
    v_subtotal := v_subtotal + v_product.price*v_qty;
  end loop;
  v_total:=v_subtotal;
  if p_payment_method='cash' and v_paid<v_total then raise exception 'Uang tunai kurang'; end if;
  if p_payment_method<>'cash' then v_paid:=v_total; end if;
  v_change:=greatest(v_paid-v_total,0);
  v_number:='MF-'||to_char(now(),'YYMMDDHH24MISS')||'-'||substr(replace(gen_random_uuid()::text,'-',''),1,4);
  insert into public.orders(order_number,customer_id,status,payment_method,subtotal,total,amount_paid,change_due,cashier_id)
  values(v_number,p_customer_id,'completed',p_payment_method,v_subtotal,v_total,v_paid,v_change,auth.uid()) returning id into v_order_id;
  for item in select * from jsonb_array_elements(p_items) loop
    select * into v_product from public.products where id=(item->>'product_id')::uuid for update;
    v_qty:=(item->>'quantity')::int; v_price:=v_product.price;
    insert into public.order_items(order_id,product_id,product_name,quantity,unit_price,line_total) values(v_order_id,v_product.id,v_product.name,v_qty,v_price,v_price*v_qty);
    update public.products set stock=stock-v_qty where id=v_product.id;
    insert into public.stock_movements(product_id,quantity_delta,reason,order_id,actor_id) values(v_product.id,-v_qty,'sale',v_order_id,auth.uid());
  end loop;
  return jsonb_build_object('id',v_order_id,'order_number',v_number,'total',v_total,'amount_paid',v_paid,'change_due',v_change);
end $$;

-- Authentication/RLS: create users in Supabase Auth. The publishable key cannot bypass these rules.
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.customers enable row level security;
alter table public.promotions enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.stock_movements enable row level security;

do $$ declare t text; begin
 foreach t in array array['categories','products','customers','promotions','orders','order_items','stock_movements'] loop
  execute format('drop policy if exists "auth read" on public.%I',t);
  execute format('drop policy if exists "auth insert" on public.%I',t);
  execute format('drop policy if exists "auth update" on public.%I',t);
  execute format('drop policy if exists "auth delete" on public.%I',t);
  execute format('create policy "auth read" on public.%I for select to authenticated using (true)',t);
  execute format('create policy "auth insert" on public.%I for insert to authenticated with check (true)',t);
  execute format('create policy "auth update" on public.%I for update to authenticated using (true) with check (true)',t);
  execute format('create policy "auth delete" on public.%I for delete to authenticated using (true)',t);
 end loop;
end $$;

drop policy if exists "product images public read" on storage.objects;
drop policy if exists "product images auth upload" on storage.objects;
drop policy if exists "product images auth update" on storage.objects;
drop policy if exists "product images auth delete" on storage.objects;
create policy "product images public read" on storage.objects for select using(bucket_id='product-images');
create policy "product images auth upload" on storage.objects for insert to authenticated with check(bucket_id='product-images');
create policy "product images auth update" on storage.objects for update to authenticated using(bucket_id='product-images') with check(bucket_id='product-images');
create policy "product images auth delete" on storage.objects for delete to authenticated using(bucket_id='product-images');

grant execute on function public.create_sale(uuid,text,numeric,jsonb) to authenticated;

insert into public.categories(name,color) values('Mie','#ff5a36'),('Minuman','#2563eb'),('Snack','#f59e0b') on conflict(name) do nothing;

-- Ensure PostgREST sees newly-created tables/functions immediately after setup.
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
notify pgrst, 'reload schema';
