'use client';

/** Analisa: sales analytics and reporting. Calculations live in lib/analytics.ts, the interactive pieces in components/analytics/*, styles in app/analisa.css (prefix an-). */
import { useMemo, useState } from 'react';
import { CalendarDays, CircleDollarSign, Download, ShoppingBag, TrendingUp, Users, X } from 'lucide-react';
import { HoursChart, KpiCard, PaymentMix, TopProducts, Delta } from '@/components/analytics/widgets';
import { TrendChart } from '@/components/analytics/trend-chart';
import { analyze, pct, presetRange, toCsv, toIso } from '@/lib/analytics';
import type { RangePreset } from '@/lib/analytics';
import { money } from '@/lib/format';
import type { Order, OrderItem, Product } from '@/lib/types';

const PRESETS: { value: RangePreset; label: string }[] = [
  { value: '7', label: '7 Hari' },
  { value: '30', label: '30 Hari' },
  { value: '90', label: '90 Hari' },
  { value: 'custom', label: 'Kustom' },
];

const rangeText = (from: string, to: string) => {
  const f = new Date(`${from}T00:00:00`), t = new Date(`${to}T00:00:00`);
  const short = (d: Date, year: boolean) => d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', ...(year ? { year: 'numeric' } : {}) });
  return from === to ? short(t, true) : `${short(f, f.getFullYear() !== t.getFullYear())} – ${short(t, true)}`;
};

