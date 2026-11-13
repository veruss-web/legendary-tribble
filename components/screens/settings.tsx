'use client';

/** Settings: appearance (light / dark / system), the websites of the central store and its branches, and the signed-in account. */
import { Building2, Check, ExternalLink, LogOut, Monitor, Moon, Palette, ShieldCheck, Store, Sun } from 'lucide-react';
import { CustomerAvatar } from '@/components/shared/avatar';
import { BRANCHES, currentBranch, hostOf } from '@/lib/branches';
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
  // This screen only renders after sign-in (client side), so reading the address bar here is safe.
  const here = currentBranch(typeof window === 'undefined' ? '' : window.location.hostname);
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

    <section className="st-card">
      <div className="st-card-head">
        <div><span className="st-kicker">Cabang</span><h3>Website pusat dan cabang</h3></div>
        <span className="st-status"><Store size={14}/> <b>{BRANCHES.length}</b> website</span>
      </div>
      <div className="br-list">
        {BRANCHES.map((b) => {
          const open = b.id === here?.id;
          const body = <>
            <span className="br-icon">{b.id === 'pusat' ? <Building2 size={20}/> : <Store size={20}/>}</span>
            <span className="br-copy"><b>{b.name}</b><small>{hostOf(b.url)}</small></span>
            {open ? <span className="br-badge"><i/>Sedang dibuka</span> : <span className="br-go"><ExternalLink size={16}/></span>}
          </>;
          return open
            ? <div key={b.id} className="br-card here" aria-current="true">{body}</div>
            : <a key={b.id} className="br-card" href={b.url} target="_blank" rel="noopener noreferrer" aria-label={`Buka ${b.name} di tab baru`}>{body}</a>;
        })}
      </div>
      <p className="st-hint">Ketuk salah satu untuk membuka websitenya di tab baru.</p>
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
