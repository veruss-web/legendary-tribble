'use client';

/** Customer directory and order intelligence. */
import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowUpRight, Check, CircleDollarSign, Clock3, Crown, Drumstick, CupSoda, Mail, Phone, Repeat2, Search, Soup,
  Sparkles, TrendingUp, Users, WalletCards,
} from 'lucide-react';
import { Actions } from '@/components/shared/primitives';
import { CustomerAvatar } from '@/components/shared/avatar';
import { getCustomerFulfillment, isCustomerOrderComplete, normalizeProductName, parseCustomerTargets } from '@/lib/customers';
import { compactNumber, money } from '@/lib/format';
import type { Customer, Order, OrderItem } from '@/lib/types';

const compact=compactNumber;
const itemIcon=(name:string,size=16)=>{const n=normalizeProductName(name);return /\b(es|teh|kopi|jus|minum|susu)\b/.test(n)?<CupSoda size={size}/>:n.includes('ayam')?<Drumstick size={size}/>:<Soup size={size}/>};

/** Sparkline path (line + filled area) for a short series. */
const spark=(vals:number[],w=220,h=64)=>{
 const max=Math.max(...vals,1),step=w/Math.max(1,vals.length-1);
 const pts=vals.map((v,i)=>[i*step,h-6-(v/max)*(h-16)]);
 const line=pts.map((p,i)=>`${i?'L':'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
 return {line,area:`${line} L${w} ${h} L0 ${h} Z`,last:pts[pts.length-1]};
};

export function Customers({customers,orders,orderItems,products=[],query,onEdit,onDelete}:any){
 const [localSearch,setLocalSearch]=useState('');
 const [tab,setTab]=useState<'all'|'completed'|'returning'|'pending'>('all');
 // Target pesanan dibaca dari catatan pelanggan, contoh: "Pesan mie 20", "Pesan 20 mie", atau "target 20".

 const customerStats=useMemo(()=>{
  const map=new Map<string,{orders:number;spend:number;last:string|null;qty:number}>();
  orders.forEach((o:Order)=>{if(!o.customer_id||o.status!=='completed')return;const item=map.get(o.customer_id)||{orders:0,spend:0,last:null,qty:0};item.orders+=1;item.spend+=Number(o.total)||0;if(!item.last||new Date(o.created_at)>new Date(item.last))item.last=o.created_at;const items=orderItems.filter((i:OrderItem)=>i.order_id===o.id);item.qty+=items.reduce((sum:number,i:OrderItem)=>sum+Number(i.quantity||0),0);map.set(o.customer_id,item)});
  return map;
 },[orders,orderItems]);
 const statusFor=(c:Customer)=>isCustomerOrderComplete(c,orders,orderItems,products)?'completed':'pending';
 const completedCount=customers.filter((c:Customer)=>statusFor(c)==='completed').length;
 const pendingCount=customers.filter((c:Customer)=>statusFor(c)==='pending').length;
 const returningCount=customers.filter((c:Customer)=>(customerStats.get(c.id)?.orders||0)>=2).length;
 const customerOrders=orders.filter((o:Order)=>!!o.customer_id&&o.status==='completed');
 const customerRevenue=customerOrders.reduce((a:number,o:Order)=>a+Number(o.total||0),0);
 const activeBuyers=customers.filter((c:Customer)=>customerStats.has(c.id)).length;
 const averageSpend=customerRevenue/Math.max(1,activeBuyers);
 const returningRate=customers.length?Math.round(returningCount/customers.length*100):0;
 const monthLabels=Array.from({length:6},(_,i)=>{const d=new Date();d.setMonth(d.getMonth()-(5-i));return d.toLocaleDateString('id-ID',{month:'short'}).replace('.','')});
 const monthValues=monthLabels.map((_,i)=>{const d=new Date();d.setMonth(d.getMonth()-(5-i));const y=d.getFullYear(),m=d.getMonth();return customerOrders.filter((o:Order)=>{const x=new Date(o.created_at);return x.getFullYear()===y&&x.getMonth()===m}).reduce((a:number,o:Order)=>a+Number(o.total||0),0)});
 const maxMonth=Math.max(...monthValues,1);
 const sp=spark(monthValues);
 const ranked=useMemo(()=>customers.filter((c:Customer)=>customerStats.has(c.id)).sort((a:Customer,b:Customer)=>(customerStats.get(b.id)?.spend||0)-(customerStats.get(a.id)?.spend||0)).slice(0,3),[customers,customerStats]);
 const topSpend=ranked[0]?customerStats.get(ranked[0].id)!.spend:0;
 const searchText=(localSearch||query||'').trim().toLowerCase();
 const filtered=customers.filter((c:Customer)=>{const s=customerStats.get(c.id);const returning=(s?.orders||0)>=2;const match=!searchText||[c.name,c.phone,c.email,c.notes].some((value)=>String(value||'').toLowerCase().includes(searchText));const status=tab==='completed'?statusFor(c)==='completed':tab==='returning'?returning:tab==='pending'?statusFor(c)==='pending':true;return match&&status}).sort((a:Customer,b:Customer)=>(customerStats.get(b.id)?.spend||0)-(customerStats.get(a.id)?.spend||0));
 const tabs:[typeof tab,string,number][]=[['all','Semua',customers.length],['completed','Selesai',completedCount],['pending','Pending',pendingCount],['returning','Returning',returningCount]];
 const kpis=[
  {tone:'blue',icon:Users,label:'Total pelanggan',value:customers.length.toLocaleString('id-ID'),note:'Database pelanggan'},
  {tone:'green',icon:TrendingUp,label:'Pelanggan selesai',value:completedCount.toLocaleString('id-ID'),note:'Pesanan terpenuhi'},
  {tone:'violet',icon:WalletCards,label:'Transaksi pelanggan',value:customerOrders.length.toLocaleString('id-ID'),note:'Order ber-pelanggan'},
  {tone:'orange',icon:CircleDollarSign,label:'Customer revenue',value:money(customerRevenue),note:`Rata-rata ${money(averageSpend)}`},
 ];
 return <div className="cx-page">
  <section className="cx-hero">
   <div className="cx-hero-copy">
    <span className="cx-eyebrow"><Sparkles size={13}/> Customer Intelligence</span>
    <h2>Analisis Pelanggan</h2>
    <p>Pahami pelanggan paling aktif, nilai transaksi, dan pola pembelian untuk keputusan yang lebih tepat.</p>
    <div className="cx-hero-stats">
     <div><b>{customers.length.toLocaleString('id-ID')}</b><span>Pelanggan</span></div>
     <div><b>{returningRate}%</b><span>Returning</span></div>
     <div><b>{compact(averageSpend)}</b><span>Rata-rata nilai</span></div>
    </div>
   </div>
   <div className="cx-hero-panel">
    <div className="cx-live"><i/> Real-time</div>
    <span className="cx-hero-label">Revenue pelanggan · 6 bulan</span>
    <strong>{money(customerRevenue)}</strong>
    <svg className="cx-spark" viewBox="0 0 220 64" preserveAspectRatio="none" aria-hidden="true">
     <defs><linearGradient id="cxSparkFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#ff8a4c" stopOpacity=".45"/><stop offset="1" stopColor="#ff8a4c" stopOpacity="0"/></linearGradient></defs>
     <path d={sp.area} fill="url(#cxSparkFill)"/><path d={sp.line} className="cx-spark-line"/>
     <circle cx={sp.last[0]} cy={sp.last[1]} r="3.5" className="cx-spark-dot"/>
    </svg>
   </div>
  </section>

  <section className="cx-kpis">{kpis.map((k,i)=><motion.div key={k.label} className={`cx-kpi ${k.tone}`} initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} transition={{duration:.35,delay:i*.05}}><div className="cx-kpi-icon"><k.icon size={19}/></div><span>{k.label}</span><b>{k.value}</b><small>{k.note}</small></motion.div>)}</section>

  <section className="cx-grid">
   <div className="cx-card cx-chart-card">
    <div className="cx-card-head"><div><span className="cx-eyebrow-dark">Revenue</span><h3>Penjualan dari pelanggan</h3></div><span className="cx-chip">6 bulan terakhir</span></div>
    <div className="cx-chart">
     <div className="cx-chart-grid">{[1,.66,.33,0].map(p=><div key={p}><span>{p?compact(maxMonth*p):'0'}</span></div>)}</div>
     <div className="cx-bars">{monthValues.map((v,i)=><div className={`cx-bar-col ${i===monthValues.length-1?'is-current':''}`} key={i}><div className="cx-bar-track"><em className="cx-bar-tip">{money(v)}</em><motion.div initial={{height:0}} animate={{height:`${Math.max(4,(v/maxMonth)*100)}%`}} transition={{duration:.6,delay:i*.06,ease:[.22,.61,.36,1]}} className="cx-bar"/></div><small>{monthLabels[i]}</small></div>)}</div>
    </div>
    <div className="cx-chart-foot"><span><i/> Revenue pelanggan</span><b>{money(customerRevenue)}</b></div>
   </div>

   <div className="cx-card cx-insight-card">
    <div className="cx-card-head"><div><span className="cx-eyebrow-dark">Insight</span><h3>Customer performance</h3></div><span className="cx-chip-icon"><Sparkles size={16}/></span></div>
    <div className="cx-spotlight">
     {ranked[0]?<><CustomerAvatar name={ranked[0].name} size="xl"/><div><span><Crown size={12}/> Top customer</span><b>{ranked[0].name}</b><small>{money(topSpend)} · {customerStats.get(ranked[0].id)!.orders} transaksi</small></div></>:<><span className="cx-spotlight-empty"><Crown size={22}/></span><div><span>Top customer</span><b>Belum ada</b><small>Belum ada transaksi pelanggan</small></div></>}
    </div>
    <div className="cx-metrics">
     <div><Repeat2 size={15}/><span>Returning</span><b>{returningCount}</b><small>{returningRate}% database</small></div>
     <div><CircleDollarSign size={15}/><span>Avg. value</span><b>{compact(averageSpend)}</b><small>per pelanggan</small></div>
    </div>
    {ranked.length>1&&<div className="cx-leaders"><span>Peringkat teratas</span>{ranked.map((c:Customer,i:number)=>{const sp2=customerStats.get(c.id)!.spend;return <div key={c.id}><em>{i+1}</em><CustomerAvatar name={c.name} size="sm"/><b>{c.name}</b><div className="cx-leader-bar"><i style={{width:`${Math.max(8,sp2/Math.max(1,topSpend)*100)}%`}}/></div><small>{compact(sp2)}</small></div>})}</div>}
   </div>
  </section>

  <section className="cx-card cx-directory">
   <div className="cx-dir-head"><div><span className="cx-eyebrow-dark">Customer directory</span><h3>Semua pelanggan</h3><p>Setiap pesanan ditampilkan lengkap berdasarkan produk dan progres pemenuhannya.</p></div><div className="cx-live cx-live-soft"><i/> Real-time</div></div>
   <div className="cx-toolbar">
    <label className="cx-search"><Search size={17}/><input value={localSearch} onChange={e=>setLocalSearch(e.target.value)} placeholder="Cari nama, telepon, atau email…"/></label>
    <div className="cx-tabs" role="tablist">{tabs.map(([key,label,count])=><button key={key} role="tab" aria-selected={tab===key} className={tab===key?'active':''} onClick={()=>setTab(key)}>{label} <b>{count}</b></button>)}</div>
   </div>
   <div className="cx-list">
    {filtered.map((c:Customer,idx:number)=>{
     const s=customerStats.get(c.id)||{orders:0,spend:0,last:null,qty:0};
     const targets=parseCustomerTargets(c);
     const fulfillment=getCustomerFulfillment(c.id,targets,orders,orderItems,products);
     const done=isCustomerOrderComplete(c,orders,orderItems,products);
     const orderDate=s.last?new Date(s.last).toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'}):'Belum ada';
     return <motion.article className={`cx-row ${done?'is-complete':'is-pending'}`} key={c.id} initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{duration:.28,delay:Math.min(idx,8)*.03}}>
      <div className="cx-row-id">
       <CustomerAvatar name={c.name} size="lg"/>
       <div className="cx-row-name">
        <div><h4>{c.name}</h4><span className={`cx-badge ${done?'done':s.orders?'pending':'new'}`}><i/>{done?'Selesai':s.orders?'Pending':'Terdaftar'}</span></div>
        <div className="cx-row-meta"><span><WalletCards size={13}/>{s.orders} transaksi</span><span><CircleDollarSign size={13}/>{money(s.spend)}</span></div>
       </div>
      </div>
      <div className="cx-row-orders">
       {fulfillment.length?fulfillment.map((item:any)=>{const ok=item.fulfilled>=item.qty;const pct=Math.min(100,(item.fulfilled/item.qty)*100);return <div className="cx-order" key={normalizeProductName(item.name)}>
        <span className="cx-order-icon">{itemIcon(item.name)}</span>
        <div className="cx-order-copy">
         <div><b>{item.name}</b><span>{item.fulfilled}/{item.qty}</span></div>
         <div className="cx-progress"><span className={ok?'full':''} style={{width:`${pct}%`}}/></div>
         <small className={!item.productExists?'warn':''}>{!item.productExists?'Menu belum dibuat • buat menu ini di Produk':ok?'Pesanan terpenuhi':`Kurang ${Math.max(0,item.qty-item.fulfilled)} pesanan`}</small>
        </div>
        <span className={`cx-order-state ${ok?'ok':''}`}>{ok?<Check size={13}/>:`${Math.round(pct)}%`}</span>
       </div>}):<div className="cx-order cx-order-empty"><span className="cx-order-icon"><Users size={16}/></span><div className="cx-order-copy"><b>{s.orders?'Pesanan selesai':'Belum ada pesanan'}</b><small>{s.orders?'Semua target pesanan telah terpenuhi.':'Tambahkan pesanan untuk mulai melacak progres.'}</small></div></div>}
      </div>
      <div className="cx-row-contact">
       <div><Phone size={13}/><div><span>Telepon</span><b>{c.phone||'—'}</b></div></div>
       <div><Clock3 size={13}/><div><span>Tanggal pesanan</span><b>{orderDate}</b></div></div>
       <div><Mail size={13}/><div><span>Email</span><b className={c.email?'':'is-empty'}>{c.email||'Belum diisi'}</b></div></div>
       <Actions onEdit={()=>onEdit(c)} onDelete={()=>onDelete(c.id)}/>
      </div>
     </motion.article>})}
    {!filtered.length&&<div className="cx-empty"><span><Users size={26}/></span><b>Tidak ada pelanggan yang cocok</b><small>Coba ubah kata kunci atau filter.</small></div>}
   </div>
   <div className="cx-foot"><span>Menampilkan <b>{filtered.length}</b> dari <b>{customers.length}</b> pelanggan</span><span><ArrowUpRight size={13}/> Status & progres dihitung dari seluruh pesanan selesai</span></div>
  </section>
 </div>
}
