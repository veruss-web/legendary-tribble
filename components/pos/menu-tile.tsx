'use client';

/** One menu item of Kasir. The photo carries the live stock chip; the footer holds the price and either an add button or,
 *  once the item is in the order, a − / qty / + stepper. `stock` is what is still sellable right now (already corrected for
 *  reservations that are in flight), so the number on the tile always matches what a tap will really do. */
import { Minus, Plus } from 'lucide-react';
import { money } from '@/lib/format';
import { LOW_STOCK } from '@/lib/inventory';
import { stockLevel } from '@/lib/pos';
import type { Product } from '@/lib/types';

export function MenuTile({product:p,qty,stock,onAdd,onMinus}:{product:Product;qty:number;stock:number;onAdd:(product:Product)=>void;onMinus:(product:Product)=>void}){
 const level=stockLevel(stock,LOW_STOCK);
 const out=level==='out';
 return <article className={`ks-tile ${qty>0?'in':''} ${out?'out':''}`} data-stock={level}>
  <button type="button" className="ks-tile-main" disabled={out} onClick={()=>onAdd(p)} aria-label={out?`${p.name} habis`:`Tambah ${p.name}, ${money(Number(p.price))}, stok ${stock}`}>
   <span className="ks-tile-media">
    {p.image_url?<img src={p.image_url} alt="" loading="lazy"/>:<span className="ks-tile-emoji" aria-hidden="true">🍜</span>}
    <span className={`ks-stock ${level}`} aria-live="polite"><i aria-hidden="true"/>{out?'Habis':`Stok ${stock}`}</span>
   </span>
   <span className="ks-tile-info"><small>{p.categories?.name||'Menu'}</small><b>{p.name}</b></span>
  </button>
  <div className="ks-tile-foot">
   <strong className="ks-tile-price">{money(Number(p.price))}</strong>
   {qty>0
    ?<div className="ks-tile-step" role="group" aria-label={`Jumlah ${p.name}`}>
      <button type="button" aria-label={`Kurangi ${p.name}`} onClick={()=>onMinus(p)}><Minus size={15}/></button>
      <b>{qty}</b>
      <button type="button" aria-label={`Tambah ${p.name}`} disabled={out} onClick={()=>onAdd(p)}><Plus size={15}/></button>
     </div>
    :<button type="button" className="ks-tile-add" aria-label={`Tambah ${p.name}`} disabled={out} onClick={()=>onAdd(p)}><Plus size={18}/></button>}
  </div>
 </article>
}
