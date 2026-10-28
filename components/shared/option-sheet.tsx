'use client';

/** Bottom sheet with a single-choice list (period, payment method, status…). Used by Riwayat Transaksi. */
import { useId } from 'react';
import { motion } from 'framer-motion';
import { Check, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type SheetOption = [value: string, title: string, description: string];

export function OptionSheet({eyebrow,title,description,options,value,icon:Icon,onSelect,onClose}:{eyebrow:string;title:string;description:string;options:SheetOption[];value:string;icon:LucideIcon;onSelect:(value:string)=>void;onClose:()=>void}){
 const titleId=useId();
 return <motion.div className="orders-period-overlay" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={onClose}>
  <motion.div className="orders-period-sheet" role="dialog" aria-modal="true" aria-labelledby={titleId} initial={{opacity:0,y:24,scale:.985}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:18,scale:.99}} transition={{duration:.22,ease:'easeOut'}} onClick={e=>e.stopPropagation()}>
   <div className="orders-period-handle" aria-hidden="true"/>
   <div className="orders-period-head"><div><span className="eyebrow">{eyebrow}</span><h3 id={titleId}>{title}</h3><p>{description}</p></div><button type="button" className="orders-period-close" onClick={onClose} aria-label="Tutup"><X size={18}/></button></div>
   <div className="orders-period-options">{options.map(([optionValue,optionTitle,optionDescription])=>{
    const active=value===optionValue;
    return <button type="button" key={optionValue} className={`orders-period-option ${active?'active':''}`} onClick={()=>onSelect(optionValue)}><span className="orders-period-option-icon"><Icon size={18}/></span><span className="orders-period-option-copy"><b>{optionTitle}</b><small>{optionDescription}</small></span><span className="orders-period-check">{active&&<Check size={16}/>}</span></button>;
   })}</div>
   <div className="orders-period-footer"><button type="button" onClick={onClose}>Selesai</button></div>
  </motion.div>
 </motion.div>;
}
