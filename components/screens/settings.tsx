'use client';

/** Settings: appearance (light / dark / system) and the signed-in account. */
import { Check, LogOut, Monitor, Moon, Palette, ShieldCheck, Sun } from 'lucide-react';
import { CustomerAvatar } from '@/components/shared/avatar';
import type { ResolvedTheme, ThemeMode } from '@/lib/theme';

const OPTIONS: { mode: ThemeMode; label: string; note: string; icon: typeof Sun }[] = [
  { mode: 'light', label: 'Terang', note: 'Bersih dan cerah, nyaman di ruangan terang.', icon: Sun },
  { mode: 'dark', label: 'Gelap', note: 'Lembut di mata, pas untuk malam hari.', icon: Moon },
  { mode: 'system', label: 'Otomatis', note: 'Mengikuti pengaturan tema perangkat Anda.', icon: Monitor },
];

/** Little drawn app window; always uses its own fixed colors so every option previews its real look in either theme. */
function Preview({ variant }: { variant: 'light' | 'dark' | 'system' }) {
  const pane = (tone: 'light' | 'dark') => (
    <div className={`tp-pane ${tone}`}>
      <i className="tp-side"><b/><b/><b/></i>
      <div className="tp-main">
        <div className="tp-top"><b/><i/></div>
        <div className="tp-hero"/>
        <div className="tp-cards"><i/><i/><i/></div>
      </div>
    </div>
  );
  return <div className={`theme-preview ${variant}`} aria-hidden="true">{variant === 'system' ? <>{pane('light')}{pane('dark')}</> : pane(variant)}</div>;
}

export function Settings({ email, theme, resolvedTheme, onThemeChange, onSignOut }: {
  email: string; theme: ThemeMode; resolvedTheme: ResolvedTheme; onThemeChange: (mode: ThemeMode) => void; onSignOut: () => void;
}) {
  const active = OPTIONS.find((o) => o.mode === theme) || OPTIONS[0];
  return <div className="st-page">
    <section className="st-hero">
      <span className="st-eyebrow"><Palette size={13}/> Personalisasi</span>
      <h2>Atur tampilan sesuai gaya Anda</h2>
      <p>Pilih tema yang paling nyaman. Perubahan langsung berlaku di seluruh aplikasi dan diingat di perangkat ini.</p>
    </section>

    <section className="st-card">
      <div className="st-card-head">
        <div><span className="st-kicker">Tampilan</span><h3>Tema aplikasi</h3></div>
        <span className="st-status"><i data-tone={resolvedTheme}/>Aktif sekarang: <b>{resolvedTheme === 'dark' ? 'Gelap' : 'Terang'}</b>{theme === 'system' ? ' (otomatis)' : ''}</span>
      </div>
      <div className="st-themes" role="radiogroup" aria-label="Tema aplikasi">
        {OPTIONS.map(({ mode, label, note, icon: Icon }) => {
          const selected = theme === mode;
          return <button type="button" key={mode} role="radio" aria-checked={selected} className={`st-theme ${selected ? 'selected' : ''}`} onClick={() => onThemeChange(mode)}>
            <Preview variant={mode}/>
            <span className="st-theme-info">
              <span className="st-theme-icon"><Icon size={17}/></span>
              <span className="st-theme-copy"><b>{label}</b><small>{note}</small></span>
              <span className="st-theme-check">{selected && <Check size={14}/>}</span>
            </span>
          </button>;
        })}
      </div>
      <p className="st-hint">Anda juga bisa mengganti tema kapan saja lewat tombol matahari/bulan di bilah atas. Pilihan saat ini: <b>{active.label}</b>.</p>
    </section>

    <section className="st-card st-account">
      <div className="st-card-head">
        <div><span className="st-kicker">Akun</span><h3>Sesi masuk</h3></div>
        <span className="st-status st-secure"><ShieldCheck size={14}/> Terautentikasi</span>
      </div>
      <div className="st-account-row">
        <CustomerAvatar name={email || 'A'} size="lg"/>
        <div className="st-account-copy"><b>{email || 'Pengguna'}</b><small>Anda masuk sebagai pemilik toko.</small></div>
        <button type="button" className="st-signout" onClick={onSignOut}><LogOut size={16}/> Keluar</button>
      </div>
    </section>
  </div>;
}
