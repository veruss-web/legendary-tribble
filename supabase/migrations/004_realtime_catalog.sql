-- Migration 004 — realtime for the menu catalog.
-- The customer form's menu picker follows products/categories live (new menu from Produk/Kasir on any device shows up
-- right away). Supabase Realtime only streams tables that are in the `supabase_realtime` publication.
-- Without this migration the app still works: it re-reads the catalog when the tab regains focus and when the
-- customer form opens. Idempotent: safe to run more than once.

do $$
declare t text;
begin
 foreach t in array array['products','categories','orders','order_items']
 loop
  if not exists (
   select 1 from pg_publication_tables
   where pubname='supabase_realtime' and schemaname='public' and tablename=t
  ) then
   execute format('alter publication supabase_realtime add table public.%I', t);
  end if;
 end loop;
end $$;
