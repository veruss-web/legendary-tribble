'use client';

/** Smaller interactive pieces of the Analisa screen: KPI cards, busy hours, payment mix, best sellers. */
import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ArrowDownRight, ArrowUpRight, ChevronDown, Minus, Sparkles, Trophy } from 'lucide-react';
import { smoothPath } from '@/lib/chart-path';
import type { HourBucket, PaymentSlice, ProductRank } from '@/lib/analytics';
import { money } from '@/lib/format';
import { paymentLabel } from '@/lib/payments';

/* ------------------------------------------------------------------ KPI */

function Spark({ values }: { values: number[] }) {
  const w = 120, h = 36, max = Math.max(...values, 1);
  if (values.length < 2) return <svg className="an-spark" viewBox={`0 0 ${w} ${h}`} aria-hidden="true"><line x1="0" x2={w} y1={h - 3} y2={h - 3} /></svg>;
  const pts = values.map((v, i): [number, number] => [(i / (values.length - 1)) * w, h - 3 - (v / max) * (h - 8)]);
  const d = smoothPath(pts);
  return <svg className="an-spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true"><path d={`${d} L${w},${h} L0,${h} Z`} className="fill" /><path d={d} className="stroke" /></svg>;
}

/** Change against the previous period. `compact` drops the caption (the KPI cards are narrow); the full wording stays in the tooltip. */
export function Delta({ value, compact = false }: { value: number | null; compact?: boolean }) {
  if (value === null) return <span className="an-delta flat" title="Belum ada data periode sebelumnya"><Minus size={13} />{compact ? 'Baru' : 'Belum ada pembanding'}</span>;
  const up = value >= 0;
  return <span className={`an-delta ${value === 0 ? 'flat' : up ? 'up' : 'down'}`} title="Dibanding periode sebelumnya dengan panjang yang sama">{up ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}{Math.abs(value).toLocaleString('id-ID')}%{!compact && <small>vs periode lalu</small>}</span>;
}

export function KpiCard({ tone, label, value, delta, note, icon: Icon, spark }: { tone: 'ember' | 'blue' | 'violet' | 'green'; label: string; value: string; delta?: number | null; note?: string; icon: LucideIcon; spark?: number[] }) {
  return <article className={`an-kpi ${tone}`}>
    <header><span>{label}</span><i><Icon size={18} /></i></header>
    <strong>{value}</strong>
    <footer>{delta === undefined ? <small className="an-note">{note}</small> : <Delta value={delta} compact />}{spark && <Spark values={spark} />}</footer>
  </article>;
}

/* ------------------------------------------------------------------ busy hours */

export function HoursChart({ hours, peak }: { hours: HourBucket[]; peak: HourBucket | null }) {
  const [hover, setHover] = useState<number | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const max = Math.max(...hours.map((h) => h.orders), 1);
  const top = useMemo(() => new Set([...hours].filter((h) => h.orders > 0).sort((a, b) => b.orders - a.orders).slice(0, 3).map((h) => h.hour)), [hours]);
  const shown = hover ?? picked ?? peak?.hour ?? null;
  const cur = shown === null ? null : hours[shown];
  const range = (h: number) => `${String(h).padStart(2, '0')}.00–${String(h).padStart(2, '0')}.59`;
  return <div className="an-hours">
    <div className="an-hours-caption" aria-live="polite">
      {cur && cur.orders > 0
        ? <><span>{hover === null && picked === null ? 'Jam tersibuk' : 'Jam terpilih'}</span><b>{range(cur.hour)}</b><em>{cur.orders.toLocaleString('id-ID')} transaksi · {money(cur.revenue)}</em></>
        : <><span>Jam tersibuk</span><b>Belum ada data</b><em>Muncul setelah ada transaksi</em></>}
    </div>
    <div className="an-hours-bars" role="group" aria-label="Jumlah transaksi per jam" onPointerLeave={() => setHover(null)}>
      {hours.map((h) => <button
        type="button" key={h.hour} className={`an-hour${top.has(h.hour) ? ' hot' : ''}${shown === h.hour ? ' on' : ''}${h.orders === 0 ? ' zero' : ''}`}
        aria-label={`${range(h.hour)}: ${h.orders} transaksi`} aria-pressed={picked === h.hour}
        onPointerEnter={() => setHover(h.hour)} onFocus={() => setHover(h.hour)} onBlur={() => setHover(null)}
        onClick={() => setPicked(picked === h.hour ? null : h.hour)}
      ><i style={{ height: `${h.orders ? Math.max(8, (h.orders / max) * 100) : 3}%`, animationDelay: `${h.hour * 12}ms` }} />{h.hour % 6 === 0 && <small>{String(h.hour).padStart(2, '0')}</small>}</button>)}
    </div>
  </div>;
}

/* ------------------------------------------------------------------ payment mix */

const RADIUS = 54, CIRC = 2 * Math.PI * RADIUS;

