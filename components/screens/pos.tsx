'use client';

/** Kasir (point of sale): pick menu on the left, build the order ticket on the right, pay, then show the receipt.
 *
 *  Stock is reserved the moment an item is added (adjust_product_stock), so two cashiers can never sell the last portion twice.
 *  Taps feel instant: the cart and the stock shown on the menu change at once, while the database call runs in a per-product queue.
 *  `pending` holds the stock change of calls that are still on their way, and every stock number on screen is
 *  `database stock + pending`; when a call answers, the database value replaces the guess, and a rejected call rolls its tap back.
 *  Paying is blocked while any call is open, so a portion that was never reserved can not be sold. */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { AnimatePresence } from 'framer-motion';
import { ChevronRight, Search, ShoppingBag } from 'lucide-react';
import { MenuTile } from '@/components/pos/menu-tile';
import { ReceiptSheet } from '@/components/pos/receipt-sheet';
import { Ticket } from '@/components/pos/ticket';
import { LOW_STOCK } from '@/lib/inventory';
import { money } from '@/lib/format';
import type { PaymentMethod } from '@/lib/payments';
import { availableStock, cartCount, cartTotal, filterMenu, menuCategories, menuStats } from '@/lib/pos';
import { ensureFreshSession, friendlySupabaseError, runWithAuthRetry, supabase } from '@/lib/supabase';
import type { CartItem, Category, Customer, OrderItem, Product, Receipt } from '@/lib/types';

