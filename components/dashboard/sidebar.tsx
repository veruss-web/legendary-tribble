'use client';

/** Sidebar of the dashboard. Memoized: it only re-renders when the page, the drawer state or the e-mail change,
 *  not on every cart tap or keystroke in the search box (all callbacks passed in must be stable). */
import { memo } from 'react';
import { LogOut, Settings, X } from 'lucide-react';
import { nav } from '@/lib/navigation';
import type { Page } from '@/lib/types';

type SidebarProps = {
  page: Page;
  open: boolean;
  email: string;
  onGo: (page: Page) => void;
  onClose: () => void;
  onSignOut: () => void;
};

function SidebarView({ page, open, email, onGo, onClose, onSignOut }: SidebarProps) {
  return <aside className={open ? 'sidebar open' : 'sidebar'}>
    <div className="brand">
      <div className="brand-logo">M</div>
      <div><b>MIEFLOW</b><small>BUSINESS POS</small></div>
      <button className="mobile-close" onClick={onClose} aria-label="Tutup menu"><X/></button>
    </div>
    <nav>{nav.map(([label, key, Icon]) => <button key={key} className={page === key ? 'active' : ''} onClick={() => onGo(key)}><Icon size={18}/><span>{label}</span></button>)}</nav>
    <div className="side-bottom">
      <button onClick={() => onGo('Settings')}><Settings size={18}/>Pengaturan</button>
      <button className="logout" onClick={onSignOut}><LogOut size={18}/>Keluar</button>
      <div className="user"><div>{(email || 'A')[0].toUpperCase()}</div><span><b>{email}</b><small>Authenticated</small></span></div>
    </div>
  </aside>;
}

export const Sidebar = memo(SidebarView);
