'use client';

/** Shown after a successful payment: the receipt paper (the same markup that gets printed) with print / new-order actions. */
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Printer, X } from 'lucide-react';
import { money } from '@/lib/format';
import { paymentLabel } from '@/lib/payments';
import { printReceipt, receiptCss } from '@/lib/receipt';
import type { Paper } from '@/lib/receipt';
import { RECEIPT_STORE } from '@/lib/store';
import type { Receipt } from '@/lib/types';

export function ReceiptSheet({receipt,onClose}:{receipt:Receipt;onClose:()=>void}){
 const [paper,setPaper]=useState<Paper>('80');
 useEffect(()=>{
  const onKey=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose()};
  document.addEventListener('keydown',onKey);
  return()=>document.removeEventListener('keydown',onKey);
 },[onClose]);
 const orderNo=String(receipt.order_number||receipt.id||'');
 const items=receipt.items||[];
 return <motion.div className="ks-sheet-backdrop" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={onClose}>
  <motion.div className="ks-sheet" role="dialog" aria-modal="true" aria-label="Struk pembayaran" initial={{opacity:0,y:28,scale:.98}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:20}} transition={{duration:.24,ease:'easeOut'}} onClick={e=>e.stopPropagation()}>
   <header className="ks-sheet-head">
    <span className="ks-sheet-check"><Check size={22}/></span>
    <div><h2>Pembayaran berhasil</h2><p>#{orderNo} · {paymentLabel(receipt.payment_method)}</p></div>
    <button type="button" className="ks-sheet-x" aria-label="Tutup" onClick={onClose}><X size={18}/></button>
   </header>
   <div className="ks-sheet-sum">
    <div><span>Total</span><b>{money(Number(receipt.total||0))}</b></div>
    <div><span>Kembalian</span><b>{money(Number(receipt.change_due||0))}</b></div>
   </div>
   <div className="ks-sheet-body">
    <div className="ks-paper" role="group" aria-label="Ukuran kertas thermal">
     {(['58','80'] as Paper[]).map(size=><button type="button" key={size} className={paper===size?'active':''} onClick={()=>setPaper(size)}>Kertas {size} mm</button>)}
    </div>
    <style>{receiptCss(paper)}</style>
    <div className={`premium-receipt thermal-${paper}`}>
     <div className="receipt-store-header">
      <div className="receipt-store-brand">{RECEIPT_STORE.name}</div>
      <div className="receipt-store-address">{RECEIPT_STORE.address}</div>
      {RECEIPT_STORE.phone&&<div className="receipt-store-contact">Tel. {RECEIPT_STORE.phone}</div>}
     </div>
     <div className="receipt-document-title">BUKTI PEMBAYARAN</div>
     <div className="receipt-transaction-info">
      <div className="receipt-info-row"><span>No. Transaksi</span><b>#{orderNo}</b></div>
      <div className="receipt-info-row"><span>Tanggal</span><b>{new Date(receipt.created_at||Date.now()).toLocaleString('id-ID',{dateStyle:'medium',timeStyle:'short'})}</b></div>
      <div className="receipt-info-row"><span>Pembayaran</span><b>{paymentLabel(receipt.payment_method)}</b></div>
     </div>
     <div className="receipt-items">
      <div className="receipt-items-head"><span>ITEM PESANAN</span><small>{items.reduce((sum,item)=>sum+Number(item.qty||0),0)} item</small></div>
      <div className="receipt-item-list">{items.map((item,index)=><div className="receipt-item" key={`${item.id}-${index}`}><div className="receipt-item-info"><b>{item.name}</b><small>{item.qty} × {money(Number(item.price||0))}</small></div><strong>{money(Number(item.price||0)*Number(item.qty||0))}</strong></div>)}</div>
     </div>
     <div className="receipt-totals">
      <div className="receipt-total-row"><span>Subtotal</span><b>{money(Number(receipt.subtotal??receipt.total??0))}</b></div>
      <div className="receipt-total-row"><span>Dibayar</span><b>{money(Number(receipt.amount_paid??receipt.total??0))}</b></div>
      <div className="receipt-total-row grand"><span>TOTAL</span><b>{money(Number(receipt.total||0))}</b></div>
     </div>
     <div className="receipt-payment-detail">
      <div className="receipt-info-row"><span>Kembalian</span><b>{money(receipt.change_due||0)}</b></div>
      <div className="receipt-info-row"><span>Status</span><b className="receipt-paid">BERHASIL</b></div>
     </div>
     <div className="receipt-footer"><b>Terima kasih</b><span>{RECEIPT_STORE.footer}</span><small>Simpan struk ini sebagai bukti transaksi.</small></div>
    </div>
   </div>
   <footer className="ks-sheet-foot">
    <button type="button" className="ks-btn ghost" onClick={onClose}>Pesanan baru</button>
    <button type="button" className="ks-btn solid" onClick={()=>printReceipt(paper,orderNo)}><Printer size={17}/> Cetak struk</button>
   </footer>
  </motion.div>
 </motion.div>
}
