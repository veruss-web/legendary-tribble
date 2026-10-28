'use client';

/** Inventory: stock health, priorities and manual adjustments. */
import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Boxes, CheckCircle2, PackageOpen, Package, Plus, Minus, RefreshCw, Search, ShieldCheck, Trash2, Wallet, Zap } from 'lucide-react';
import { ensureFreshSession, friendlySupabaseError, runWithAuthRetry, supabase } from '@/lib/supabase';
import { compactNumber, money } from '@/lib/format';
import { LOW_STOCK, compareBy, levelOf } from '@/lib/inventory';
import type { Level, Sort } from '@/lib/inventory';
import type { Category, Product } from '@/lib/types';

type Filter = 'all' | Level;
const NO_CATEGORY = '__none__';
const LEVEL_LABEL: Record<Level, string> = { good: 'Aman', low: 'Menipis', out: 'Habis' };
const SORTS: [Sort, string][] = [['low', 'Stok terendah'], ['high', 'Terbanyak'], ['name', 'A–Z']];
const RING = 2 * Math.PI * 46;
const ATTENTION_LIMIT = 6;

/**
 * Ids whose order is frozen: recomputed only when `key` changes (filter, sort, search, product list) or via `refresh`,
 * never because a stock number changed. This is what keeps a row under the cursor when +1 / +10 is pressed:
 * the row used to jump to its new rank in the stock-sorted list after every click.
 */
function useFrozenIds(key: string, compute: () => string[]) {
  const [frozen, setFrozen] = useState(() => ({ key, ids: compute() }));
  const fresh = compute();
  if (frozen.key !== key) { setFrozen({ key, ids: fresh }); return { ids: fresh, stale: false, refresh: () => {} }; }
  return { ids: frozen.ids, stale: fresh.join() !== frozen.ids.join(), refresh: () => setFrozen({ key, ids: fresh }) };
}

