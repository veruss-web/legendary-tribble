'use client';

/** Overview: a live read of the shop. The sales chart leads; best sellers, restock and recent sales sit below it. */
import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowDownRight, ArrowUpRight, ChevronRight, Plus, ShoppingBag } from 'lucide-react';
import { SalesChart } from '@/components/overview/sales-chart';
import { Empty } from '@/components/shared/primitives';
import { money } from '@/lib/format';
import { levelOf } from '@/lib/inventory';
import { greeting, itemsSold, needsRestock, recentOrders, salesSeries, timeAgo, topProducts } from '@/lib/overview';
import type { Period } from '@/lib/overview';
import { paymentLabel } from '@/lib/payments';
import { RECEIPT_STORE } from '@/lib/store';
import type { Order, OrderItem, Page, Product } from '@/lib/types';

const PERIODS: { value: Period; tab: string; title: string; versus: string }[] = [
  { value: 'today', tab: 'Hari ini', title: 'hari ini', versus: 'dibanding kemarin pada jam yang sama' },
  { value: '7', tab: '7 hari', title: '7 hari terakhir', versus: 'dibanding 7 hari sebelumnya' },
  { value: '30', tab: '30 hari', title: '30 hari terakhir', versus: 'dibanding 30 hari sebelumnya' },
];
const SORTS: ['name' | 'price' | 'stock', string][] = [['name', 'Nama'], ['price', 'Harga'], ['stock', 'Stok']];
const MENU_LIMIT = 6;

