-- MIEFLOW FINAL FIX
-- Jalankan file ini di Supabase SQL Editor sekali.

alter table public.orders add column if not exists notes text;

-- Izinkan metode baru sambil tetap kompatibel dengan transaksi lama qris/card.
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
    if v_product.stock < v_qty then raise exception 'Stok % tidak mencukupi (tersisa %)',v_product.name,v_product.stock; end if;
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
    update public.products set stock=stock-v_qty, updated_at=now() where id=v_product.id and owner_id=v_user;
    insert into public.stock_movements(owner_id,product_id,quantity_delta,reason,order_id,actor_id)
    values(v_user,v_product.id,-v_qty,'sale',v_order_id,v_user);
  end loop;

  return jsonb_build_object('id',v_order_id,'order_number',v_number,'total',v_total,'amount_paid',v_paid,'change_due',v_change,'notes',nullif(trim(coalesce(p_note,'')),''));
end $$;

revoke all on function public.create_sale(uuid,text,numeric,jsonb,text) from public;
grant execute on function public.create_sale(uuid,text,numeric,jsonb,text) to authenticated;
notify pgrst, 'reload schema';
