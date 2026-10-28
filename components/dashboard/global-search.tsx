'use client';

/** Universal search results shown from the top bar. */
import { ChevronRight, Package, Search, Tags, Users, WalletCards } from 'lucide-react';
import { CustomerAvatar } from '@/components/shared/avatar';
import { money } from '@/lib/format';
import type { Category, Customer, Order, Page, Product } from '@/lib/types';

export function GlobalSearchResults({query,products,customers,categories,orders,go}:{query:string;products:Product[];customers:Customer[];categories:Category[];orders:Order[];go:(page:Page)=>void}){
 const q=String(query||'').trim().toLowerCase();
 const productHits=(products as Product[]).filter((p:Product)=>{
  const hay=[p.name,p.description||'',p.categories?.name||'',String(p.stock),String(p.price)].join(' ').toLowerCase();
  return !q||hay.includes(q);
 }).slice(0,6);
 const customerHits=(customers as Customer[]).filter((c:Customer)=>{
  const hay=[c.name,c.phone||'',c.email||'',c.notes||''].join(' ').toLowerCase();
  return !q||hay.includes(q);
 }).slice(0,6);
 const categoryHits=(categories as Category[]).filter((c:Category)=>{
  const hay=[c.name,c.color||''].join(' ').toLowerCase();
  return !q||hay.includes(q);
 }).slice(0,6);
 const orderHits=(orders as Order[]).filter((o:Order)=>{
  const hay=[o.order_number,o.status,o.payment_method,o.customers?.name||'',o.customers?.phone||'',String(o.total),new Date(o.created_at).toLocaleString('id-ID')].join(' ').toLowerCase();
  return !q||hay.includes(q);
 }).slice(0,6);
 const total=productHits.length+customerHits.length+categoryHits.length+orderHits.length;
 return (
  <div className="global-results">
   <div className="surface global-results-head">
    <div>
     <span className="section-label">GLOBAL SEARCH</span>
     <h2>Hasil pencarian untuk “{query}”</h2>
     <p>{total?`${total} hasil relevan ditemukan di Mieflow.`:'Tidak ada data yang cocok.'}</p>
    </div>
    <button className="secondary" onClick={()=>go('Products')}><Package size={15}/> Lihat produk</button>
   </div>
   <div className="global-results-grid">
    {productHits.length>0 && (
     <section className="surface global-result-card">
      <div className="global-result-title"><Package size={16}/><b>Produk</b><span>{productHits.length}</span></div>
      {productHits.map((p:Product)=>(
       <button key={p.id} className="global-result-row" onClick={()=>go('Products')}>
        <div className="global-result-avatar">{p.image_url?<img src={p.image_url} alt=""/>:<span>🍜</span>}</div>
        <div><b>{p.name}</b><small>{p.categories?.name||'Tanpa kategori'} • Stok {p.stock}</small></div>
        <strong>{money(Number(p.price))}</strong>
        <ChevronRight size={15}/>
       </button>
      ))}
     </section>
    )}
    {customerHits.length>0 && (
     <section className="surface global-result-card">
      <div className="global-result-title"><Users size={16}/><b>Pelanggan</b><span>{customerHits.length}</span></div>
      {customerHits.map((c:Customer)=>(
       <button key={c.id} className="global-result-row" onClick={()=>go('Customers')}>
        <CustomerAvatar name={c.name} size="md"/>
        <div><b>{c.name}</b><small>{c.phone||c.email||'Kontak belum diisi'}</small></div>
        <ChevronRight size={15}/>
       </button>
      ))}
     </section>
    )}
    {orderHits.length>0 && (
     <section className="surface global-result-card">
      <div className="global-result-title"><WalletCards size={16}/><b>Transaksi</b><span>{orderHits.length}</span></div>
      {orderHits.map((o:Order)=>(
       <button key={o.id} className="global-result-row" onClick={()=>go('Orders')}>
        <div className="global-result-avatar order">#</div>
        <div><b>#{o.order_number}</b><small>{o.customers?.name||'Pelanggan umum'} • {o.status}</small></div>
        <strong>{money(Number(o.total))}</strong>
        <ChevronRight size={15}/>
       </button>
      ))}
     </section>
    )}
    {categoryHits.length>0 && (
     <section className="surface global-result-card">
      <div className="global-result-title"><Tags size={16}/><b>Kategori</b><span>{categoryHits.length}</span></div>
      {categoryHits.map((c:Category)=>(
       <button key={c.id} className="global-result-row" onClick={()=>go('Categories')}>
        <div className="global-result-avatar category"><i style={{background:c.color}}/></div>
        <div><b>{c.name}</b><small>{c.color}</small></div>
        <ChevronRight size={15}/>
       </button>
      ))}
     </section>
    )}
    {!total && (
     <div className="surface global-no-results">
      <Search size={28}/>
      <b>Data tidak ditemukan</b>
      <span>Coba nama produk, pelanggan, nomor transaksi, kategori, atau kata kunci lain.</span>
     </div>
    )}
   </div>
  </div>
 );
}
