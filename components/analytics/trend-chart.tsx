'use client';

/**
 * Sales trend of the Analisa screen. Interactive:
 *  - hover / drag a finger to read any day, click or tap to pin it (the page shows that day's detail),
 *  - arrow keys, Home / End and Esc when the chart has focus,
 *  - switch metric (Omzet / Transaksi), chart type (area / bars) and the previous-period comparison.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import { BarChart3, TrendingUp } from 'lucide-react';
import { axisTicks, niceScale, smoothPath } from '@/lib/chart-path';
import type { XY } from '@/lib/chart-path';
import type { DayPoint } from '@/lib/analytics';
import { pct } from '@/lib/analytics';
import { compactNumber, money } from '@/lib/format';

type Metric = 'revenue' | 'orders';
type Kind = 'area' | 'bar';
const PAD = { top: 18, right: 16, bottom: 30, left: 50 };

export function TrendChart({ points, pinned, onPin, bucketDays }: { points: DayPoint[]; pinned: number | null; onPin: (index: number | null) => void; bucketDays: number }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [metric, setMetric] = useState<Metric>('revenue');
  const [kind, setKind] = useState<Kind>('area');
  const [compare, setCompare] = useState(true);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    observer.observe(el);
    setWidth(el.clientWidth);
    return () => observer.disconnect();
  }, []);

  const n = points.length;
  const value = (p: DayPoint) => (metric === 'revenue' ? p.revenue : p.orders);
  const before = (p: DayPoint) => (metric === 'revenue' ? p.previousRevenue : p.previousOrders);
  const fmt = (v: number) => (metric === 'revenue' ? money(v) : `${v.toLocaleString('id-ID')} transaksi`);

  const height = width && width < 560 ? 240 : 320;
  const plotW = Math.max(1, width - PAD.left - PAD.right), plotH = height - PAD.top - PAD.bottom;
  const scale = useMemo(() => niceScale(Math.max(...points.map((p) => Math.max(value(p), compare ? before(p) : 0)), 0), 4, metric === 'orders'), [points, metric, compare]); // eslint-disable-line react-hooks/exhaustive-deps
  const slot = plotW / Math.max(1, n);
  const x = (i: number) => PAD.left + (i + 0.5) * slot;
  const y = (v: number) => PAD.top + (1 - v / scale.max) * plotH;
  const baseY = PAD.top + plotH;
  const empty = points.every((p) => p.revenue === 0 && p.orders === 0 && p.previousRevenue === 0 && p.previousOrders === 0);

  const current: XY[] = points.map((p, i) => [x(i), y(value(p))]);
  const previous: XY[] = points.map((p, i) => [x(i), y(before(p))]);
  const line = smoothPath(current);
  const area = n > 1 ? `${line} L${x(n - 1)},${baseY} L${x(0)},${baseY} Z` : '';
  const peak = points.reduce((best, p, i) => (value(p) > (value(points[best]) ?? 0) ? i : best), 0);
  const barW = Math.min(30, Math.max(3, slot * 0.58));
  const ticks = axisTicks(n, Math.max(2, Math.floor(plotW / 78)));

  const indexAt = (e: PointerEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    return Math.min(n - 1, Math.max(0, Math.floor((e.clientX - box.left - PAD.left) / slot)));
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const at = hover ?? pinned ?? (e.key === 'ArrowLeft' ? n : -1);
    const go = (i: number) => { e.preventDefault(); setHover(null); onPin(Math.min(n - 1, Math.max(0, i))); };
    if (e.key === 'ArrowRight') go(at + 1);
    else if (e.key === 'ArrowLeft') go(at - 1);
    else if (e.key === 'Home') go(0);
    else if (e.key === 'End') go(n - 1);
    else if (e.key === 'Escape') { setHover(null); onPin(null); }
  };

  const active = hover ?? pinned;
  const ap = active === null ? null : points[active];
  const change = ap ? pct(value(ap), before(ap)) : null;
  const tipLeft = active === null ? 0 : Math.min(Math.max(x(active), 116), Math.max(116, width - 116));
  const animKey = `${metric}-${kind}-${n}-${points[0]?.key}-${compare}`;

  return <div className="an-trend">
    <div className="an-trend-tools">
      <div className="an-seg" role="group" aria-label="Metrik grafik">
        <button type="button" className={metric === 'revenue' ? 'active' : ''} aria-pressed={metric === 'revenue'} onClick={() => setMetric('revenue')}>Omzet</button>
        <button type="button" className={metric === 'orders' ? 'active' : ''} aria-pressed={metric === 'orders'} onClick={() => setMetric('orders')}>Transaksi</button>
      </div>
      <div className="an-trend-right">
        <button type="button" className={`an-chip${compare ? ' on' : ''}`} aria-pressed={compare} onClick={() => setCompare((v) => !v)}><i className="an-swatch was" />Periode lalu</button>
        <div className="an-seg is-icons" role="group" aria-label="Tipe grafik">
          <button type="button" className={kind === 'area' ? 'active' : ''} aria-pressed={kind === 'area'} aria-label="Grafik garis" title="Garis" onClick={() => setKind('area')}><TrendingUp size={16} /></button>
          <button type="button" className={kind === 'bar' ? 'active' : ''} aria-pressed={kind === 'bar'} aria-label="Grafik batang" title="Batang" onClick={() => setKind('bar')}><BarChart3 size={16} /></button>
        </div>
      </div>
    </div>

    <div
      className="an-chart" ref={wrap} style={{ height }} tabIndex={0} role="group"
      aria-label={`Grafik ${metric === 'revenue' ? 'omzet' : 'transaksi'} ${bucketDays > 1 ? `per ${bucketDays} hari` : 'harian'}. Gunakan panah kiri dan kanan untuk membaca tiap titik, Esc untuk membatalkan.`}
      onPointerMove={(e) => n > 0 && setHover(indexAt(e))} onPointerDown={(e) => n > 0 && setHover(indexAt(e))}
      onPointerLeave={() => setHover(null)} onBlur={() => setHover(null)}
      onClick={(e) => { if (n === 0) return; const i = Math.min(n - 1, Math.max(0, Math.floor((e.clientX - e.currentTarget.getBoundingClientRect().left - PAD.left) / slot))); onPin(pinned === i ? null : i); }}
      onKeyDown={onKey}
    >
      {width > 0 && <svg width={width} height={height} aria-hidden="true">
        <defs>
          <linearGradient id="an-area-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" className="an-stop-a" /><stop offset="100%" className="an-stop-b" /></linearGradient>
          <linearGradient id="an-bar-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" className="an-bar-a" /><stop offset="100%" className="an-bar-b" /></linearGradient>
        </defs>
        {[0, 1, 2, 3, 4].map((g) => {
          const v = (scale.max / 4) * g;
          return <g key={g}><line x1={PAD.left} x2={width - PAD.right} y1={y(v)} y2={y(v)} className={g === 0 ? 'an-axis-line' : 'an-grid'} /><text x={PAD.left - 10} y={y(v) + 4} textAnchor="end" className="an-axis">{metric === 'revenue' ? compactNumber(v) : Math.round(v)}</text></g>;
        })}

        <g key={animKey}>
          {kind === 'area' ? <>
            {compare && !empty && n > 1 && <path d={smoothPath(previous)} className="an-prev-line" />}
            {area && <path d={area} fill="url(#an-area-fill)" className="an-area" />}
            {n > 1 ? <path d={line} className="an-line" pathLength={1} /> : current[0] && <circle cx={current[0][0]} cy={current[0][1]} r="5" className="an-dot on" />}
            {n <= 31 && n > 1 && current.map(([cx, cy], i) => <circle key={i} cx={cx} cy={cy} r={active === i ? 0 : 2.6} className="an-dot" />)}
          </> : <>
            {points.map((p, i) => {
              const top = y(value(p)), h = Math.max(value(p) > 0 ? 3 : 0, baseY - top);
              return <g key={p.key}>
                <rect x={x(i) - barW / 2} y={baseY - h} width={barW} height={h} rx={Math.min(7, barW / 2)} className={`an-bar${active === i ? ' on' : ''}${active !== null && active !== i ? ' dim' : ''}`} style={{ animationDelay: `${Math.min(i * 14, 380)}ms` }} />
                {compare && !empty && before(p) > 0 && <line x1={x(i) - barW / 2 - 2} x2={x(i) + barW / 2 + 2} y1={y(before(p))} y2={y(before(p))} className="an-prev-tick" />}
              </g>;
            })}
          </>}
        </g>

        {!empty && value(points[peak]) > 0 && kind === 'area' && n > 1 && active !== peak && <circle cx={x(peak)} cy={y(value(points[peak]))} r="7" className="an-peak" />}
        {pinned !== null && points[pinned] && <line x1={x(pinned)} x2={x(pinned)} y1={PAD.top} y2={baseY} className="an-guide pinned" />}
        {hover !== null && points[hover] && <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={baseY} className="an-guide" />}
        {kind === 'area' && ap && active !== null && <>
          {compare && <circle cx={x(active)} cy={y(before(ap))} r="4.5" className="an-dot was" />}
          <circle cx={x(active)} cy={y(value(ap))} r="6.5" className="an-dot active" />
        </>}
        {ticks.map((i) => <text key={i} x={x(i)} y={height - 9} textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'} className="an-axis">{points[i].label}</text>)}
      </svg>}

      {empty && <div className="an-chart-empty"><BarChart3 size={22} /><b>Belum ada transaksi</b><span>Ubah periode atau selesaikan transaksi di Kasir.</span></div>}

      {ap && <div className="an-tip" style={{ left: tipLeft }} aria-live="polite">
        <b>{ap.long}</b>
        <strong>{fmt(value(ap))}</strong>
        <span className={`an-tip-delta ${change === null ? 'flat' : change >= 0 ? 'up' : 'down'}`}>{change === null ? 'Tanpa pembanding' : `${change >= 0 ? '▲' : '▼'} ${Math.abs(change).toLocaleString('id-ID')}% vs periode lalu`}</span>
        {compare && <span className="an-tip-prev"><i className="an-swatch was" />Periode lalu: {fmt(before(ap))}</span>}
        {pinned === active && <small>Dipin · klik lagi untuk lepas</small>}
      </div>}
    </div>
  </div>;
}
