'use client';

/**
 * Authentication screens: sign in, forgot password (emailed code), set a new password, and the missing-configuration notice.
 *
 * There is NO public sign-up. Accounts are created by the administrator
 * (Supabase → Authentication → Users → Add user) and handed to the client.
 * Also switch off "Allow new users to sign up" in Supabase, otherwise the API still accepts sign-ups.
 *
 * "Lupa password" is a three-step flow the client completes alone; the administrator is not involved:
 *   1. <Login/> mode "forgot": the client types their email and Supabase mails a 6-digit code (resetPasswordForEmail).
 *   2. <Login/> mode "code": the client types the code (verifyOtp, type "recovery"). That signs them in, so the page is told first
 *      (onRecoveryStart) and keeps showing <ResetPassword/> instead of the dashboard until a new password is saved.
 *   3. <ResetPassword/>: the new-password form (updateUser).
 * The "Reset Password" email template in Supabase must contain {{ .Token }}: see supabase/email-templates/recovery.html and
 * docs/CLIENT-ONBOARDING.md. Reset links from the old template still work: they fire PASSWORD_RECOVERY, handled in app/page.tsx.
 * Needs custom SMTP + Site URL in Supabase as well.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChangeEvent, ClipboardEvent, FormEvent, KeyboardEvent, ReactNode } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Check, CheckCircle2, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  MIN_PASSWORD_LENGTH,
  OTP_LENGTH,
  RESEND_SECONDS,
  cleanCode,
  formatCountdown,
  friendlyAuthError,
  isPasswordValid,
  passwordChecks,
  passwordStrength,
  throttleSeconds,
} from '@/lib/auth';

/** Where "request an account" emails go. Override with NEXT_PUBLIC_ADMIN_EMAIL. */
const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'abdullohali7@gmail.com';
const REQUEST_ACCESS_HREF =
  `mailto:${ADMIN_EMAIL}?subject=${encodeURIComponent('Permintaan akun Mieflow POS')}` +
  `&body=${encodeURIComponent('Halo, saya ingin mendaftar akun Mieflow POS.\n\nNama toko:\nNama pemilik:\nEmail untuk login:\nNo. WhatsApp:\n')}`;

export function ConfigError() {
  return (
    <div className="auth-screen">
      <div className="login-card">
        <div className="brand-logo big">M</div>
        <span className="eyebrow">MIEFLOW POS</span>
        <h1>Konfigurasi belum lengkap</h1>
        <p>
          Deployment Vercel berhasil dibuat, tetapi environment variable Supabase belum dipasang. Tambahkan{' '}
          <b>NEXT_PUBLIC_SUPABASE_URL</b> dan <b>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</b> di Vercel, lalu lakukan redeploy.
        </p>
        <div className="error">Vercel → Project → Settings → Environment Variables</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ shared pieces */

function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="auth-screen auth-modern">
      <div className="auth-glow glow-one" />
      <div className="auth-glow glow-two" />
      <div className="auth-layout">
        <AuthBrand />
        {children}
      </div>
    </div>
  );
}

function PanelHead({ title, eyebrow, children }: { title: string; eyebrow?: ReactNode; children: ReactNode }) {
  return (
    <div className="auth-panel-head">
      <div>
        {eyebrow ?? <span className="eyebrow">MIEFLOW POS</span>}
        <h1>{title}</h1>
        <p>{children}</p>
      </div>
      <div className="secure-badge">
        <ShieldCheck size={15} /> Secure
      </div>
    </div>
  );
}

function EyeToggle({ shown, onToggle }: { shown: boolean; onToggle: () => void }) {
  return (
    <button type="button" className="field-action" onClick={onToggle} aria-label={shown ? 'Sembunyikan password' : 'Tampilkan password'}>
      {shown ? <EyeOff size={17} /> : <Eye size={17} />}
    </button>
  );
}

const RECOVERY_STEPS = ['Email', 'Kode', 'Password'];

