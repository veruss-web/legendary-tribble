'use client';

/** Transaction history and order detail. */
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Box, CalendarDays, Check, CheckCircle2, ChevronDown, ChevronRight, Clock3, CreditCard, MoreHorizontal, PackageOpen, Search, ShieldCheck, ShoppingBag, Sparkles, TrendingUp, WalletCards, X } from 'lucide-react';
import { Empty } from '@/components/shared/primitives';
import { OptionSheet } from '@/components/shared/option-sheet';
import { money } from '@/lib/format';
import { paymentLabel, paymentTone } from '@/lib/payments';
import type { Order, OrderItem } from '@/lib/types';

export function Orders({orders,orderItems,query,onOpen}:any){
 const [method,setMethod]=useState('all');
 const [status,setStatus]=useState('all');
 const [range,setRange]=useState('all');
 const [rangeOpen,setRangeOpen]=useState(false);
 const [methodOpen,setMethodOpen]=useState(false);
 const [statusOpen,setStatusOpen]=useState(false);
 const [pageIndex,setPageIndex]=useState(1);
 const pageSize=10;
 const [sort,setSort]=useState('newest');
 const [sortOpen,setSortOpen]=useState(false);
 const [view,setView]=useState<'list'|'compact'>('list');
 const [localSearch,setLocalSearch]=useState('');
 const q=(localSearch.trim()||query||'').trim().toLowerCase();
 useEffect(()=>{setPageIndex(1)},[q]);
 const base=orders.filter((o:Order)=>{
   const date=new Date(o.created_at);
   const hay=[
     o.order_number,o.id,o.status,o.payment_method,paymentLabel(o.payment_method),
     o.customers?.name||'',o.customers?.phone||'',o.customers?.email||'',
     String(o.total),date.toLocaleString('id-ID'),date.toLocaleDateString('id-ID'),
     date.toISOString(),date.toISOString().slice(0,10),
     date.toLocaleDateString('id-ID',{day:'2-digit',month:'long',year:'numeric'}),
     date.toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'})
   ].join(' ').toLowerCase();
   return !q||hay.includes(q);
 });
 const now=Date.now();
 const filtered=base.filter((o:Order)=>{
   const methodOk=method==='all'||(method==='cash'&&o.payment_method==='cash')||(method==='ewallet'&&['qris','ewallet'].includes(o.payment_method))||(method==='atm'&&['card','atm'].includes(o.payment_method));
   const statusOk=status==='all'||(status==='success'?o.status==='completed':o.status===status);
   const age=now-new Date(o.created_at).getTime();
   const rangeOk=range==='all'||(range==='today'?age<86400000:range==='week'?age<604800000:range==='month'?age<2592000000:true);
   return methodOk&&statusOk&&rangeOk;
 }).sort((a:Order,b:Order)=>sort==='oldest'?new Date(a.created_at).getTime()-new Date(b.created_at).getTime():new Date(b.created_at).getTime()-new Date(a.created_at).getTime());
 const totalPages=Math.max(1,Math.ceil(filtered.length/pageSize));
 const safePage=Math.min(pageIndex,totalPages);
 const paged=filtered.slice((safePage-1)*pageSize,safePage*pageSize);
 const setMethodFilter=(value:string)=>{setMethod(value);setPageIndex(1);setMethodOpen(false)};
 const setStatusFilter=(value:string)=>{setStatus(value);setPageIndex(1);setStatusOpen(false)};
 const completed=base.filter((o:Order)=>o.status==='completed');
 const total=completed.reduce((sum:number,o:Order)=>sum+Number(o.total||0),0);
 const avg=completed.length?total/completed.length:0;
 const methods=completed.reduce((m:any,o:Order)=>{m[o.payment_method]=(m[o.payment_method]||0)+1;return m},{});
 const topMethod=Object.entries(methods).sort((a:any,b:any)=>b[1]-a[1])[0]?.[0]||'cash';
 const topPct=completed.length?Math.round(((methods[topMethod]||0)/completed.length)*100):0;
 const itemCount=(o:Order)=>orderItems.filter((i:OrderItem)=>i.order_id===o.id).reduce((sum:number,i:OrderItem)=>sum+Number(i.quantity||0),0);
 return <div className="orders-page orders-premium-page">
   <div className="orders-premium-head">
    <div className="orders-premium-title"><div className="orders-hero-icon"><WalletCards size={24}/></div><div><span className="eyebrow">TRANSACTION CENTER</span><h2>Riwayat Transaksi <Sparkles size={19}/></h2><p>Semua pembayaran tersimpan rapi, cepat dicari, dan siap dibuka kapan saja.</p></div></div>
   </div>
   <section className="orders-premium-kpis">
    <div className="orders-kpi violet"><i><CalendarDays size={19}/></i><span>Total Transaksi</span><b>{completed.length}</b><small>↑ Data transaksi tersimpan</small></div>
    <div className="orders-kpi green"><i><WalletCards size={19}/></i><span>Total Omzet</span><b>{money(total)}</b><small>↑ Pembayaran berhasil</small></div>
    <div className="orders-kpi blue"><i><TrendingUp size={19}/></i><span>Rata-rata Transaksi</span><b>{money(avg)}</b><small>Per transaksi selesai</small></div>
    <div className="orders-kpi orange"><i><CreditCard size={19}/></i><span>Metode Terbanyak</span><b>{paymentLabel(topMethod)}</b><small>{topPct}% dari total transaksi</small></div>
   </section>
   <section className="surface orders-premium-surface">
    <div className="orders-filter-bar">
      <button className="orders-filter-select orders-period-trigger" type="button" onClick={()=>setRangeOpen(true)} aria-haspopup="dialog" aria-expanded={rangeOpen}>
        <CalendarDays size={16}/><span>{range==='all'?'Semua waktu':range==='today'?'24 jam terakhir':range==='week'?'7 hari terakhir':'30 hari terakhir'}</span><ChevronDown size={14}/>
      </button>
      <button className="orders-filter-select orders-period-trigger" type="button" onClick={()=>setMethodOpen(true)}><CreditCard size={16}/><span>{method==='all'?'Semua Metode':method==='cash'?'Tunai':method==='ewallet'?'E-Wallet':'ATM'}</span><ChevronDown size={14}/></button>
      <button className="orders-filter-select orders-period-trigger" type="button" onClick={()=>setStatusOpen(true)}><CheckCircle2 size={16}/><span>{status==='all'?'Semua Status':'Berhasil'}</span><ChevronDown size={14}/></button>
      <label className="orders-filter-search"><Search size={16}/><input value={localSearch} onChange={e=>{setLocalSearch(e.target.value);setPageIndex(1)}} placeholder="Cari kode pembayaran, tanggal, pelanggan..." aria-label="Cari transaksi"/><button type="button" className="orders-search-clear" onClick={()=>{setLocalSearch('');setPageIndex(1)}} aria-label="Hapus pencarian" style={{display:localSearch?'grid':'none'}}>×</button></label>
    </div>
    <div className="orders-list-head"><div><h3>Daftar Transaksi</h3><p>{filtered.length} transaksi ditemukan</p></div><div className="orders-list-tools"><button type="button" className="orders-sort-trigger" onClick={()=>setSortOpen(true)} aria-haspopup="dialog" aria-expanded={sortOpen}><span>{sort==='oldest'?'Terlama':'Terbaru'}</span><ChevronDown size={13}/></button><div className="orders-view-toggle"><button className={view==='list'?'active':''} onClick={()=>setView('list')}><MoreHorizontal size={16}/></button><button className={view==='compact'?'active':''} onClick={()=>setView('compact')}><Box size={15}/></button></div></div></div>
    <div className={`orders-premium-list ${view==='compact'?'compact':''}`}>
      {paged.map((o:Order)=>{const d=new Date(o.created_at);return <button className="transaction-card" key={o.id} onClick={()=>onOpen(o)}>
        <span className="transaction-main-icon"><ShoppingBag size={20}/></span>
        <span className="transaction-info"><b>#{o.order_number}</b><small><CalendarDays size={13}/>{d.toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'})}<span>•</span><Clock3 size={13}/>{d.toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'})}</small><strong>{o.customers?.name||'Pelanggan umum'}</strong><em>{o.customers?.phone||'Tanpa nomor telepon'}</em></span>
        <span className={`transaction-payment ${paymentTone(o.payment_method)}`}><i><CreditCard size={15}/></i>{paymentLabel(o.payment_method)}</span>
        <span className="transaction-total"><b>{money(Number(o.total||0))}</b><small>{itemCount(o)} item</small></span>
        <span className="transaction-success"><Check size={14}/>Berhasil</span><ChevronRight size={19} className="transaction-arrow"/>
      </button>})}
    </div>
    {!filtered.length&&<Empty text={q?'Transaksi tidak ditemukan.':'Belum ada transaksi pada filter ini.'}/>} 
    {filtered.length>0&&<div className="orders-pagination"><button disabled={safePage<=1} onClick={()=>setPageIndex(p=>Math.max(1,p-1))}>‹ Sebelumnya</button><div>{Array.from({length:Math.min(totalPages,5)},(_,i)=>{const page=totalPages<=5?i+1:Math.max(1,Math.min(totalPages-4,safePage-2))+i;return <button type="button" key={page} className={page===safePage?'active':''} onClick={()=>setPageIndex(page)}>{page}</button>})}{totalPages>5&&safePage<totalPages-2&&<span>…</span>}</div><button disabled={safePage>=totalPages} onClick={()=>setPageIndex(p=>Math.min(totalPages,p+1))}>Selanjutnya ›</button></div>}
   </section>
   {sortOpen&&<div className="orders-sort-overlay" role="presentation" onClick={()=>setSortOpen(false)}><div className="orders-sort-sheet" role="dialog" aria-modal="true" aria-labelledby="orders-sort-title" onClick={e=>e.stopPropagation()}><div className="orders-sort-head"><div><span className="eyebrow">URUTKAN TRANSAKSI</span><h3 id="orders-sort-title">Pilih urutan</h3><p>Tentukan transaksi yang ingin ditampilkan lebih dahulu.</p></div><button type="button" className="orders-period-close" onClick={()=>setSortOpen(false)} aria-label="Tutup"><X size={18}/></button></div><div className="orders-sort-options">{[['newest','Terbaru','Transaksi paling baru ditampilkan lebih dahulu'],['oldest','Terlama','Transaksi paling lama ditampilkan lebih dahulu']].map(([value,title,desc])=>{const active=sort===value;return <button type="button" key={value} className={`orders-sort-option ${active?'active':''}`} onClick={()=>{setSort(value);setPageIndex(1);setSortOpen(false)}}><span className="orders-sort-option-copy"><b>{title}</b><small>{desc}</small></span><span className="orders-period-check">{active&&<Check size={16}/>}</span></button>})}</div></div></div>}
   <AnimatePresence>
    {methodOpen&&<OptionSheet eyebrow="PAYMENT METHOD" title="Pilih metode pembayaran" description="Filter transaksi berdasarkan metode pembayaran." icon={CreditCard} value={method} options={[['all','Semua Metode','Semua pembayaran'],['cash','Tunai','Pembayaran tunai'],['ewallet','E-Wallet','Pembayaran dompet digital'],['atm','ATM','Pembayaran kartu atau ATM']]} onSelect={setMethodFilter} onClose={()=>setMethodOpen(false)}/>}
    {statusOpen&&<OptionSheet eyebrow="TRANSACTION STATUS" title="Pilih status transaksi" description="Filter riwayat berdasarkan status pembayaran." icon={CheckCircle2} value={status} options={[['all','Semua Status','Seluruh transaksi'],['success','Berhasil','Pembayaran berhasil diselesaikan']]} onSelect={setStatusFilter} onClose={()=>setStatusOpen(false)}/>}
    {rangeOpen&&<OptionSheet eyebrow="TRANSACTION FILTER" title="Pilih periode transaksi" description="Tentukan rentang data yang ingin ditampilkan." icon={CalendarDays} value={range} options={[['all','Semua waktu','Seluruh riwayat transaksi'],['today','24 jam terakhir','Aktivitas dalam satu hari terakhir'],['week','7 hari terakhir','Ringkasan transaksi satu minggu'],['month','30 hari terakhir','Analisis transaksi satu bulan']]} onSelect={v=>{setRange(v);setPageIndex(1);setRangeOpen(false)}} onClose={()=>setRangeOpen(false)}/>}
   </AnimatePresence>
 </div>
}

