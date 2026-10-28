-- Migration 002 — notifications table.
-- Needed by databases that were set up with an older supabase/schema.sql (it did not create this table, so the
-- notification center silently stopped persisting). Idempotent: safe to run more than once.

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

notify pgrst, 'reload schema';
