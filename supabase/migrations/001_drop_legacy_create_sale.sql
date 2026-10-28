-- Migration 001 — remove the legacy 4-argument create_sale overload.
-- The app always calls create_sale(..., p_note); keeping both overloads can make PostgREST answer
-- PGRST203 ("Could not choose the best candidate function") and still allows the retired qris/card values.
-- Idempotent: safe to run more than once.

drop function if exists public.create_sale(uuid, text, numeric, jsonb);
notify pgrst, 'reload schema';