export function OrderDetailModal({order,items,onClose}:{order:Order;items:OrderItem[];onClose:()=>void}){
 const content=<motion.div className="modal-backdrop order-detail-backdrop" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onMouseDown={onClose}>
  <motion.div className="order-detail-modal" initial={{y:22,scale:.98}} animate={{y:0,scale:1}} onMouseDown={e=>e.stopPropagation()}>
   <div className="order-detail-head"><div><span>TRANSACTION DETAIL</span><h2>#{order.order_number}</h2><p>{new Date(order.created_at).toLocaleString('id-ID',{dateStyle:'full',timeStyle:'short'})}</p></div><button onClick={onClose}><X size={18}/></button></div><div className="order-detail-status"><div><CheckCircle2 size={18}/><span>Pembayaran berhasil</span></div><b>{order.status}</b></div><div className="order-detail-grid"><div className="order-detail-card"><span>PELANGGAN</span><b>{order.customers?.name||'Pelanggan umum'}</b><small>{order.customers?.phone||'Tanpa nomor telepon'}</small></div><div className="order-detail-card"><span>METODE BAYAR</span><b>{paymentLabel(order.payment_method)}</b><small>Dibayar {money(Number(order.amount_paid||order.total))}</small></div></div><div className="order-detail-items"><div className="order-detail-section-title"><div><span>ITEM TRANSAKSI</span><b>{items.reduce((a,i)=>a+Number(i.quantity),0)} item</b></div></div>{items.length?items.map(i=><div className="order-detail-item" key={i.id}><div className="order-detail-item-no">{i.quantity}×</div><div><b>{i.product_name}</b><small>{money(Number(i.unit_price))} / item</small></div><strong>{money(Number(i.line_total))}</strong></div>):<div className="order-detail-empty"><PackageOpen size={22}/><span>Detail item belum tersedia.</span></div>}</div>{order.notes&&<div className="order-detail-note"><span>CATATAN PESANAN</span><p>{order.notes}</p></div>}<div className="order-detail-total"><span>Subtotal</span><b>{money(Number(order.subtotal))}</b><span>Diskon</span><b>- {money(Number(order.discount||0))}</b><strong>Total pembayaran</strong><strong>{money(Number(order.total))}</strong><span>Kembalian</span><b>{money(Number(order.change_due||0))}</b></div><div className="order-detail-footer"><div><ShieldCheck size={16}/><span>Transaksi tersimpan aman di Mieflow</span></div><button className="secondary" onClick={onClose}>Tutup</button>   </div>
  </motion.div>
 </motion.div>;
 return typeof document!=='undefined'?createPortal(content,document.body):content;
}
