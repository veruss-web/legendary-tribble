'use client';

/**
 * Revenue chart of the Overview hero: the current period as a filled curve, the previous period dashed. Interactive:
 *  - hover (or drag a finger) to read any point, click / tap to pin it, click again to release,
 *  - arrow keys, Home / End and Esc when the chart has focus,
 *  - switch between revenue and number of transactions, and show / hide the previous-period comparison.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import { axisTicks, niceScale, smoothPath } from '@/lib/chart-path';
import type { XY } from '@/lib/chart-path';
import { compactNumber, money } from '@/lib/format';
import { deltaPct } from '@/lib/overview';
import type { SalesPoint, SalesSeries } from '@/lib/overview';

type Metric = 'revenue' | 'orders';
const PAD = { top: 30, bottom: 30 };

const valueOf = (p: SalesPoint, m: Metric) => (m === 'revenue' ? p.value : p.orders);
const beforeOf = (p: SalesPoint, m: Metric) => (m === 'revenue' ? p.previous : p.previousOrders);

export function SalesChart({series,comparisonLabel}:{series:SalesSeries;comparisonLabel:string}){
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<number | null>(null);
  const [pinned, setPinned] = useState<number | null>(null);
  const [metric, setMetric] = useState<Metric>('revenue');
  const [compare, setCompare] = useState(true);
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    observer.observe(el);
    setWidth(el.clientWidth);
    return () => observer.disconnect();
  }, []);
  // a pinned point belongs to one period: release it when the period (number of points) changes
  const { points } = series, n = points.length;
  useEffect(() => { setPinned(null); setHover(null); }, [n, series.cumulative]);

  const height = width && width < 560 ? 220 : 280;
  const plotH = height - PAD.top - PAD.bottom;
  const scale = useMemo(
    () => niceScale(Math.max(0, ...points.map((p) => Math.max(valueOf(p, metric) ?? 0, compare ? beforeOf(p, metric) : 0))), 4, metric === 'orders'),
    [points, metric, compare],
  );
  const x = (i: number) => (n > 1 ? (i / (n - 1)) * width : 0);
  const y = (v: number) => PAD.top + (1 - v / scale.max) * plotH;
  const filled: XY[] = [];
  points.forEach((p, i) => { const v = valueOf(p, metric); if (v !== null) filled.push([x(i), y(v)]); });
  const previous: XY[] = points.map((p, i) => [x(i), y(beforeOf(p, metric))]);
  const baseY = PAD.top + plotH;
  const line = smoothPath(filled);
  const area = filled.length > 1 ? `${line} L${filled[filled.length - 1][0]},${baseY} L${filled[0][0]},${baseY} Z` : '';
  const ticks = n === 24 ? [0, 6, 12, 18, 23] : axisTicks(n, Math.max(2, Math.floor(width / 78)));
  const empty = series.total === 0 && series.previousTotal === 0;
  const fmt = (v: number) => (metric === 'revenue' ? money(v) : `${v.toLocaleString('id-ID')} transaksi`);

  const indexAt = (e: { clientX: number; currentTarget: HTMLElement }) => {
    const box = e.currentTarget.getBoundingClientRect();
    return Math.min(n - 1, Math.max(0, Math.round(((e.clientX - box.left) / box.width) * (n - 1))));
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const at = hover ?? pinned ?? (e.key === 'ArrowLeft' ? n : -1);
    const go = (i: number) => { e.preventDefault(); setHover(null); setPinned(Math.min(n - 1, Math.max(0, i))); };
    if (e.key === 'ArrowRight') go(at + 1);
    else if (e.key === 'ArrowLeft') go(at - 1);
    else if (e.key === 'Home') go(0);
    else if (e.key === 'End') go(n - 1);
    else if (e.key === 'Escape') { setHover(null); setPinned(null); }
  };

  const active = hover ?? pinned;
  const hp = active === null ? null : points[active];
  const hv = hp ? valueOf(hp, metric) : null;
  const change = hp && hv !== null ? deltaPct(hv, beforeOf(hp, metric)) : null;
  const tipLeft = active === null ? 0 : Math.min(Math.max(x(active), 112), Math.max(112, width - 112));
  const animKey = `${metric}-${n}-${series.cumulative}`;
  const guide = (i: number, cls: string) => <line key={cls} x1={x(i)} x2={x(i)} y1={PAD.top - 8} y2={baseY} className={cls} />;

  return <div className="ov-chart-wrap">
    <div className="ov-chart-tools">
      <button type="button" className={`ov-legend${compare ? ' on' : ''}`} aria-pressed={compare} onClick={() => setCompare((v) => !v)}><i className="was" />{comparisonLabel}</button>
      <div className="ov-mini-seg" role="group" aria-label="Metrik grafik">
        <button type="button" className={metric === 'revenue' ? 'active' : ''} aria-pressed={metric === 'revenue'} onClick={() => setMetric('revenue')}>Omzet</button>
        <button type="button" className={metric === 'orders' ? 'active' : ''} aria-pressed={metric === 'orders'} onClick={() => setMetric('orders')}>Transaksi</button>
      </div>
    </div>
    <div
      className="ov-chart" ref={wrap} style={{height}} tabIndex={0} role="group"
      aria-label={`Grafik ${metric === 'revenue' ? `omzet, total ${money(series.total)}` : `transaksi, total ${series.count}`}. Gunakan panah kiri dan kanan untuk membaca tiap titik.`}
      onPointerMove={(e: PointerEvent<HTMLDivElement>) => n > 0 && setHover(indexAt(e))} onPointerDown={(e: PointerEvent<HTMLDivElement>) => n > 0 && setHover(indexAt(e))}
      onPointerLeave={() => setHover(null)} onBlur={() => setHover(null)}
      onClick={(e) => { if (n === 0) return; const i = indexAt(e); setPinned(pinned === i ? null : i); }}
      onKeyDown={onKey}
    >
      {width>0&&<svg width={width} height={height} aria-hidden="true">
        <defs>
          <linearGradient id="ov-area" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" className="ov-stop-a"/><stop offset="100%" className="ov-stop-b"/></linearGradient>
          <linearGradient id="ov-stroke" x1="0" x2="1" y1="0" y2="0"><stop offset="0%" stopColor="#ffb35c"/><stop offset="100%" stopColor="#ff6a3d"/></linearGradient>
        </defs>
        {[1,2,3,4].map(g=><g key={g}>
          <line x1="0" x2={width} y1={y(scale.step*g)} y2={y(scale.step*g)} className="ov-grid"/>
          <text x="16" y={y(scale.step*g)-6} className="ov-chart-axis">{metric==='revenue'?compactNumber(scale.step*g):Math.round(scale.step*g)}</text>
        </g>)}
        <g key={animKey}>
          {compare&&!empty&&<path d={smoothPath(previous)} className="ov-prev-line"/>}
          {area&&<path d={area} fill="url(#ov-area)" className="ov-area-in"/>}
          {line&&<path d={line} fill="none" stroke="url(#ov-stroke)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" pathLength={1} className="ov-line-draw"/>}
        </g>
        {filled.length>0&&active===null&&<circle cx={filled[filled.length-1][0]} cy={filled[filled.length-1][1]} r="5" fill="#fff" stroke="#ff6a3d" strokeWidth="3"/>}
        {ticks.map(i=><text key={i} x={i===0?16:i===n-1?width-16:x(i)} y={height-9} textAnchor={i===0?'start':i===n-1?'end':'middle'} className="ov-chart-axis">{points[i].label}</text>)}
        {pinned!==null&&points[pinned]&&guide(pinned,'ov-guide pinned')}
        {hover!==null&&points[hover]&&guide(hover,'ov-guide')}
        {[...new Set([pinned,hover].filter((i):i is number=>i!==null))].map(i=>{
          const p=points[i],v=p?valueOf(p,metric):null;
          return p&&<g key={i}>
            {compare&&<circle cx={x(i)} cy={y(beforeOf(p,metric))} r="4" className="ov-dot-prev"/>}
            {v!==null&&<circle cx={x(i)} cy={y(v)} r="5.5" fill="#fff" stroke="#ff6a3d" strokeWidth="3"/>}
          </g>;
        })}
      </svg>}
      {active!==null&&hp&&<div className="ov-chart-tip" style={{left:tipLeft}} aria-live="polite">
        <b>{hp.label}</b>
        <span><i className="now"/>{hv===null?'Belum ada':fmt(hv)}</span>
        {hv!==null&&<em className={change===null?'flat':change>=0?'up':'down'}>{change===null?'Tanpa pembanding':`${change>=0?'▲':'▼'} ${Math.abs(change)}% vs ${comparisonLabel.toLowerCase()}`}</em>}
        {compare&&<span><i className="was"/>{comparisonLabel}: {fmt(beforeOf(hp,metric))}</span>}
        {pinned===active&&<small>Dipin · klik lagi untuk lepas</small>}
      </div>}
    </div>
  </div>;
}
