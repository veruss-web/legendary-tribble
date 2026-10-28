/**
 * Pure helpers for the authentication screens (no React / Supabase imports, so they are unit-tested).
 * The screens themselves live in components/auth/login.tsx.
 */

/** Digits in the emailed reset code. Must equal Supabase → Authentication → Sign In / Providers → Email → "Email OTP Length" (default 6). */
export const OTP_LENGTH = 6;
/** Seconds before the client may ask for another code. Supabase allows one email per user per 60 s by default. */
export const RESEND_SECONDS = 60;
/** Shortest password the app accepts. */
export const MIN_PASSWORD_LENGTH = 8;

/** Digits only, capped at `length`. Unlike the money-field `digitsOnly` in lib/format.ts, leading zeros are kept: "012345" is a valid code. */
export const cleanCode = (raw: unknown, length = OTP_LENGTH) => String(raw ?? '').replace(/\D/g, '').slice(0, length);

export type PasswordChecks = { length: boolean; number: boolean; upper: boolean; symbol: boolean };

export const passwordChecks = (password: string): PasswordChecks => ({
  length: password.length >= MIN_PASSWORD_LENGTH,
  number: /\d/.test(password),
  upper: /[A-Z]/.test(password),
  symbol: /[^A-Za-z0-9]/.test(password),
});

/** Only the length is enforced; number, capital letter and symbol just make the password stronger. */
export const isPasswordValid = (password: string) => password.length >= MIN_PASSWORD_LENGTH;

export type StrengthLevel = 'empty' | 'weak' | 'fair' | 'good' | 'strong';
export type PasswordStrength = { score: number; level: StrengthLevel; label: string };

const LEVELS: StrengthLevel[] = ['weak', 'fair', 'good', 'strong'];
const LABELS = ['Lemah', 'Cukup', 'Kuat', 'Sangat kuat'];

/** `score` is the number of filled meter segments (0-4). A password shorter than the minimum is always weak, whatever else it contains. */
export function passwordStrength(password: string): PasswordStrength {
  if (!password) return { score: 0, level: 'empty', label: '' };
  const checks = passwordChecks(password);
  if (!checks.length) return { score: 1, level: 'weak', label: 'Terlalu pendek' };
  const score = 1 + Number(checks.number) + Number(checks.upper) + Number(checks.symbol);
  return { score, level: LEVELS[score - 1], label: LABELS[score - 1] };
}

/** 75 -> "1:15", 9 -> "0:09". Used for the "send again in" countdown. */
export const formatCountdown = (seconds: number) => {
  const total = Math.max(0, Math.ceil(Number(seconds) || 0));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

/** Supabase answers "For security purposes, you can only request this after 42 seconds" when a code was mailed moments ago. Returns 42, or null for any other message. */
export function throttleSeconds(message: unknown): number | null {
  const found = /security purposes.*?after\s+(\d+)\s+second/i.exec(String(message ?? ''));
  return found ? Number(found[1]) : null;
}

/** Turns a Supabase Auth error message into something a shop owner can act on (Indonesian). Unknown messages are returned unchanged. */
export function friendlyAuthError(message: unknown): string {
  const raw = String(message ?? '');
  const m = raw.toLowerCase();
  const wait = throttleSeconds(raw);
  if (m.includes('invalid login credentials')) return 'Email atau password salah.';
  if (m.includes('email not confirmed')) return 'Email belum dikonfirmasi. Hubungi admin.';
  if (wait !== null) return `Tunggu ${wait} detik sebelum meminta kode lagi.`;
  if (m.includes('rate limit') || m.includes('security purposes')) return 'Terlalu sering meminta. Tunggu beberapa menit lalu coba lagi.';
  if (m.includes('token has expired') || m.includes('otp_expired') || m.includes('invalid or has expired')) return 'Kode salah atau sudah kedaluwarsa. Periksa kembali kodenya atau minta kode baru.';
  if (m.includes('should be different from the old password') || m.includes('same_password')) return 'Password baru harus berbeda dari password lama.';
  if (m.includes('known to be weak') || m.includes('weak_password')) return 'Password terlalu mudah ditebak. Gunakan kombinasi yang lebih unik.';
  if (m.includes('should contain at least one character')) return 'Password belum memenuhi syarat. Gunakan kombinasi huruf besar, huruf kecil, dan angka.';
  if (m.includes('auth session missing')) return 'Sesi reset sudah berakhir. Mulai lagi dari Lupa password.';
  if (m.includes('error sending') || m.includes('not authorized')) return 'Pengiriman email belum diaktifkan oleh admin (SMTP). Hubungi admin.';
  if (m.includes('failed to fetch') || m.includes('network')) return 'Koneksi bermasalah. Periksa internet lalu coba lagi.';
  return raw;
}
