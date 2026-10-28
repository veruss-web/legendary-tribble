'use client';

/** Searchable customer selector used at checkout. */
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Search, Users, X } from 'lucide-react';
import { CustomerAvatar } from '@/components/shared/avatar';
import type { Customer } from '@/lib/types';

export function CustomerPicker({customers,value,onChange}:{customers:Customer[];value:string;onChange:(value:string)=>void}){
 const [open,setOpen]=useState(false);
 const [search,setSearch]=useState('');
 const [mounted,setMounted]=useState(false);
 const triggerRef=useRef<HTMLButtonElement|null>(null);
 const menuRef=useRef<HTMLDivElement|null>(null);
 const selected=customers.find(c=>c.id===value);
 const filtered=customers.filter(c=>`${c.name} ${c.phone||''} ${c.email||''}`.toLowerCase().includes(search.trim().toLowerCase()));
 useEffect(()=>{if(value&&!customers.some(c=>c.id===value))onChange('')},[value,customers,onChange]);
 useEffect(()=>{setMounted(true)},[]);
 useEffect(()=>{
  if(!open)return;
  const close=(e:PointerEvent)=>{const target=e.target as Node;if(triggerRef.current?.contains(target)||menuRef.current?.contains(target))return;setOpen(false)};
  const key=(e:KeyboardEvent)=>{if(e.key==='Escape')setOpen(false)};
  document.addEventListener('pointerdown',close);document.addEventListener('keydown',key);
  return()=>{document.removeEventListener('pointerdown',close);document.removeEventListener('keydown',key)};
 },[open]);
 useEffect(()=>{if(!open)setSearch('')},[open]);
 const choose=(id:string)=>{onChange(id);setOpen(false)};
 const menu=open?<><div className="cx-pick-overlay" onPointerDown={()=>setOpen(false)} aria-hidden="true"/><div ref={menuRef} className="cx-pick-menu" role="dialog" aria-label="Pilih pelanggan">
  <div className="cx-pick-grab" aria-hidden="true"/>
  <div className="cx-pick-head"><div><span>Pilih pelanggan</span><b>{customers.length+1} pilihan</b></div><button type="button" onClick={()=>setOpen(false)} aria-label="Tutup"><X size={17}/></button></div>
  <label className="cx-pick-search"><Search size={16}/><input autoFocus value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cari nama atau nomor telepon..."/></label>
  <div className="cx-pick-list" role="listbox">
   <button type="button" className={!value?'active':''} onClick={()=>choose('')} role="option" aria-selected={!value}><span className="cx-avatar cx-avatar-md cx-avatar-general"><Users size={17}/></span><span className="cx-pick-copy"><b>Pelanggan umum</b><small>Transaksi tanpa data pelanggan</small></span>{!value&&<span className="cx-pick-check"><Check size={14}/></span>}</button>
   {filtered.map(c=><button type="button" key={c.id} className={value===c.id?'active':''} onClick={()=>choose(c.id)} role="option" aria-selected={value===c.id}><CustomerAvatar name={c.name}/><span className="cx-pick-copy"><b>{c.name}</b><small>{c.phone||c.email||'Data kontak belum diisi'}</small></span>{value===c.id&&<span className="cx-pick-check"><Check size={14}/></span>}</button>)}
   {!filtered.length&&<div className="cx-pick-empty"><span><Search size={20}/></span><b>Pelanggan tidak ditemukan</b><small>Coba nama atau nomor telepon lain.</small></div>}
  </div>
 </div></>:null;
 return <div className={`customer-picker cx-pick ${open?'open':''}`}>
  <button ref={triggerRef} type="button" className="cx-pick-trigger" onClick={()=>setOpen(v=>!v)} aria-expanded={open} aria-haspopup="dialog">{selected?<CustomerAvatar name={selected.name}/>:<span className="cx-avatar cx-avatar-md cx-avatar-general"><Users size={17}/></span>}<span className="cx-pick-copy"><b>{selected?.name||'Pelanggan umum'}</b><small>{selected?.phone||selected?.email||'Transaksi tanpa data pelanggan'}</small></span><ChevronDown size={17} className="cx-pick-chevron"/></button>
  {mounted&&menu&&createPortal(menu,document.body)}
 </div>
}