/** Progress of the forgot-password flow: Email → Kode → Password. */
function RecoverySteps({ current }: { current: 1 | 2 | 3 }) {
  return (
    <ol className="rc-steps" aria-label="Langkah reset password">
      {RECOVERY_STEPS.map((label, i) => {
        const n = i + 1;
        const state = n < current ? 'done' : n === current ? 'active' : 'todo';
        return (
          <li key={label} className={`rc-step ${state}`} aria-current={state === 'active' ? 'step' : undefined}>
            <span className="rc-dot">{state === 'done' ? <Check size={13} strokeWidth={3} /> : n}</span>
            <span className="rc-label">{label}</span>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * One box per digit. Typing moves to the next box, Backspace to the previous one, pasting (or the keyboard's "code from email"
 * suggestion) fills every box, and `onComplete` fires as soon as the last digit is in. The value is always a contiguous string.
 */
function OtpInput({
  value,
  onChange,
  onComplete,
  readOnly,
  invalid,
}: {
  value: string;
  onChange: (next: string) => void;
  onComplete: (code: string) => void;
  readOnly: boolean;
  invalid: boolean;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length: OTP_LENGTH }, (_, i) => value[i] || '');

  const focusAt = useCallback((i: number) => {
    const el = refs.current[Math.min(OTP_LENGTH - 1, Math.max(0, i))];
    if (el) {
      el.focus();
      el.select();
    }
  }, []);

  // The cursor starts on the first box and returns there when the code is cleared after a wrong attempt.
  useEffect(() => {
    if (!value) focusAt(0);
  }, [value, focusAt]);

  const commit = (next: string) => {
    onChange(next);
    if (next.length === OTP_LENGTH) onComplete(next);
  };

  const handleChange = (i: number, e: ChangeEvent<HTMLInputElement>) => {
    if (readOnly) return;
    const raw = e.target.value;
    if (raw === '') {
      // box emptied by a keyboard that does not report Backspace
      if (digits[i]) onChange(value.slice(0, i) + value.slice(i + 1));
      return;
    }
    let typed = cleanCode(raw);
    // a box that already holds a digit receives the old and the new character: keep only the new one
    if (digits[i] && typed.length === 2) typed = typed[0] === digits[i] ? typed[1] : typed[0];
    if (!typed) return;
    const at = Math.min(i, value.length);
    commit((value.slice(0, at) + typed + value.slice(at + typed.length)).slice(0, OTP_LENGTH));
    focusAt(at + typed.length);
  };

  const handleKeyDown = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (readOnly) return;
    if (e.key === 'Backspace') {
      e.preventDefault();
      if (digits[i]) {
        onChange(value.slice(0, i) + value.slice(i + 1));
        focusAt(i);
      } else if (i > 0) {
        onChange(value.slice(0, i - 1) + value.slice(i));
        focusAt(i - 1);
      }
    } else if (e.key === 'Delete') {
      e.preventDefault();
      onChange(value.slice(0, i) + value.slice(i + 1));
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      focusAt(i - 1);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      focusAt(i + 1);
    } else if (e.key === 'Home') {
      e.preventDefault();
      focusAt(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      focusAt(OTP_LENGTH - 1);
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (readOnly) return;
    const pasted = cleanCode(e.clipboardData.getData('text'));
    if (!pasted) return;
    commit(pasted);
    focusAt(pasted.length);
  };

  return (
    <div
      className={`rc-code${invalid ? ' invalid' : ''}`}
      style={{ gridTemplateColumns: `repeat(${OTP_LENGTH},minmax(0,1fr))` }}
      role="group"
      aria-label={`Kode verifikasi ${OTP_LENGTH} digit`}
    >
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          className={`rc-cell${d ? ' filled' : ''}`}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          aria-label={`Digit ${i + 1} dari ${OTP_LENGTH}`}
          aria-invalid={invalid || undefined}
          value={d}
          readOnly={readOnly}
          onChange={(e) => handleChange(i, e)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          onFocus={(e) => e.target.select()}
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ sign in + forgot password (steps 1 and 2) */

type Mode = 'login' | 'forgot' | 'code';

export function Login({ onRecoveryStart, onRecoveryCancel }: { onRecoveryStart: () => void; onRecoveryCancel: () => void }) {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [code, setCode] = useState('');
  const [badCode, setBadCode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const verifying = useRef(false);
  // The form animates itself on the first render; only later step changes animate the inner content.
  const entered = useRef(false);
  useEffect(() => {
    entered.current = true;
  }, []);

  // "Send again in 0:42" countdown.
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const switchMode = (next: Mode) => {
    setMode(next);
    setError('');
    setNotice('');
    setPassword('');
    setCode('');
    setBadCode(false);
  };

  /** Step 1: mail a code to the address typed here, i.e. to the client, not to the administrator. */
  const sendCode = async (resend: boolean) => {
    setLoading(true);
    setError('');
    setNotice('');
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin });
    setLoading(false);
    const wait = err ? throttleSeconds(err.message) : null;
    if (err && wait === null) {
      setError(friendlyAuthError(err.message));
      return;
    }
    setCode('');
    setBadCode(false);
    setCooldown(wait ?? RESEND_SECONDS);
    // Throttled means a code was mailed moments ago: let the client type it instead of blocking them.
    if (wait !== null) setNotice('Kode sebelumnya masih berlaku. Periksa email Anda, atau kirim ulang setelah hitung mundur selesai.');
    else if (resend) setNotice('Kode baru sudah dikirim ke email Anda.');
    setMode('code');
  };

  /** Step 2: check the code. Success signs the client in; the page then swaps this screen for <ResetPassword/>. */
  const verify = async (value: string) => {
    if (verifying.current || value.length < OTP_LENGTH) return;
    verifying.current = true;
    setLoading(true);
    setError('');
    setNotice('');
    setBadCode(false);
    // Verifying signs the client in. Tell the page first so it keeps them on the new-password screen, not the dashboard.
    onRecoveryStart();
    const { error: err } = await supabase.auth.verifyOtp({ email: email.trim(), token: value, type: 'recovery' });
    verifying.current = false;
    setLoading(false);
    if (!err) return;
    onRecoveryCancel();
    setError(friendlyAuthError(err.message));
    setBadCode(true);
    setCode('');
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (mode === 'forgot') {
      await sendCode(false);
      return;
    }
    if (mode === 'code') {
      await verify(code);
      return;
    }
    setLoading(true);
    setError('');
    setNotice('');
    const { data, error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (err) setError(friendlyAuthError(err.message));
    else if (!data.session) setError('Login berhasil tetapi sesi belum tersedia. Coba masuk lagi.');
    setLoading(false);
  };

  const errorBanner = error && (
    <div className="error auth-error" role="alert">
      <span>{error}</span>
    </div>
  );

  return (
    <AuthShell>
      <motion.form
        className="auth-panel"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        onSubmit={submit}
      >
        <motion.div
          key={mode}
          initial={entered.current ? { opacity: 0, y: 8 } : false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22 }}
        >
          {mode === 'login' && (
            <>
              <PanelHead title="Selamat datang kembali">Masuk untuk mengelola toko dan transaksi.</PanelHead>
              {errorBanner}
              <AuthField icon={Mail} label="Email" type="email" value={email} onChange={setEmail} placeholder="nama@contoh.com" required autoComplete="email" />
              <AuthField
                icon={LockKeyhole}
                label="Password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={setPassword}
                placeholder="Masukkan password"
                required
                autoComplete="current-password"
                trailing={<EyeToggle shown={showPassword} onToggle={() => setShowPassword(!showPassword)} />}
              />
              <div className="auth-options">
                <span>Akun dibuat oleh admin</span>
                <button type="button" onClick={() => switchMode('forgot')}>
                  Lupa password?
                </button>
              </div>
              <button className="auth-submit" disabled={loading}>
                {loading ? (
                  <>
                    <span className="mini-spinner" /> Memproses…
                  </>
                ) : (
                  <>
                    Masuk ke dashboard <ArrowRight size={17} />
                  </>
                )}
              </button>
              <div className="auth-foot">
                <span>
                  Belum punya akun?{' '}
                  <a href={REQUEST_ACCESS_HREF} style={{ color: '#ff5a36', fontWeight: 700 }}>
                    Minta akses ke admin
                  </a>
                </span>
              </div>
            </>
          )}

          {mode === 'forgot' && (
            <>
              <RecoverySteps current={1} />
              <PanelHead title="Lupa password">
                Masukkan email akun Anda. Kami kirim kode verifikasi {OTP_LENGTH} digit ke email tersebut.
              </PanelHead>
              {errorBanner}
              <AuthField
                icon={Mail}
                label="Email"
                type="email"
                value={email}
                onChange={setEmail}
                placeholder="nama@contoh.com"
                required
                autoComplete="email"
                autoFocus
              />
              <button className="auth-submit" disabled={loading}>
                {loading ? (
                  <>
                    <span className="mini-spinner" /> Mengirim kode…
                  </>
                ) : (
                  <>
                    Kirim kode verifikasi <ArrowRight size={17} />
                  </>
                )}
              </button>
              <div className="auth-options rc-back">
                <button type="button" onClick={() => switchMode('login')}>
                  ← Kembali ke halaman masuk
                </button>
              </div>
              <div className="auth-foot">
                <span>🔒 Data autentikasi diamankan oleh Supabase</span>
              </div>
            </>
          )}

          {mode === 'code' && (
            <>
              <RecoverySteps current={2} />
              <PanelHead title="Masukkan kode">
                Jika <b className="rc-addr">{email.trim()}</b> terdaftar, kode {OTP_LENGTH} digit sudah kami kirim. Periksa inbox dan folder Spam.
              </PanelHead>
              {errorBanner}
              {notice && (
                <div className="success-banner" role="status">
                  <CheckCircle2 size={17} />
                  <span>{notice}</span>
                </div>
              )}
              <OtpInput
                value={code}
                onChange={(next) => {
                  setCode(next);
                  setBadCode(false);
                  if (error) setError('');
                }}
                onComplete={verify}
                readOnly={loading}
                invalid={badCode}
              />
              <button className="auth-submit" disabled={loading || code.length < OTP_LENGTH}>
                {loading ? (
                  <>
                    <span className="mini-spinner" /> Memverifikasi…
                  </>
                ) : (
                  <>
                    Verifikasi kode <ArrowRight size={17} />
                  </>
                )}
              </button>
              <div className="rc-resend">
                <span>Belum menerima kode?</span>
                {cooldown > 0 ? (
                  <b>Kirim ulang dalam {formatCountdown(cooldown)}</b>
                ) : (
                  <button type="button" onClick={() => sendCode(true)} disabled={loading}>
                    Kirim ulang kode
                  </button>
                )}
              </div>
              <div className="auth-options rc-back">
                <button type="button" onClick={() => switchMode('forgot')} disabled={loading}>
                  ← Ganti email
                </button>
              </div>
            </>
          )}
        </motion.div>
      </motion.form>
    </AuthShell>
  );
}

/* ------------------------------------------------------------------ new password (step 3) */

function Rule({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (
    <li className={`rc-rule${ok ? ' ok' : ''}`}>
      <span className="rc-tick">{ok && <Check size={11} strokeWidth={3.4} />}</span>
      <span className="rc-sr">{ok ? 'Terpenuhi: ' : 'Belum: '}</span>
      {children}
    </li>
  );
}

/**
 * Shown once the emailed code was accepted (or an older reset link was opened: Supabase event PASSWORD_RECOVERY).
 * The client is already signed in at this point, so the page keeps this screen up until `onDone`.
 */
export function ResetPassword({ email, onDone }: { email?: string; onDone: () => void }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const checks = passwordChecks(password);
  const strength = passwordStrength(password);
  const matches = confirm !== '' && password === confirm;
  const mismatch = confirm !== '' && password !== confirm;
  const canSave = isPasswordValid(password) && password === confirm && !loading;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!isPasswordValid(password)) {
      setError(`Password minimal ${MIN_PASSWORD_LENGTH} karakter.`);
      return;
    }
    if (password !== confirm) {
      setError('Konfirmasi password belum sama.');
      return;
    }
    setLoading(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (err) {
      setError(friendlyAuthError(err.message));
      return;
    }
    setSaved(true);
  };

  // Ends this browser's session only (scope "local"): a global sign-out would also log the shop's other devices out.
  const cancel = () => {
    void supabase.auth.signOut({ scope: 'local' });
  };

  if (saved) {
    return (
      <AuthShell>
        <motion.div className="auth-panel success-panel" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
          <div className="success-icon rc-success-icon">
            <Check size={30} strokeWidth={3} />
          </div>
          <h1>Password berhasil diubah</h1>
          <p>{email ? `Password baru untuk ${email} sudah aktif.` : 'Password baru Anda sudah aktif.'} Gunakan password ini saat masuk berikutnya.</p>
          <button type="button" className="auth-submit rc-continue" onClick={onDone} autoFocus>
            Lanjut ke dashboard <ArrowRight size={17} />
          </button>
        </motion.div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <motion.form className="auth-panel" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} onSubmit={submit}>
        <RecoverySteps current={3} />
        <PanelHead
          title="Buat password baru"
          eyebrow={
            <span className="rc-verified">
              <CheckCircle2 size={14} /> Kode terverifikasi
            </span>
          }
        >
          {email ? (
            <>
              Pilih password baru untuk <b className="rc-addr">{email}</b>.
            </>
          ) : (
            'Pilih password baru untuk akun Anda.'
          )}
        </PanelHead>
        {error && (
          <div className="error auth-error" role="alert">
            <span>{error}</span>
          </div>
        )}
        <AuthField
          icon={LockKeyhole}
          label="Password baru"
          type={showPassword ? 'text' : 'password'}
          value={password}
          onChange={setPassword}
          placeholder={`Minimal ${MIN_PASSWORD_LENGTH} karakter`}
          required
          autoComplete="new-password"
          autoFocus
          trailing={<EyeToggle shown={showPassword} onToggle={() => setShowPassword(!showPassword)} />}
        />
        <div className="rc-strength" data-level={strength.level} aria-live="polite">
          <div className="rc-meter" aria-hidden="true">
            {[1, 2, 3, 4].map((n) => (
              <i key={n} className={n <= strength.score ? 'on' : ''} />
            ))}
          </div>
          <div className="rc-strength-label">
            <span>Kekuatan password</span>
            <b>{strength.label || '–'}</b>
          </div>
        </div>
        <ul className="rc-rules" aria-label="Panduan password">
          <Rule ok={checks.length}>Minimal {MIN_PASSWORD_LENGTH} karakter</Rule>
          <Rule ok={checks.number}>Ada angka</Rule>
          <Rule ok={checks.upper}>Ada huruf besar</Rule>
          <Rule ok={checks.symbol}>Ada simbol (! @ #)</Rule>
        </ul>
        <AuthField
          icon={LockKeyhole}
          label="Ulangi password"
          type={showPassword ? 'text' : 'password'}
          value={confirm}
          onChange={setConfirm}
          placeholder="Ketik ulang password"
          required
          autoComplete="new-password"
        />
        <div className={`rc-match${matches ? ' ok' : mismatch ? ' bad' : ''}`} aria-live="polite">
          {matches && (
            <>
              <Check size={14} strokeWidth={3} /> Password cocok
            </>
          )}
          {mismatch && (
            <>
              <X size={14} strokeWidth={3} /> Password belum sama
            </>
          )}
        </div>
        <button className="auth-submit" disabled={!canSave}>
          {loading ? (
            <>
              <span className="mini-spinner" /> Menyimpan…
            </>
          ) : (
            <>
              Simpan password baru <Check size={17} strokeWidth={2.6} />
            </>
          )}
        </button>
        <div className="auth-options rc-back">
          <button type="button" onClick={cancel} disabled={loading}>
            Batalkan dan kembali ke halaman masuk
          </button>
        </div>
      </motion.form>
    </AuthShell>
  );
}

/* ------------------------------------------------------------------ brand panel + field */

export function AuthBrand() {
  return (
    <div className="auth-brand">
      <div className="brand-logo auth-logo">M</div>
      <span className="eyebrow light">BUSINESS POS</span>
      <h2>
        Operasional toko,
        <br />
        <em>lebih rapi.</em>
      </h2>
      <p>Kelola penjualan, stok, pelanggan, dan transaksi dalam satu dashboard yang cepat dan modern.</p>
      <div className="auth-points">
        <div>
          <CheckCircle2 size={17} />
          <span>Kasir terpusat & real-time</span>
        </div>
        <div>
          <CheckCircle2 size={17} />
          <span>Inventory lebih mudah dipantau</span>
        </div>
        <div>
          <CheckCircle2 size={17} />
          <span>Akses aman berbasis akun</span>
        </div>
      </div>
      <small className="auth-version">MIEFLOW • BUSINESS POS</small>
    </div>
  );
}

export function AuthField({
  icon: Icon,
  label,
  value,
  onChange,
  type = 'text',
  placeholder = '',
  required = false,
  trailing,
  autoComplete,
  autoFocus = false,
}: {
  icon: LucideIcon;
  label: string;
  value?: string | null;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
  trailing?: ReactNode;
  autoComplete?: string;
  autoFocus?: boolean;
}) {
  return (
    <label className="auth-field">
      <span>{label}</span>
      <div>
        <Icon size={17} />
        <input
          required={required}
          type={type}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
        />
        {trailing}
      </div>
    </label>
  );
}