export function Overview({products,orders,orderItems,go,onOpenOrder,onAddProduct}:{products:Product[];orders:Order[];orderItems:OrderItem[];go:(page:Page)=>void;onOpenOrder:(order:Order)=>void;onAddProduct:()=>void}){
 const [period,setPeriod]=useState<Period>('today');
 const [category,setCategory]=useState('all');
 const [sort,setSort]=useState<'name'|'price'|'stock'>('name');
 const [now,setNow]=useState(()=>new Date());
 useEffect(()=>{const timer=setInterval(()=>setNow(new Date()),60000);return()=>clearInterval(timer)},[]);

 const current=PERIODS.find(p=>p.value===period)!;
 const series=useMemo(()=>salesSeries(orders,period,now),[orders,period,now]);
 const sold=useMemo(()=>itemsSold(orderItems,series.orderIds),[orderItems,series]);
 const best=useMemo(()=>topProducts(orderItems,series.orderIds,5),[orderItems,series]);
 const recent=useMemo(()=>recentOrders(orders,6),[orders]);
 const restock=useMemo(()=>needsRestock(products),[products]);
 const delta=series.delta;

 const activeProducts=products.filter(p=>p.is_active);
 const categories=Array.from(new Set(activeProducts.map(p=>p.categories?.name).filter(Boolean))).slice(0,4) as string[];
 const menu=activeProducts
  .filter(p=>category==='all'||p.categories?.name===category)
  .sort((a,b)=>sort==='price'?Number(b.price)-Number(a.price):sort==='stock'?b.stock-a.stock:a.name.localeCompare(b.name,'id'))
  .slice(0,MENU_LIMIT);

 return <div className="ov-page">
  <header className="ov-head">
   <div>
    <h1>{greeting(now)}, {RECEIPT_STORE.name}</h1>
    <p>{now.toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</p>
   </div>
   <div className="ov-actions">
    <button type="button" className="ov-btn solid" onClick={()=>go('POS')}><ShoppingBag size={17}/> Buka kasir</button>
    <button type="button" className="ov-btn" onClick={onAddProduct}><Plus size={17}/> Tambah produk</button>
   </div>
  </header>

  <section className="ov-hero" aria-label="Penjualan">
   <div className="ov-hero-top">
    <div className="ov-revenue">
     <span className="ov-label">Omzet {current.title}</span>
     <strong>{money(series.total)}</strong>
     <span className={`ov-delta ${delta===null?'flat':delta>=0?'up':'down'}`}>
      {delta!==null&&(delta>=0?<ArrowUpRight size={15}/>:<ArrowDownRight size={15}/>)}
      <b>{delta===null?'Belum ada pembanding':`${delta>=0?'+':''}${delta}%`}</b>
      {delta!==null&&<small>{current.versus}</small>}
     </span>
    </div>
    <div className="ov-tabs" role="tablist" aria-label="Periode penjualan">
     {PERIODS.map(p=><button key={p.value} type="button" role="tab" aria-selected={period===p.value} className={period===p.value?'active':''} onClick={()=>setPeriod(p.value)}>{p.tab}</button>)}
    </div>
   </div>
   <SalesChart series={series} comparisonLabel={period==='today'?'Kemarin':'Periode lalu'}/>
   <div className="ov-strip">
    <div><span>Transaksi</span><b>{series.count}</b></div>
    <div><span>Rata-rata per transaksi</span><b>{money(series.count?series.total/series.count:0)}</b></div>
    <div><span>Item terjual</span><b>{sold}</b></div>
    <button type="button" className={restock.length?'warn':''} onClick={()=>go('Inventory')}><span>Stok perlu perhatian</span><b>{restock.length}{restock.length>0&&<AlertTriangle size={15}/>}</b></button>
   </div>
  </section>

  <section className="ov-ledger">
   <div className="ov-col">
    <header><h2>Menu terlaris</h2><span>{current.title}</span></header>
    {best.length?<ol className="ov-rank">{best.map((t,i)=><li key={t.key}>
     <span className="ov-rank-no">{i+1}</span>
     <div><b>{t.name}</b><i style={{['--w' as any]:`${Math.max(6,(t.qty/best[0].qty)*100)}%`}}/></div>
     <span className="ov-rank-qty">{t.qty}<small>terjual</small></span>
    </li>)}</ol>:<p className="ov-none">Belum ada penjualan pada periode ini.</p>}
   </div>
   <div className="ov-col">
    <header><h2>Perlu restock</h2><button type="button" onClick={()=>go('Inventory')}>Buka inventory <ChevronRight size={15}/></button></header>
    {restock.length?<ul className="ov-restock">{restock.slice(0,5).map(p=><li key={p.id}>
     <div><b>{p.name}</b><small>{p.categories?.name||'Tanpa kategori'}</small></div>
     <span className={`ov-pill ${levelOf(p.stock)}`}>{p.stock<=0?'Habis':`Sisa ${p.stock}`}</span>
    </li>)}</ul>:<p className="ov-none ok">Semua stok dalam kondisi aman.</p>}
   </div>
   <div className="ov-col">
    <header><h2>Transaksi terbaru</h2><button type="button" onClick={()=>go('Orders')}>Lihat semua <ChevronRight size={15}/></button></header>
    {recent.length?<ul className="ov-recent">{recent.map(o=><li key={o.id}><button type="button" onClick={()=>onOpenOrder(o)}>
     <div><b>{o.customers?.name||'Pelanggan umum'}</b><small>#{o.order_number} · {paymentLabel(o.payment_method)} · {timeAgo(o.created_at,now)}</small></div>
     <strong>{money(Number(o.total))}</strong>
    </button></li>)}</ul>:<p className="ov-none">Belum ada transaksi. <button type="button" className="ov-link" onClick={()=>go('POS')}>Mulai di Kasir</button></p>}
   </div>
  </section>

  <section className="ov-catalog">
   <header>
    <div><h2>Menu aktif</h2><p>{activeProducts.length} menu dijual. Pilih untuk mengelola di Produk.</p></div>
    <div className="ov-tools">
     <div className="ov-chips" role="group" aria-label="Kategori">
      <button type="button" className={category==='all'?'active':''} onClick={()=>setCategory('all')}>Semua</button>
      {categories.map(c=><button type="button" key={c} className={category===c?'active':''} onClick={()=>setCategory(c)}>{c}</button>)}
     </div>
     <div className="ov-seg" role="group" aria-label="Urutkan menu">
      {SORTS.map(([value,label])=><button type="button" key={value} className={sort===value?'active':''} onClick={()=>setSort(value)}>{label}</button>)}
     </div>
    </div>
   </header>
   {menu.length?<div className="ov-menu-grid">{menu.map(p=><button type="button" className="ov-menu" key={p.id} onClick={()=>go('Products')}>
    <span className="ov-menu-img">{p.image_url?<img src={p.image_url} alt=""/>:<span>🍜</span>}</span>
    <b>{p.name}</b>
    <small>{p.categories?.name||'Tanpa kategori'}</small>
    <span className="ov-menu-foot"><strong>{money(Number(p.price))}</strong><span className={`ov-pill ${levelOf(p.stock)}`}>{p.stock} stok</span></span>
   </button>)}</div>:<Empty text="Belum ada produk aktif."/>}
  </section>
 </div>
}
