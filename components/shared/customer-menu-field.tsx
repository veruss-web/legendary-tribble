'use client';

/**
 * Menu picker for the customer form: pick dishes by category and quantity.
 * The selection is written into the customer's notes as "Nama menu 20" lines, which is exactly what the
 * order-target tracking (lib/customers.ts) already reads, so no database change is needed.
 */
import { useMemo, useState } from 'react';
import { CupSoda, Drumstick, Minus, Plus, Search, Soup, UtensilsCrossed, X } from 'lucide-react';
import { composeNotesFromMenu, normalizeProductName, splitNotesIntoMenu, type MenuPicks } from '@/lib/customers';
import { money } from '@/lib/format';
import type { Category, Product } from '@/lib/types';

const dishIcon=(name:string,size=22)=>{const n=normalizeProductName(name);return /\b(es|teh|kopi|jus|minum|susu)\b/.test(n)?<CupSoda size={size}/>:n.includes('ayam')?<Drumstick size={size}/>:<Soup size={size}/>};
const NO_CATEGORY='__none__';

export function CustomerMenuField({products,categories,value,onChange}:{products:Product[];categories:Category[];value:string;onChange:(notes:string)=>void}){
 const menu=useMemo(()=>products.filter(p=>p.is_active!==false),[products]);
 // Parsed once from the saved notes; after that this component is the source of truth and writes notes back on every change.
 const [state,setState]=useState(()=>splitNotesIntoMenu(value,menu));
 const [category,setCategory]=useState<string>('all');
 const [search,setSearch]=useState('');
 const {picks,extra}=state;

 const commit=(nextPicks:MenuPicks,nextExtra:string)=>{setState({picks:nextPicks,extra:nextExtra});onChange(composeNotesFromMenu(nextPicks,menu,nextExtra))};
 const setQty=(id:string,qty:number)=>{const q=Math.max(0,Math.min(999,Math.floor(Number.isFinite(qty)?qty:0)));const next={...picks};if(q>0)next[id]=q;else delete next[id];commit(next,extra)};

 const categoryOf=(p:Product)=>p.category_id&&categories.some(c=>c.id===p.category_id)?p.category_id:NO_CATEGORY;
 const chips=useMemo(()=>{
  const list=categories.map(c=>({id:c.id,name:c.name,color:c.color,count:menu.filter(p=>categoryOf(p)===c.id).length})).filter(c=>c.count>0);
  const loose=menu.filter(p=>categoryOf(p)===NO_CATEGORY).length;
  if(loose)list.push({id:NO_CATEGORY,name:'Tanpa kategori',color:'#98a2b3',count:loose});
  return list;
  // eslint-disable-next-line react-hooks/exhaustive-deps
 },[menu,categories]);
 const pickedIn=(id:string)=>menu.filter(p=>(id==='all'||categoryOf(p)===id)&&picks[p.id]).length;

 const q=search.trim().toLowerCase();
 const visible=menu.filter(p=>(category==='all'||categoryOf(p)===category)&&(!q||p.name.toLowerCase().includes(q)));
 const chosen=menu.filter(p=>picks[p.id]>0);
 const totalQty=chosen.reduce((a,p)=>a+picks[p.id],0);
 const totalPrice=chosen.reduce((a,p)=>a+picks[p.id]*Number(p.price||0),0);
 const catName=(p:Product)=>categories.find(c=>c.id===p.category_id)?.name||'Tanpa kategori';

 return <div className="cx-menu-field">
  <section className="cx-menu">
   <div className="cx-menu-head">
    <div><span className="cx-menu-kicker"><UtensilsCrossed size={13}/> Pesanan menu</span><b>Pilih menu makanan & minuman</b><small>Otomatis menjadi target pesanan dan progresnya terlacak di halaman Pelanggan.</small></div>
    <div className="cx-menu-total"><small>{totalQty} porsi</small><b>{money(totalPrice)}</b><span>estimasi</span></div>
   </div>

   {menu.length===0?<div className="cx-menu-empty"><UtensilsCrossed size={22}/><b>Belum ada menu</b><small>Tambahkan produk di halaman Produk, lalu menu akan muncul di sini. Anda tetap bisa menulis pesanan manual pada catatan.</small></div>:<>
    <div className="cx-menu-tools">
     <label className="cx-menu-search"><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cari menu…" aria-label="Cari menu"/>{search&&<button type="button" onClick={()=>setSearch('')} aria-label="Hapus pencarian"><X size={14}/></button>}</label>
    </div>
    <div className="cx-menu-cats" role="tablist" aria-label="Kategori menu">
     <button type="button" role="tab" aria-selected={category==='all'} className={category==='all'?'active':''} onClick={()=>setCategory('all')}>Semua <b>{menu.length}</b>{pickedIn('all')>0&&<i>{pickedIn('all')}</i>}</button>
     {chips.map(c=><button type="button" role="tab" aria-selected={category===c.id} key={c.id} className={category===c.id?'active':''} onClick={()=>setCategory(c.id)} style={{['--dot' as any]:c.color||'#98a2b3'}}><em/>{c.name} <b>{c.count}</b>{pickedIn(c.id)>0&&<i>{pickedIn(c.id)}</i>}</button>)}
    </div>

    <div className="cx-menu-grid">
     {visible.map(p=>{const qty=picks[p.id]||0;return <div key={p.id} className={`cx-dish ${qty?'is-picked':''}`}>
      <button type="button" className="cx-dish-main" onClick={()=>setQty(p.id,qty+1)} aria-label={`Tambah ${p.name}`}>
       <span className="cx-dish-thumb">{p.image_url?<img src={p.image_url} alt="" loading="lazy"/>:dishIcon(p.name)}</span>
       <span className="cx-dish-copy"><b>{p.name}</b><small>{catName(p)}</small><strong>{money(p.price)}{Number(p.stock)<=0&&<em className="cx-dish-out">Stok habis</em>}</strong></span>
      </button>
      {qty>0?<div className="cx-stepper"><button type="button" onClick={()=>setQty(p.id,qty-1)} aria-label={`Kurangi ${p.name}`}><Minus size={14}/></button><input inputMode="numeric" value={qty} onChange={e=>setQty(p.id,Number(e.target.value.replace(/\D/g,'')))} aria-label={`Jumlah ${p.name}`}/><button type="button" onClick={()=>setQty(p.id,qty+1)} aria-label={`Tambah ${p.name}`}><Plus size={14}/></button></div>:<button type="button" className="cx-dish-add" onClick={()=>setQty(p.id,1)}><Plus size={14}/> Tambah</button>}
     </div>})}
     {!visible.length&&<div className="cx-menu-none"><Search size={20}/><b>Menu tidak ditemukan</b><small>Coba kategori atau kata kunci lain.</small></div>}
    </div>

    {chosen.length>0&&<div className="cx-picked">
     <div className="cx-picked-head"><span>Pesanan dipilih <b>{chosen.length}</b></span><button type="button" onClick={()=>commit({},extra)}>Kosongkan</button></div>
     <div className="cx-picked-list">{chosen.map(p=><span className="cx-picked-chip" key={p.id}>{p.name}<b>×{picks[p.id]}</b><button type="button" onClick={()=>setQty(p.id,0)} aria-label={`Hapus ${p.name}`}><X size={12}/></button></span>)}</div>
    </div>}
   </>}
  </section>

  <label className="cx-field full">
   <span className="cx-field-label">Catatan tambahan <small>Opsional</small></span>
   <div className="cx-input cx-input-area"><textarea value={extra} placeholder="Preferensi pelanggan, alergi, atau pesanan menu yang belum dibuat…" rows={3} onChange={e=>commit(picks,e.target.value)}/></div>
   <span className="cx-hint">Menu yang belum ada di daftar bisa ditulis manual, contoh “Mie Pedas 10”. Progresnya akan terlacak setelah menunya dibuat di Produk.</span>
  </label>
 </div>
}