export function Inventory({products,categories=[],query,onStockChange,onAdd,onDelete,onError}:{products:Product[];categories?:Category[];query:string;onStockChange:(id:string,stock:number)=>void;onAdd:()=>void;onDelete:(id:string)=>void;onError?:(message:string)=>void}){
 const [search,setSearch]=useState('');
 const [filter,setFilter]=useState<Filter>('all');
 const [cat,setCat]=useState<string>('all');
 const [sort,setSort]=useState<Sort>('low');
 const [busy,setBusy]=useState<string|null>(null);
 const stockOf=(p:Product)=>p.stock;
 /** +1 / −1 / +10, written with compare-and-swap: only if the database still holds the stock that is on screen,
  *  so a manual adjustment can never overwrite a sale made on another device. */
 const adjust=async(p:Product,delta:number)=>{
  setBusy(p.id);
  try{
   const sessionNow=await ensureFreshSession();
   if(!sessionNow)throw new Error('Sesi login sudah berakhir. Silakan login kembali.');
   const current=p.stock,next=Math.max(0,current+delta);
   if(next===current)return;
   const res=await runWithAuthRetry(()=>supabase.from('products').update({stock:next}).eq('id',p.id).eq('owner_id',sessionNow.user.id).eq('stock',current).select('stock'));
   if(res.error)throw res.error;
   if(!res.data||res.data.length===0){
    const fresh=await runWithAuthRetry(()=>supabase.from('products').select('stock').eq('id',p.id).eq('owner_id',sessionNow.user.id).maybeSingle());
    if(!fresh.error&&fresh.data)onStockChange(p.id,Number(fresh.data.stock));
    throw new Error('Stok produk ini sudah berubah di perangkat lain. Angka stok sudah diperbarui, silakan ulangi penyesuaian.');
   }
   const movement=await runWithAuthRetry(()=>supabase.from('stock_movements').insert({owner_id:sessionNow.user.id,product_id:p.id,quantity_delta:next-current,reason:'manual adjustment'}));
   if(movement.error)console.warn('Riwayat stok tidak tersimpan:',movement.error);
   onStockChange(p.id,next);
  }catch(err:any){const message=friendlySupabaseError(err);if(onError)onError(message);else console.error(message)}finally{setBusy(null)}
 };

 const known=useMemo(()=>new Set(categories.map(c=>c.id)),[categories]);
 const byId=useMemo(()=>new Map(products.map(p=>[p.id,p])),[products]);
 const catKey=(p:Product)=>p.category_id&&known.has(p.category_id)?p.category_id:NO_CATEGORY;
 const counts={good:0,low:0,out:0};
 products.forEach(p=>{counts[levelOf(stockOf(p))]+=1});
 const totalUnits=products.reduce((sum,p)=>sum+Math.max(0,Number(stockOf(p))||0),0);
 const stockValue=products.reduce((sum,p)=>sum+Math.max(0,Number(stockOf(p))||0)*(Number(p.price)||0),0);
 const healthPct=products.length?Math.round((counts.good/products.length)*100):0;
 const reference=Math.max(20,...products.map(p=>Number(stockOf(p))||0));
 const chips=[...categories.map(c=>({id:c.id,name:c.name,color:c.color,count:products.filter(p=>catKey(p)===c.id).length})).filter(c=>c.count>0),...(products.some(p=>catKey(p)===NO_CATEGORY)?[{id:NO_CATEGORY,name:'Tanpa kategori',color:'#98a2b3',count:products.filter(p=>catKey(p)===NO_CATEGORY).length}]:[])];
 const q=(search||query||'').trim().toLowerCase();

 // Daftar & "Perlu perhatian" dikunci pada snapshot: stok yang berubah (+1/+10) memperbarui angka dan status baris,
 // tetapi tidak memindahkan baris. Urutan dihitung ulang saat filter/urutan/pencarian/daftar produk berubah atau lewat tombol "Perbarui urutan".
 const productKey=products.map(p=>p.id).join(',');
 const list=useFrozenIds(`${filter}|${cat}|${sort}|${q}|${productKey}`,()=>products.filter(p=>{
  const stock=stockOf(p);
  const matches=!q||[p.name,p.description||'',p.categories?.name||'',String(stock),String(p.price)].join(' ').toLowerCase().includes(q);
  return matches&&(filter==='all'||levelOf(stock)===filter)&&(cat==='all'||catKey(p)===cat);
 }).sort(compareBy(sort,stockOf)).map(p=>p.id));
 const priority=useFrozenIds(productKey,()=>products.filter(p=>levelOf(stockOf(p))!=='good').sort(compareBy('low',stockOf)).slice(0,ATTENTION_LIMIT).map(p=>p.id));
 const filtered=list.ids.map(id=>byId.get(id)).filter((p):p is Product=>Boolean(p));
 const attention=priority.ids.map(id=>byId.get(id)).filter((p):p is Product=>Boolean(p));
 const orderStale=list.stale||priority.stale;
 const refreshOrder=()=>{list.refresh();priority.refresh()};
 const ring=(['good','low','out'] as Level[]).reduce<{level:Level;len:number;offset:number}[]>((acc,level)=>{const len=products.length?(counts[level]/products.length)*RING:0;const offset=acc.reduce((s,x)=>s+x.len,0);return [...acc,{level,len,offset}]},[]);
 const kpis=[
  {tone:'teal',icon:Boxes,label:'Total unit',value:totalUnits.toLocaleString('id-ID'),note:`${products.length} produk terdaftar`},
  {tone:'violet',icon:Wallet,label:'Nilai stok',value:money(stockValue),note:'Stok × harga jual'},
  {tone:'amber',icon:AlertTriangle,label:'Stok menipis',value:counts.low,note:`Kurang dari ${LOW_STOCK} unit`},
  {tone:'rose',icon:PackageOpen,label:'Stok habis',value:counts.out,note:'Perlu restock segera'},
 ];
 const tabs:[Filter,string,number][]=[['all','Semua',products.length],['good','Aman',counts.good],['low','Menipis',counts.low],['out','Habis',counts.out]];

 return <div className="iv-page">
  <section className="iv-hero">
   <div className="iv-hero-copy">
    <span className="iv-eyebrow"><ShieldCheck size={13}/> Stock Control</span>
    <h2>Inventory Management</h2>
    <p>Pantau ketersediaan produk, lihat prioritas restock, dan sesuaikan stok dengan cepat.</p>
    <div className="iv-hero-actions">
     <button type="button" className="iv-cta" onClick={onAdd}><Plus size={16}/> Tambah produk</button>
     <div className="iv-hero-stats"><div><b>{products.length}</b><span>Produk</span></div><div><b>{compactNumber(totalUnits)}</b><span>Total unit</span></div><div><b>{compactNumber(stockValue)}</b><span>Nilai stok</span></div></div>
    </div>
   </div>
   <div className="iv-hero-panel">
    <div className="iv-live"><i/> Sinkron POS</div>
    <div className="iv-donut-wrap">
     <svg className="iv-donut" viewBox="0 0 120 120" role="img" aria-label={`${healthPct}% produk berstok aman`}>
      <circle className="track" cx="60" cy="60" r="46"/>
      {ring.map(seg=>seg.len>0&&<circle key={seg.level} className={seg.level} cx="60" cy="60" r="46" strokeDasharray={`${Math.max(0,seg.len-(products.length>1?3:0))} ${RING}`} strokeDashoffset={-seg.offset}/>)}
     </svg>
     <div className="iv-donut-center"><b>{healthPct}%</b><span>stok aman</span></div>
    </div>
    <ul className="iv-legend"><li className="good"><i/>Aman<b>{counts.good}</b></li><li className="low"><i/>Menipis<b>{counts.low}</b></li><li className="out"><i/>Habis<b>{counts.out}</b></li></ul>
   </div>
  </section>

  <section className="iv-kpis">{kpis.map((k,i)=><motion.div key={k.label} className={`iv-kpi ${k.tone}`} initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} transition={{duration:.35,delay:i*.05}}><div className="iv-kpi-icon"><k.icon size={19}/></div><span>{k.label}</span><b title={String(k.value)}>{k.value}</b><small>{k.note}</small></motion.div>)}</section>

  {attention.length>0&&<section className="iv-card iv-attention">
   <div className="iv-attention-head"><div><span className="iv-kicker iv-kicker-warn"><Zap size={13}/> Prioritas restock</span><h3>Perlu perhatian</h3></div><small>{counts.low+counts.out} produk di bawah batas aman</small></div>
   <div className="iv-attention-list">{attention.map(p=>{const stock=stockOf(p);const lvl=levelOf(stock);return <div key={p.id} className={`iv-alert ${lvl}`}>
    <div className="iv-alert-top"><span className="iv-alert-thumb">{p.image_url?<img src={p.image_url} alt=""/>:<Package size={17}/>}</span><div><b>{p.name}</b><small>{p.categories?.name||'Tanpa kategori'}</small></div></div>
    <div className="iv-alert-bottom"><span className={`iv-status ${lvl}`}><i/>{lvl==='out'?'Habis':`Sisa ${stock}`}</span><button type="button" disabled={busy===p.id} onClick={()=>adjust(p,10)} aria-label={`Tambah 10 stok ${p.name}`}><Plus size={13}/> 10</button></div>
   </div>})}</div>
  </section>}

  <section className="iv-card iv-board">
   <div className="iv-board-head"><div><span className="iv-kicker">Inventory overview</span><h3>Daftar persediaan</h3><p>Kelola stok setiap produk dari satu tempat.</p></div>{orderStale&&<button type="button" className="iv-refresh" onClick={refreshOrder} title="Baris tidak dipindah saat stok diubah. Klik untuk mengurutkan ulang sesuai stok terbaru."><RefreshCw size={14}/> Perbarui urutan</button>}</div>
   <div className="iv-toolbar">
    <label className="iv-search"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cari produk atau kategori…" aria-label="Cari produk"/></label>
    <div className="iv-tabs" role="tablist" aria-label="Status stok">{tabs.map(([key,label,count])=><button key={key} type="button" role="tab" aria-selected={filter===key} className={`${filter===key?'active':''} ${key}`} onClick={()=>setFilter(key)}>{label} <b>{count}</b></button>)}</div>
   </div>
   <div className="iv-subbar">
    <div className="iv-cats" role="tablist" aria-label="Kategori"><button type="button" role="tab" aria-selected={cat==='all'} className={cat==='all'?'active':''} onClick={()=>setCat('all')}>Semua kategori</button>{chips.map(c=><button type="button" role="tab" aria-selected={cat===c.id} key={c.id} className={cat===c.id?'active':''} style={{['--dot' as any]:c.color}} onClick={()=>setCat(c.id)}><em/>{c.name} <b>{c.count}</b></button>)}</div>
    <div className="iv-sort" role="tablist" aria-label="Urutkan">{SORTS.map(([key,label])=><button key={key} type="button" role="tab" aria-selected={sort===key} className={sort===key?'active':''} onClick={()=>setSort(key)}>{label}</button>)}</div>
   </div>

   <div className="iv-list">
    {filtered.map((p,idx)=>{
     const stock=stockOf(p);const lvl=levelOf(stock);const pct=Math.min(100,Math.max(lvl==='out'?0:4,(Math.max(0,stock)/reference)*100));
     return <motion.article className={`iv-row ${lvl}`} key={p.id} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{duration:.25,delay:Math.min(idx,8)*.03}}>
      <div className="iv-prod"><div className="iv-thumb">{p.image_url?<img src={p.image_url} alt=""/>:<Package size={21}/>}</div><div className="iv-prod-copy"><b>{p.name}</b><small>{p.description||'Produk Mieflow'}</small><span className="iv-cat" style={{['--c' as any]:p.categories?.color||'#98a2b3'}}><i/>{p.categories?.name||'Tanpa kategori'}</span></div></div>
      <div className="iv-level"><div className="iv-level-top"><strong className={lvl}>{stock}</strong><span>unit</span><em className={`iv-status ${lvl}`}><i/>{LEVEL_LABEL[lvl]}</em></div><div className="iv-bar" aria-hidden="true"><i className={lvl} style={{width:`${pct}%`}}/></div></div>
      <div className="iv-money"><span>Harga jual</span><b>{money(p.price)}</b><small>Nilai stok {money(Math.max(0,stock)*(Number(p.price)||0))}</small></div>
      <div className="iv-adjust">
       <div className="iv-stepper"><button type="button" disabled={busy===p.id||stock<=0} onClick={()=>adjust(p,-1)} aria-label={`Kurangi stok ${p.name}`}><Minus size={15}/></button><span>{busy===p.id?'…':stock}</span><button type="button" disabled={busy===p.id} onClick={()=>adjust(p,1)} aria-label={`Tambah stok ${p.name}`}><Plus size={15}/></button></div>
       <button type="button" className="iv-quick" disabled={busy===p.id} onClick={()=>adjust(p,10)} aria-label={`Tambah 10 stok ${p.name}`} title="Tambah 10 stok">+10</button>
       <button type="button" className="iv-delete" aria-label={`Hapus ${p.name}`} title={`Hapus ${p.name}`} onClick={()=>onDelete(p.id)}><Trash2 size={16}/></button>
      </div>
     </motion.article>})}
    {!filtered.length&&<div className="iv-empty"><span><PackageOpen size={26}/></span><b>Produk tidak ditemukan</b><small>Coba kata kunci, status, atau kategori yang berbeda.</small></div>}
   </div>
   <div className="iv-foot"><span>Menampilkan <b>{filtered.length}</b> dari <b>{products.length}</b> produk</span><span><CheckCircle2 size={14}/> Stok tersinkron dengan POS</span></div>
  </section>
 </div>
}