/** `cart` lives in Dashboard, not here: adding an item already took its stock in the database, so a cart that vanished on navigation would leave that stock missing. */
export function POS({products,categories,customers,query,cart,onCartChange:setCart,onDone,onStockChange}:{products:Product[];categories:Category[];customers:Customer[];query:string;cart:CartItem[];onCartChange:Dispatch<SetStateAction<CartItem[]>>;onDone:(receipt:Receipt,soldItems:CartItem[],newOrderItems?:OrderItem[])=>void;onStockChange:(id:string,stock:number)=>void}){
 const [activeCategory,setActiveCategory]=useState('Semua');
 const [customer,setCustomer]=useState('');
 const [note,setNote]=useState('');
 const [payment,setPayment]=useState<PaymentMethod>('cash');
 const [paid,setPaid]=useState('');
 const [saving,setSaving]=useState(false);
 const [paymentError,setPaymentError]=useState('');
 const [receipt,setReceipt]=useState<Receipt|null>(null);
 const [receiptOpen,setReceiptOpen]=useState(false);
 const [ticketOpen,setTicketOpen]=useState(false);
 /** product id -> stock change of calls not answered yet (−1 = a portion just added, +1 = one just taken back). */
 const [pending,setPending]=useState<Record<string,number>>({});
 const [syncing,setSyncing]=useState(0);
 const queues=useRef(new Map<string,Promise<void>>());

 const stockById=useMemo(()=>new Map(products.map(p=>[p.id,p.stock])),[products]);
 const stockOf=(id:string)=>availableStock(stockById.get(id)??0,pending[id]);
 const menu=useMemo(()=>products.filter(p=>p.is_active),[products]);
 const visible=useMemo(()=>filterMenu(products,activeCategory,query),[products,activeCategory,query]);
 const pills=useMemo(()=>menuCategories(products,categories),[products,categories]);
 const quantities=useMemo(()=>new Map(cart.map(x=>[x.id,x.qty])),[cart]);
 const stats=menuStats(menu,p=>stockOf(p.id),LOW_STOCK);
 const total=cartTotal(cart),count=cartCount(cart);
 const search=(query||'').trim();

 useEffect(()=>{
  document.body.style.overflow=ticketOpen?'hidden':'';
  return()=>{document.body.style.overflow=''};
 },[ticketOpen]);
 /** The drawer only exists below the side-by-side breakpoint: close it when the window grows past it, and on Escape. */
 useEffect(()=>{
  if(!ticketOpen)return;
  const wide=window.matchMedia('(min-width:1280px)');
  const onWide=()=>{if(wide.matches)setTicketOpen(false)};
  const onKey=(e:KeyboardEvent)=>{if(e.key==='Escape')setTicketOpen(false)};
  wide.addEventListener('change',onWide);document.addEventListener('keydown',onKey);
  return()=>{wide.removeEventListener('change',onWide);document.removeEventListener('keydown',onKey)};
 },[ticketOpen]);
 useEffect(()=>{if(!cart.length)setTicketOpen(false)},[cart.length]);

 /** One database call per tap, queued per product so the answers can never arrive out of order. `rollback` undoes the tap on the cart if the database refuses it. */
 const reserve=(id:string,delta:number,rollback:()=>void)=>{
  setPending(m=>({...m,[id]:(m[id]||0)+delta}));
  setSyncing(n=>n+1);
  const run=async()=>{
   try{
    const result=await runWithAuthRetry(()=>supabase.rpc('adjust_product_stock',{p_product_id:id,p_quantity_delta:delta}));
    if(result.error)throw result.error;
    const next=Number(result.data?.stock);
    if(!Number.isFinite(next))throw new Error('Stok produk tidak dapat diperbarui.');
    onStockChange(id,next);
   }catch(err:any){
    rollback();
    setPaymentError(friendlySupabaseError(err));
   }finally{
    setPending(m=>{const left=(m[id]||0)-delta;const rest={...m};if(left)rest[id]=left;else delete rest[id];return rest});
    setSyncing(n=>n-1);
   }
  };
  queues.current.set(id,(queues.current.get(id)||Promise.resolve()).then(run));
 };
 const restoreLine=(line:CartItem)=>setCart(c=>c.some(x=>x.id===line.id)?c.map(x=>x.id===line.id?{...x,qty:x.qty+line.qty}:x):[...c,line]);

 /** "+" on a tile or on the ticket: one portion more. */
 const add=(p:Product)=>{
  setPaymentError('');
  if(!p.is_active||stockOf(p.id)<=0){setPaymentError(`Stok ${p.name} sudah habis.`);return;}
  setCart(c=>c.some(x=>x.id===p.id)?c.map(x=>x.id===p.id?{...x,qty:x.qty+1}:x):[...c,{...p,qty:1}]);
  reserve(p.id,-1,()=>setCart(c=>c.flatMap(x=>x.id!==p.id?[x]:x.qty>1?[{...x,qty:x.qty-1}]:[])));
 };
 /** "−" (one portion back) and the trash button (`n` = the whole line): the stock goes back to the shelf. */
 const give=(line:CartItem,n:number)=>{
  setPaymentError('');
  const qty=Math.min(n,line.qty);
  setCart(c=>c.flatMap(x=>x.id!==line.id?[x]:x.qty>qty?[{...x,qty:x.qty-qty}]:[]));
  reserve(line.id,qty,()=>restoreLine({...line,qty}));
 };
 const decrease=(line:CartItem)=>give(line,1);
 const removeItem=(line:CartItem)=>give(line,line.qty);
 /** "−" on a menu tile: one portion less, and the last portion takes the item off the ticket. */
 const minusProduct=(p:Product)=>{
  const line=cart.find(x=>x.id===p.id);
  if(line)give(line,1);
 };
 /** Empties the order and returns every reserved portion. */
 const clearOrder=()=>{
  const lines=cart;
  if(!lines.length)return;
  setPaymentError('');setCart([]);
  lines.forEach(line=>reserve(line.id,line.qty,()=>restoreLine({...line})));
 };

 const checkout=async()=>{
  if(!cart.length||saving||syncing)return;
  setSaving(true);setPaymentError('');
  try{
   const amount=payment==='cash'?Number(paid||0):total;
   const result=await runWithAuthRetry(()=>supabase.rpc('create_sale',{p_customer_id:customer||null,p_payment_method:payment,p_amount_paid:amount,p_items:cart.map(x=>({product_id:x.id,quantity:x.qty})),p_note:note.trim()||null}));
   if(result.error)throw result.error;
   const soldItems=cart.map(x=>({...x}));
   const createdOrderId=result.data?.id;
   let newOrderItems:OrderItem[]=[];
   if(createdOrderId){
    const sessionNow=await ensureFreshSession();
    const itemResult=await runWithAuthRetry(()=>supabase.from('order_items').select('*').eq('order_id',createdOrderId).eq('owner_id',sessionNow!.user.id));
    if(!itemResult.error) newOrderItems=(itemResult.data||[]) as OrderItem[];
   }
   const receiptData:Receipt={...result.data,customer_id:customer||null,payment_method:payment,notes:note.trim()||null,created_at:new Date().toISOString(),items:soldItems};
   setReceipt(receiptData);setReceiptOpen(true);setTicketOpen(false);
   setCart([]);setPaid('');setNote('');
   onDone(receiptData,soldItems,newOrderItems);
  }catch(err:any){setPaymentError(friendlySupabaseError(err));}
  finally{setSaving(false)}
 };

 return <div className="ks-page">
  <section className="ks-menu" aria-label="Menu">
   <header className="ks-menu-head">
    <div className="ks-menu-title">
     <h1>Kasir</h1>
     <p>{search?`${visible.length} hasil untuk “${search}”`:'Ketuk menu untuk menambah ke pesanan'}</p>
    </div>
    <div className="ks-stats" aria-label="Ringkasan stok menu">
     <span className="good"><i aria-hidden="true"/><b>{stats.ready}</b> tersedia</span>
     {stats.thin>0&&<span className="low"><i aria-hidden="true"/><b>{stats.thin}</b> menipis</span>}
     {stats.out>0&&<span className="out"><i aria-hidden="true"/><b>{stats.out}</b> habis</span>}
    </div>
   </header>
   <div className="ks-cats" role="tablist" aria-label="Kategori menu">
    {pills.map(c=><button type="button" role="tab" aria-selected={activeCategory===c.name} key={c.name} className={activeCategory===c.name?'active':''} onClick={()=>setActiveCategory(c.name)}>
     {c.color&&<i style={{['--c' as any]:c.color}}/>}{c.name}<em>{c.count}</em>
    </button>)}
   </div>
   {visible.length
    ?<div className="ks-grid">{visible.map(p=><MenuTile key={p.id} product={p} qty={quantities.get(p.id)||0} stock={stockOf(p.id)} onAdd={add} onMinus={minusProduct}/>)}</div>
    :<div className="ks-none"><Search size={26}/><b>{search?'Menu tidak ditemukan':'Belum ada menu yang bisa dijual'}</b><small>{search?'Coba kata kunci lain.':'Tambahkan produk atau isi stok di Inventory.'}</small></div>}
  </section>

  <div className={`ks-side ${ticketOpen?'ks-open':''}`}>
   <div className="ks-scrim" onClick={()=>setTicketOpen(false)}/>
   <Ticket cart={cart} customers={customers} customer={customer} note={note} payment={payment} paid={paid} saving={saving} syncing={syncing>0} error={paymentError} hasReceipt={Boolean(receipt)} stockOf={stockOf}
    onCustomer={setCustomer} onNote={setNote} onPayment={setPayment} onPaid={setPaid}
    onPlus={add} onMinus={decrease} onRemove={removeItem} onClear={clearOrder} onPay={checkout}
    onDismissError={()=>setPaymentError('')} onShowReceipt={()=>setReceiptOpen(true)} onClose={()=>setTicketOpen(false)}/>
  </div>

  {cart.length>0&&<div className="ks-dock-wrap"><button type="button" className="ks-dock" onClick={()=>setTicketOpen(true)}>
   <span className="ks-dock-count"><ShoppingBag size={18}/>{count}</span>
   <span className="ks-dock-text"><small>Pesanan</small><b>{money(total)}</b></span>
   <span className="ks-dock-go">Lihat <ChevronRight size={16}/></span>
  </button></div>}

  <AnimatePresence>{receipt&&receiptOpen&&<ReceiptSheet receipt={receipt} onClose={()=>setReceiptOpen(false)}/>}</AnimatePresence>
 </div>
}