export function PaymentMix({ slices, total, orders }: { slices: PaymentSlice[]; total: number; orders: number }) {
  const [active, setActive] = useState<number | null>(null);
  const cur = active === null ? null : slices[active];
  let offset = 0;
  return <div className="an-mix">
    <div className="an-donut" onPointerLeave={() => setActive(null)}>
      <svg viewBox="0 0 140 140" role="img" aria-label="Komposisi metode pembayaran">
        <circle cx="70" cy="70" r={RADIUS} className="an-donut-track" />
        {slices.map((s, i) => {
          const full = (s.revenue / Math.max(total, 1)) * CIRC, len = slices.length > 1 ? Math.max(0, full - 3) : full, at = offset;
          offset += full;
          return <circle key={s.method} cx="70" cy="70" r={RADIUS} className={`an-slice c${i % 4}${active === i ? ' on' : ''}${active !== null && active !== i ? ' dim' : ''}`} strokeDasharray={`${len} ${CIRC - len}`} strokeDashoffset={-at} transform="rotate(-90 70 70)" onPointerEnter={() => setActive(i)} onClick={() => setActive(active === i ? null : i)} />;
        })}
      </svg>
      <div className="an-donut-center">{cur
        ? <><span>{paymentLabel(cur.method)}</span><b>{cur.share.toFixed(1).replace('.', ',')}%</b><small>{cur.orders} transaksi</small></>
        : <><span>Total</span><b>{orders.toLocaleString('id-ID')}</b><small>transaksi</small></>}</div>
    </div>
    <ul className="an-legend">
      {slices.length ? slices.map((s, i) => <li key={s.method}><button type="button" className={active === i ? 'on' : ''} onPointerEnter={() => setActive(i)} onPointerLeave={() => setActive(null)} onFocus={() => setActive(i)} onBlur={() => setActive(null)}>
        <i className={`c${i % 4}`} /><span>{paymentLabel(s.method)}</span><b>{money(s.revenue)}</b><em>{s.share.toFixed(0)}%</em>
      </button></li>) : <li className="an-none">Belum ada pembayaran pada periode ini.</li>}
    </ul>
  </div>;
}

/* ------------------------------------------------------------------ best sellers */

export function TopProducts({ products, revenue }: { products: ProductRank[]; revenue: number }) {
  const [mode, setMode] = useState<'revenue' | 'qty'>('revenue');
  const [more, setMore] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const sorted = useMemo(() => [...products].sort((a, b) => (mode === 'revenue' ? b.revenue - a.revenue || b.qty - a.qty : b.qty - a.qty || b.revenue - a.revenue)), [products, mode]);
  const rows = sorted.slice(0, more ? 10 : 5);
  const lead = rows[0] ? (mode === 'revenue' ? rows[0].revenue : rows[0].qty) : 1;
  return <div className="an-products">
    <div className="an-products-tools">
      <div className="an-seg" role="group" aria-label="Urutkan produk">
        <button type="button" className={mode === 'revenue' ? 'active' : ''} aria-pressed={mode === 'revenue'} onClick={() => setMode('revenue')}>Omzet</button>
        <button type="button" className={mode === 'qty' ? 'active' : ''} aria-pressed={mode === 'qty'} onClick={() => setMode('qty')}>Terjual</button>
      </div>
      <span className="an-badge"><Sparkles size={14} />{products.length} produk terjual</span>
    </div>
    {rows.length ? <ol className="an-rank">{rows.map((p, i) => {
      const v = mode === 'revenue' ? p.revenue : p.qty, isOpen = open === p.key;
      return <li key={p.key} className={isOpen ? 'open' : ''}>
        <button type="button" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : p.key)}>
          <span className={`an-rank-no${i === 0 ? ' gold' : ''}`}>{i === 0 ? <Trophy size={14} /> : i + 1}</span>
          <span className="an-rank-main"><b>{p.name}</b><small>{p.category || 'Tanpa kategori'}</small></span>
          <span className="an-rank-bar"><i style={{ ['--w' as string]: `${Math.max(5, (v / Math.max(lead, 1)) * 100)}%`, animationDelay: `${i * 60}ms` } as CSSProperties} /></span>
          <span className="an-rank-val">{mode === 'revenue' ? money(p.revenue) : `${p.qty.toLocaleString('id-ID')}×`}<small>{mode === 'revenue' ? `${p.qty.toLocaleString('id-ID')} terjual` : money(p.revenue)}</small></span>
          <ChevronDown size={16} className="an-rank-chev" />
        </button>
        {isOpen && <div className="an-rank-detail">
          <div><span>Kontribusi omzet</span><b>{revenue ? ((p.revenue / revenue) * 100).toFixed(1).replace('.', ',') : '0'}%</b></div>
          <div><span>Jumlah terjual</span><b>{p.qty.toLocaleString('id-ID')}</b></div>
          <div><span>Harga rata-rata</span><b>{money(p.qty ? p.revenue / p.qty : 0)}</b></div>
        </div>}
      </li>;
    })}</ol> : <p className="an-none">Belum ada item penjualan pada periode ini.</p>}
    {products.length > 5 && <button type="button" className="an-more" onClick={() => setMore((v) => !v)}>{more ? 'Ringkas' : `Lihat ${Math.min(10, products.length)} teratas`}<ChevronDown size={15} className={more ? 'flip' : ''} /></button>}
  </div>;
}
