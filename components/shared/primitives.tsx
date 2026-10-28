'use client';

/** Small presentational building blocks shared by several screens. */
import { motion } from 'framer-motion';
import { Edit3, Package, Trash2 } from 'lucide-react';

export function Kpi({label,value,detail,icon:Icon,tone='violet'}:any){return <motion.div className={`kpi analytics-kpi-card ${tone}`} whileHover={{y:-4,scale:1.01}} transition={{type:'spring',stiffness:280,damping:20}}><div className="kpi-top"><span>{label}</span><i><Icon size={18}/></i></div><strong>{value}</strong><small>{detail}</small></motion.div>}

export function Actions({onEdit,onDelete}:any){return <div className="actions"><button type="button" aria-label="Ubah" title="Ubah" onClick={onEdit}><Edit3 size={15}/></button><button type="button" aria-label="Hapus" title="Hapus" onClick={onDelete}><Trash2 size={15}/></button></div>}

export function Empty({text}:{text:string}){return <div className="empty"><Package size={22}/><b>{text}</b></div>}

export function Field({label,value,onChange,type='text',required=false,placeholder=''}:any){return <label>{label}<input required={required} type={type} value={value??''} placeholder={placeholder} onChange={e=>onChange(e.target.value)}/></label>}
