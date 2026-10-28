'use client';

/** Product catalog management. */
import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Boxes, Edit3, Package, PackageOpen, Trash2 } from 'lucide-react';
import { money } from '@/lib/format';
import { LOW_STOCK } from '@/lib/inventory';
import type { Product } from '@/lib/types';

export function Products({products,onEdit,onDelete}:{products:Product[];onEdit:(product:Product)=>void;onDelete:(id:string)=>void}){
 const [category,setCategory]=useState('Semua');
 const categories=useMemo(()=>Array.from(new Set(products.map((p:Product)=>p.categories?.name).filter(Boolean))) as string[],[products]);
 const visible=category==='Semua'?products:products.filter((p:Product)=>p.categories?.name===category);
 return <div className="product-catalog-page">
  <section className="product-catalog-hero">
   <div><span className="section-label">MIEFLOW MARKETPLACE</span><h2>Katalog Produk</h2><p>Tampilan katalog premium untuk mengelola menu, stok, harga, dan foto produk dengan lebih nyaman.</p></div>
   <div className="catalog-summary"><div><b>{products.length}</b><small>Total produk</small></div><div><b>{products.filter((p:Product)=>p.is_active).length}</b><small>Produk aktif</small></div><div><b>{products.filter((p:Product)=>p.stock<LOW_STOCK).length}</b><small>Stok menipis</small></div></div>
  </section>
  <section className="catalog-toolbar"><div className="catalog-tabs"><button className={category==='Semua'?'active':''} onClick={()=>setCategory('Semua')}>Semua <span>{products.length}</span></button>{categories.map(c=><button key={c} className={category===c?'active':''} onClick={()=>setCategory(c)}>{c}</button>)}</div><div className="catalog-count"><Package size={16}/>{visible.length} produk ditampilkan</div></section>
  {visible.length?<section className="product-catalog-grid">{visible.map((p:Product,i:number)=><motion.article key={p.id} className="catalog-product-card" initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} transition={{delay:Math.min(i*.025,.3)}} whileHover={{y:-5}}>
   <div className="catalog-product-media">{p.image_url?<img src={p.image_url} alt={p.name}/>:<span>🍜</span>}<div className="catalog-media-top"><em>{p.categories?.name||'Menu'}</em><span className={p.is_active?'online':'offline'}>{p.is_active?'Aktif':'Nonaktif'}</span></div><div className="catalog-stock-float">{p.stock<LOW_STOCK?<AlertTriangle size={13}/>:<Boxes size={13}/>} {p.stock} stok</div></div>
   <div className="catalog-product-body"><div className="catalog-product-copy"><h3>{p.name}</h3><p>{p.description||'Belum ada deskripsi untuk produk ini.'}</p></div><div className="catalog-price-row"><div><small>Harga jual</small><b>{money(Number(p.price))}</b></div><div className="catalog-card-actions"><button type="button" onClick={()=>onEdit(p)} aria-label={`Edit ${p.name}`}><Edit3 size={16}/></button><button type="button" onClick={()=>onDelete(p.id)} aria-label={`Hapus ${p.name}`}><Trash2 size={16}/></button></div></div></div>
  </motion.article>)}</section>:<div className="surface catalog-empty"><PackageOpen size={30}/><b>Produk tidak ditemukan</b><p>Tidak ada produk pada kategori ini atau sesuai pencarian.</p></div>}
 </div>
}