export function Analytics({ orders, orderItems, products }: { orders: Order[]; orderItems: OrderItem[]; products: Product[] }) {
  const [preset, setPreset] = useState<RangePreset>('7');
  const [range, setRange] = useState(() => presetRange(7));
  const [pinned, setPinned] = useState<number | null>(null);
  const a = useMemo(() => analyze(orders, orderItems, products, range.from, range.to), [orders, orderItems, products, range]);
  const today = toIso(new Date());

  const choose = (value: RangePreset) => {
    setPreset(value);
    setPinned(null);
    if (value !== 'custom') setRange(presetRange(Number(value)));
  };
  const setDate = (key: 'from' | 'to', value: string) => {
    if (!value) return;
    setPreset('custom');
    setPinned(null);
    setRange((r) => ({ ...r, [key]: value }));
  };
  const download = () => {
    const blob = new Blob(['\uFEFF' + toCsv(a)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url; link.download = `analisa-${a.from}-${a.to}.csv`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const day = pinned === null ? null : a.points[pinned];
  const dayAvg = day && day.orders ? day.revenue / day.orders : 0;
  const hasData = a.orders > 0;

  return <div className="an-page">
    <section className="an-toolbar" aria-label="Periode analisa">
      <div className="an-toolbar-main">
        <div className="an-seg lg" role="tablist" aria-label="Pilih periode">
          {PRESETS.map((p) => <button key={p.value} type="button" role="tab" aria-selected={preset === p.value} className={preset === p.value ? 'active' : ''} onClick={() => choose(p.value)}>{p.label}</button>)}
        </div>
        <div className="an-dates">
          <CalendarDays size={16} />
          <input type="date" aria-label="Dari tanggal" value={range.from} max={range.to} onChange={(e) => setDate('from', e.target.value)} />
          <span>→</span>
          <input type="date" aria-label="Sampai tanggal" value={range.to} min={range.from} max={today} onChange={(e) => setDate('to', e.target.value)} />
        </div>
      </div>
      <div className="an-toolbar-side">
        <span className="an-live"><i />{a.days} hari dianalisa</span>
        <button type="button" className="an-btn" onClick={download} disabled={!a.points.length}><Download size={16} />Unduh CSV</button>
      </div>
    </section>

    <div className="an-kpis">
      <KpiCard tone="ember" label="Total omzet" value={money(a.revenue)} delta={a.revenueDelta} icon={CircleDollarSign} spark={a.points.map((p) => p.revenue)} />
      <KpiCard tone="blue" label="Transaksi selesai" value={a.orders.toLocaleString('id-ID')} delta={a.orderDelta} icon={ShoppingBag} spark={a.points.map((p) => p.orders)} />
      <KpiCard tone="violet" label="Rata-rata transaksi" value={money(a.avgOrder)} delta={a.avgDelta} icon={TrendingUp} spark={a.points.map((p) => (p.orders ? p.revenue / p.orders : 0))} />
      <KpiCard tone="green" label="Pelanggan aktif" value={a.customers.toLocaleString('id-ID')} delta={a.customerDelta} icon={Users} />
    </div>

    <section className="an-card an-trend-card">
      <header className="an-card-head">
        <div><span className="an-kicker">TREN PENJUALAN</span><h2>Pergerakan omzet</h2><p>{rangeText(a.from, a.to)}{a.bucketDays > 1 ? ` · digabung per ${a.bucketDays} hari` : ''}</p></div>
        <div className="an-headline"><b>{money(a.revenue)}</b><Delta value={a.revenueDelta} /></div>
      </header>
      <TrendChart points={a.points} pinned={pinned} onPin={setPinned} bucketDays={a.bucketDays} />
      {day
        ? <div className="an-insights day" aria-live="polite">
          <div className="an-insight-title"><span>Detail terpilih</span><b>{day.long}</b><button type="button" onClick={() => setPinned(null)} aria-label="Lepas pilihan"><X size={14} />Lepas</button></div>
          <div><span>Omzet</span><b>{money(day.revenue)}</b><small><Delta value={pct(day.revenue, day.previousRevenue)} /></small></div>
          <div><span>Transaksi</span><b>{day.orders.toLocaleString('id-ID')}</b><small><Delta value={pct(day.orders, day.previousOrders)} /></small></div>
          <div><span>Rata-rata transaksi</span><b>{money(dayAvg)}</b><small>Per pesanan pada hari ini</small></div>
        </div>
        : <div className="an-insights">
          <div><span>Omzet tertinggi</span><b>{a.bestDay ? money(a.bestDay.revenue) : 'Rp 0'}</b><small>{a.bestDay ? a.bestDay.long : 'Belum ada data'}</small></div>
          <div><span>Rata-rata per hari</span><b>{money(a.avgPerDay)}</b><small>Sepanjang periode</small></div>
          <div><span>Jam tersibuk</span><b>{a.peakHour ? `${String(a.peakHour.hour).padStart(2, '0')}.00` : '–'}</b><small>{a.peakHour ? `${a.peakHour.orders} transaksi` : 'Belum ada data'}</small></div>
          <div className="an-tip-hint"><span>Tips</span><small>Klik titik pada grafik untuk melihat detail harinya.</small></div>
        </div>}
    </section>

    <div className="an-grid-2">
      <section className="an-card">
        <header className="an-card-head"><div><span className="an-kicker">JAM SIBUK</span><h2>Aktivitas per jam</h2><p>Kapan pelanggan paling banyak bertransaksi</p></div></header>
        <HoursChart hours={a.hours} peak={a.peakHour} />
      </section>
      <section className="an-card">
        <header className="an-card-head"><div><span className="an-kicker">PEMBAYARAN</span><h2>Metode pembayaran</h2><p>Komposisi omzet berdasarkan metode</p></div></header>
        <PaymentMix slices={a.payments} total={a.revenue} orders={a.orders} />
      </section>
    </div>

    <div className="an-grid-2 wide">
      <section className="an-card">
        <header className="an-card-head"><div><span className="an-kicker">PRODUK TERLARIS</span><h2>Performa menu</h2><p>Klik produk untuk melihat kontribusinya</p></div></header>
        <TopProducts products={a.products} revenue={a.revenue} />
      </section>
      <section className="an-card an-summary">
        <header className="an-card-head"><div><span className="an-kicker">RINGKASAN</span><h2>Kesehatan penjualan</h2><p>Angka pendukung periode ini</p></div></header>
        <dl>
          <div><dt>Transaksi sukses</dt><dd>{a.successRate === null ? '–' : `${a.successRate.toFixed(1).replace('.', ',')}%`}</dd></div>
          <div><dt>Dibatalkan</dt><dd>{a.cancelled.toLocaleString('id-ID')}</dd></div>
          <div><dt>Item terjual</dt><dd>{a.itemsSold.toLocaleString('id-ID')}</dd></div>
          <div><dt>Item per transaksi</dt><dd>{hasData ? a.avgItemsPerOrder.toFixed(1).replace('.', ',') : '–'}</dd></div>
          <div><dt>Hari dianalisa</dt><dd>{a.days} hari</dd></div>
        </dl>
        {a.successRate !== null && <div className="an-meter" role="img" aria-label={`Tingkat transaksi sukses ${a.successRate}%`}><i style={{ width: `${a.successRate}%` }} /></div>}
      </section>
    </div>
  </div>;
}
