import { createClient } from '@supabase/supabase-js';

// Do not hard-code a Supabase project here. Every deployment must use the
// environment variables configured in Vercel for the user's own project.
const configuredUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || '';
const configuredKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
  '';

export const isSupabaseConfigured = Boolean(configuredUrl && configuredKey);
const supabaseProjectUrl = configuredUrl;

// Safe inert fallback prevents the module from crashing before ConfigError can render.
const url = configuredUrl || 'https://placeholder.supabase.co';
const key = configuredKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjAsImV4cCI6MjUzNDAyMzAwMDAwfQ.placeholder';

export const supabase = createClient(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // 'implicit' so the password-reset link works even when opened in another browser or the Gmail in-app browser
    // (PKCE only works in the browser that requested the reset). Password sign-in is unaffected.
    flowType: 'implicit',
  },
});

const AUTH_ERROR_CODES = new Set(['401', '403', 'PGRST301', 'PGRST302']);

function looksLikeAuthError(error: any) {
  const message = String(error?.message || '').toLowerCase();
  const code = String(error?.code || '');
  return AUTH_ERROR_CODES.has(code) || /jwt|token|auth session|invalid claim|not authenticated|permission denied/.test(message);
}

export async function ensureFreshSession() {
  const current = await supabase.auth.getSession();
  if (current.error) throw current.error;
  const session = current.data.session;
  if (!session) return null;
  const expiresAt = (session.expires_at || 0) * 1000;
  if (expiresAt && expiresAt > Date.now() + 60_000) return session;
  const refreshed = await supabase.auth.refreshSession();
  if (refreshed.error) throw refreshed.error;
  return refreshed.data.session;
}

function looksLikeSchemaCacheError(error: any) {
  const code = String(error?.code || '');
  const message = String(error?.message || '').toLowerCase();
  return code === 'PGRST205' || code === '42P01' || message.includes('schema cache') || message.includes("could not find the table 'public.products'");
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function runWithAuthRetry<T extends { error?: any }>(operation: () => PromiseLike<T>): Promise<T> {
  await ensureFreshSession();
  let result = await operation();

  if (result?.error && looksLikeAuthError(result.error)) {
    const refreshed = await supabase.auth.refreshSession();
    if (refreshed.error || !refreshed.data.session) {
      throw refreshed.error || new Error('Sesi login sudah berakhir. Silakan masuk kembali.');
    }
    result = await operation();
  }

  // Setelah tabel baru dibuat, PostgREST kadang membutuhkan beberapa saat untuk
  // menerima schema cache baru. Retry singkat membuat aplikasi tidak langsung gagal.
  if (result?.error && looksLikeSchemaCacheError(result.error)) {
    for (const delay of [800, 1600]) {
      await wait(delay);
      result = await operation();
      if (!result?.error || !looksLikeSchemaCacheError(result.error)) break;
    }
  }

  return result;
}

export function friendlySupabaseError(error: any) {
  const message = String(error?.message || error || 'Terjadi kesalahan Supabase.');
  const lower = message.toLowerCase();
  if (lower.includes('jwt') || lower.includes('token') || lower.includes('auth session') || lower.includes('not authenticated')) {
    return 'Sesi login Supabase bermasalah atau sudah kedaluwarsa. Keluar lalu login kembali.';
  }
  if (lower.includes('schema cache') || lower.includes("could not find the table 'public.products'") || (lower.includes('relation') && lower.includes('products') && lower.includes('does not exist'))) {
    const endpoint = supabaseProjectUrl || '(URL Supabase belum terbaca)';
    const code = String(error?.code || '');
    return `Database POS belum siap: tabel public.products tidak ditemukan pada project Supabase yang sedang dipakai aplikasi (${endpoint}). Pastikan NEXT_PUBLIC_SUPABASE_URL di Vercel sama dengan Project URL tempat tabel products dibuat. Jika project-nya benar tetapi tabel belum ada/schema cache belum tersinkron, jalankan supabase/schema.sql di SQL Editor project tersebut, lalu reload schema dan redeploy. Kode: ${code || 'tidak ada'}.`;
  }
  if (lower.includes('could not find the function') || lower.includes('function public.create_sale') || error?.code === 'PGRST202') {
    return 'Fungsi checkout public.create_sale belum tersedia di project Supabase ini. Jalankan supabase/schema.sql di SQL Editor project yang sama dengan NEXT_PUBLIC_SUPABASE_URL, lalu reload schema dan redeploy. Semua metode pembayaran (tunai, e-wallet, ATM) memakai fungsi checkout yang sama.';
  }
  if (lower.includes('bucket not found') || lower.includes('storage object not found')) {
    return 'Storage foto belum disiapkan: bucket product-images belum tersedia. Jalankan SQL setup satu kali di Supabase.';
  }
  if (lower.includes('row-level security') || lower.includes('permission denied') || lower.includes('new row violates row-level security')) {
    return 'Supabase menolak akses. Pastikan kamu login dan policy RLS products/Storage sudah dibuat oleh SQL setup.';
  }
  if (lower.includes('duplicate key')) return 'Data dengan nama tersebut sudah ada.';
  if (lower.includes('failed to fetch') || lower.includes('network')) return 'Koneksi ke Supabase gagal. Periksa internet lalu coba lagi.';
  return message;
}
