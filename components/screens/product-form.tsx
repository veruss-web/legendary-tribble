'use client';

/** Tambah / ubah produk: halaman form penuh dengan pratinjau langsung (menggantikan modal lama). */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ChangeEvent, DragEvent, FormEvent } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, ArrowLeft, Check, ImagePlus, Loader2, Minus, Plus, Sparkles, Trash2 } from 'lucide-react';
import { friendlySupabaseError } from '@/lib/supabase';
import { compressImageFile } from '@/lib/product-images';
import { MAX_DESCRIPTION, MAX_MONEY_DIGITS, MAX_NAME, MAX_STOCK_DIGITS, digitsOnly, draftFromProduct, groupDigits, parseDraft } from '@/lib/products';
import type { ProductDraft, ProductErrors } from '@/lib/products';
import { LOW_STOCK } from '@/lib/inventory';
import { money } from '@/lib/format';
import type { Category, Product, ProductInput } from '@/lib/types';

const MAX_PHOTO_MB = 10;
/** Rupiah field: shows 12.500 while the draft keeps plain digits, and keeps the caret where the user is typing. */
function MoneyField({id,label,required,value,error,hint,onChange}:{id:string;label:string;required?:boolean;value:string;error?:string;hint?:string;onChange:(digits:string)=>void}){
 const ref=useRef<HTMLInputElement>(null);
 const digitsBeforeCaret=useRef<number|null>(null);
 const handle=(e:ChangeEvent<HTMLInputElement>)=>{
  const el=e.target;
  digitsBeforeCaret.current=el.value.slice(0,el.selectionStart??el.value.length).replace(/\D/g,'').length;
  onChange(digitsOnly(el.value,MAX_MONEY_DIGITS));
 };
 useLayoutEffect(()=>{
  const el=ref.current,want=digitsBeforeCaret.current;
  digitsBeforeCaret.current=null;
  if(!el||want===null||document.activeElement!==el)return;
  let pos=0,seen=0;
  while(pos<el.value.length&&seen<want){if(/\d/.test(el.value[pos]))seen++;pos++}
  el.setSelectionRange(pos,pos);
 });
 return <div className="pf-field">
  <label className="pf-label" htmlFor={id}>{label}{required&&<em>Wajib</em>}</label>
  <div className={`pf-input pf-money ${error?'has-error':''}`}><span className="pf-prefix">Rp</span><input ref={ref} id={id} inputMode="numeric" autoComplete="off" placeholder="0" value={groupDigits(value)} onChange={handle} aria-invalid={Boolean(error)} aria-describedby={`${id}-note`}/></div>
  <small id={`${id}-note`} className={error?'pf-error':'pf-hint'} role={error?'alert':undefined}>{error&&<AlertCircle size={12}/>}{error||hint||'\u00a0'}</small>
 </div>
}

export function ProductForm({product,categories,onCancel,onSubmit}:{product:Product|null;categories:Category[];onCancel:()=>void;onSubmit:(input:ProductInput)=>Promise<void>}){
 const editing=Boolean(product);
 const [draft,setDraft]=useState<ProductDraft>(()=>draftFromProduct(product));
 const [errors,setErrors]=useState<ProductErrors>({});
 const [formError,setFormError]=useState('');
 const [saving,setSaving]=useState(false);
 const [photoBusy,setPhotoBusy]=useState(false);
 const [photoError,setPhotoError]=useState('');
 const [dragging,setDragging]=useState(false);
 const fileInput=useRef<HTMLInputElement>(null);
 useEffect(()=>{window.scrollTo({top:0})},[]);

 const set=<K extends keyof ProductDraft>(key:K,value:ProductDraft[K])=>{
  setDraft(d=>({...d,[key]:value}));
  setErrors(e=>(key in e?{...e,[key]:undefined}:e));
 };
 const price=Number(draft.price||0),stock=Number(draft.stock||0);
 const category=categories.find(c=>c.id===draft.category_id)||null;
 const checklist:[string,boolean][]=[['Nama',draft.name.trim().length>=2],['Harga',draft.price!==''],['Foto',Boolean(draft.image_url)],['Kategori',Boolean(draft.category_id)]];
 const done=checklist.filter(([,ok])=>ok).length;
 const bumpStock=(delta:number)=>set('stock',String(Math.min(10**MAX_STOCK_DIGITS-1,Math.max(0,stock+delta))));

 const pickPhoto=async(file?:File|null)=>{
  if(!file)return;
  setPhotoError('');
  if(!file.type.startsWith('image/')){setPhotoError('Pilih file gambar (JPG, PNG, atau WEBP).');return}
  if(file.size>MAX_PHOTO_MB*1024*1024){setPhotoError(`Ukuran foto maksimal ${MAX_PHOTO_MB} MB.`);return}
  setPhotoBusy(true);
  try{set('image_url',await compressImageFile(file))}
  catch(err:any){setPhotoError(err?.message||'Foto gagal diproses.')}
  finally{setPhotoBusy(false)}
 };
 const onDrop=(e:DragEvent<HTMLDivElement>)=>{e.preventDefault();setDragging(false);pickPhoto(e.dataTransfer.files?.[0])};

 const submit=async(e:FormEvent)=>{
  e.preventDefault();
  if(saving||photoBusy)return;
  const {input,errors:found}=parseDraft(draft);
  setErrors(found);setFormError('');
  const firstInvalid=(['name','price','stock'] as const).find(k=>found[k]);
  if(firstInvalid){document.getElementById('pf-'+firstInvalid)?.focus();return}
  setSaving(true);
  try{await onSubmit(input)}
  catch(err:any){setFormError(friendlySupabaseError(err))}
  finally{setSaving(false)}
 };

 return <motion.form className="pf-page" onSubmit={submit} noValidate initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{duration:.28}}>
  <header className="pf-hero">
   <button type="button" className="pf-back" onClick={onCancel}><ArrowLeft size={15}/> Kembali</button>
   <div className="pf-hero-copy">
    <span className="pf-eyebrow"><Sparkles size={13}/> {editing?'Ubah produk':'Produk baru'}</span>
    <h2>{editing?'Ubah detail produk':'Tambah produk baru'}</h2>
    <p>{editing?'Perbarui nama, harga, stok, foto, atau status. Perubahan langsung tampil di Kasir.':'Lengkapi detail di bawah. Pratinjau di kanan menunjukkan tampilan produk di katalog.'}</p>
   </div>
   <div className="pf-progress" aria-label={`Kelengkapan data ${done} dari ${checklist.length}`}>
    <div className="pf-progress-top"><b>{done}<small>/{checklist.length}</small></b><span>kelengkapan</span></div>
    <div className="pf-progress-bar"><i style={{width:`${(done/checklist.length)*100}%`}}/></div>
    <ul>{checklist.map(([label,ok])=><li key={label} className={ok?'ok':''}><Check size={11}/>{label}</li>)}</ul>
   </div>
  </header>

  <div className="pf-grid">
   <div className="pf-main">
    <section className="pf-card">
     <div className="pf-card-head"><span className="pf-step">1</span><div><h3>Informasi dasar</h3><p>Nama dan deskripsi yang dilihat kasir dan pelanggan.</p></div></div>
     <div className="pf-field">
      <label className="pf-label" htmlFor="pf-name">Nama produk<em>Wajib</em></label>
      <div className={`pf-input ${errors.name?'has-error':''}`}><input id="pf-name" value={draft.name} maxLength={MAX_NAME} placeholder="Contoh: Mie Ayam Spesial" autoComplete="off" autoFocus={!editing&&typeof window!=='undefined'&&window.innerWidth>=900} onChange={e=>set('name',e.target.value)} aria-invalid={Boolean(errors.name)} aria-describedby="pf-name-note"/></div>
      <span className="pf-note-row"><small id="pf-name-note" className={errors.name?'pf-error':'pf-hint'} role={errors.name?'alert':undefined}>{errors.name&&<AlertCircle size={12}/>}{errors.name||'Gunakan nama yang mudah dicari di Kasir.'}</small><small className="pf-count">{draft.name.length}/{MAX_NAME}</small></span>
     </div>
     <div className="pf-field">
      <label className="pf-label" htmlFor="pf-description">Deskripsi<span className="pf-optional">Opsional</span></label>
      <div className="pf-input pf-area"><textarea id="pf-description" rows={3} maxLength={MAX_DESCRIPTION} value={draft.description} placeholder="Ceritakan singkat isi, rasa, atau ukuran porsinya." onChange={e=>set('description',e.target.value)}/></div>
      <span className="pf-note-row"><small className="pf-hint">&nbsp;</small><small className="pf-count">{draft.description.length}/{MAX_DESCRIPTION}</small></span>
     </div>
    </section>

    <section className="pf-card">
     <div className="pf-card-head"><span className="pf-step">2</span><div><h3>Harga &amp; stok</h3><p>Harga jual dalam Rupiah dan jumlah stok yang tersedia.</p></div></div>
     <div className="pf-two">
      <MoneyField id="pf-price" label="Harga jual" required value={draft.price} error={errors.price} hint="Harga yang dibayar pelanggan." onChange={v=>set('price',v)}/>
      <div className="pf-field">
       <label className="pf-label" htmlFor="pf-stock">{editing?'Stok saat ini':'Stok awal'}</label>
       <div className="pf-stock-row">
        <div className={`pf-stepper ${errors.stock?'has-error':''}`}>
         <button type="button" onClick={()=>bumpStock(-1)} disabled={stock<=0} aria-label="Kurangi stok"><Minus size={16}/></button>
         <input id="pf-stock" inputMode="numeric" autoComplete="off" value={draft.stock} aria-label="Jumlah stok" onChange={e=>set('stock',digitsOnly(e.target.value,MAX_STOCK_DIGITS)||'0')}/>
         <button type="button" onClick={()=>bumpStock(1)} aria-label="Tambah stok"><Plus size={16}/></button>
        </div>
        <div className="pf-quick">{[10,50,100].map(n=><button type="button" key={n} onClick={()=>bumpStock(n)}>+{n}</button>)}</div>
       </div>
       <small className={errors.stock?'pf-error':'pf-hint'} role={errors.stock?'alert':undefined}>{errors.stock?<><AlertCircle size={12}/>{errors.stock}</>:stock>0&&stock<LOW_STOCK?`Stok akan ditandai menipis (kurang dari ${LOW_STOCK} unit).`:editing?'Untuk penyesuaian harian gunakan menu Inventory agar riwayat stok tercatat.':'Jumlah unit yang tersedia saat produk dibuat.'}</small>
      </div>
     </div>
    </section>

    <section className="pf-card">
     <div className="pf-card-head"><span className="pf-step">3</span><div><h3>Kategori</h3><p>Mengelompokkan menu di Kasir dan laporan stok.</p></div></div>
     <div className="pf-cats" role="radiogroup" aria-label="Kategori produk">
      <button type="button" role="radio" aria-checked={!draft.category_id} className={!draft.category_id?'selected':''} onClick={()=>set('category_id','')}><i className="none"/>Tanpa kategori{!draft.category_id&&<Check size={14}/>}</button>
      {categories.map(c=><button type="button" role="radio" aria-checked={draft.category_id===c.id} key={c.id} className={draft.category_id===c.id?'selected':''} style={{['--c' as any]:c.color}} onClick={()=>set('category_id',c.id)}><i/>{c.name}{draft.category_id===c.id&&<Check size={14}/>}</button>)}
     </div>
     {!categories.length&&<p className="pf-hint pf-cats-empty">Belum ada kategori. Buat dulu lewat menu Kategori, lalu pilih di sini.</p>}
    </section>
   </div>

   <div className="pf-side">
    <section className="pf-card pf-photo">
     <div className="pf-card-head"><span className="pf-step ghost"><ImagePlus size={15}/></span><div><h3>Foto produk</h3><p>Rasio 4:3 tampil paling rapi.</p></div></div>
     <div className={`pf-drop ${draft.image_url?'has-image':''} ${dragging?'dragging':''}`} onDragOver={e=>{e.preventDefault();setDragging(true)}} onDragLeave={()=>setDragging(false)} onDrop={onDrop}>
      {draft.image_url?<>
       {/* eslint-disable-next-line @next/next/no-img-element */}
       <img src={draft.image_url} alt="Pratinjau foto produk"/>
       <div className="pf-drop-actions"><button type="button" onClick={()=>fileInput.current?.click()}><ImagePlus size={14}/> Ganti</button><button type="button" className="remove" onClick={()=>{set('image_url',null);setPhotoError('')}}><Trash2 size={14}/> Hapus</button></div>
      </>:<button type="button" className="pf-drop-empty" onClick={()=>fileInput.current?.click()} disabled={photoBusy}>
       <span className="pf-drop-icon">{photoBusy?<Loader2 size={22} className="pf-spin"/>:<ImagePlus size={22}/>}</span>
       <b>{photoBusy?'Memproses foto…':'Unggah foto produk'}</b>
       <small>Tarik &amp; lepas, atau klik untuk memilih. JPG, PNG, WEBP · maks. {MAX_PHOTO_MB} MB</small>
      </button>}
      <input ref={fileInput} type="file" accept="image/*" hidden onChange={e=>{pickPhoto(e.target.files?.[0]);e.currentTarget.value=''}}/>
     </div>
     {photoError&&<small className="pf-error" role="alert"><AlertCircle size={12}/>{photoError}</small>}
    </section>

    <section className="pf-card pf-preview-card">
     <div className="pf-card-head"><span className="pf-step ghost"><Sparkles size={15}/></span><div><h3>Pratinjau katalog</h3><p>Seperti inilah produk Anda tampil.</p></div></div>
     <article className="pf-preview">
      <div className="pf-preview-media">
       {/* eslint-disable-next-line @next/next/no-img-element */}
       {draft.image_url?<img src={draft.image_url} alt=""/>:<span>🍜</span>}
       <em>{category?.name||'Menu'}</em><b className={draft.is_active?'on':'off'}>{draft.is_active?'Aktif':'Nonaktif'}</b>
      </div>
      <div className="pf-preview-body">
       <h4>{draft.name.trim()||'Nama produk'}</h4>
       <p>{draft.description.trim()||'Deskripsi singkat akan tampil di sini.'}</p>
       <div className="pf-preview-foot"><strong>{money(price)}</strong><span className={stock<LOW_STOCK?'low':''}>{stock} stok</span></div>
      </div>
     </article>
    </section>

    <section className="pf-card pf-status">
     <div><b>Produk aktif</b><small>{draft.is_active?'Tampil dan bisa dijual di Kasir.':'Disembunyikan dari Kasir.'}</small></div>
     <button type="button" role="switch" aria-checked={draft.is_active} aria-label="Status produk" className={`pf-switch ${draft.is_active?'on':''}`} onClick={()=>set('is_active',!draft.is_active)}><i/></button>
    </section>
   </div>
  </div>

  <footer className="pf-actions">
   {formError&&<div className="pf-form-error" role="alert"><AlertCircle size={16}/><span>{formError}</span></div>}
   <div className="pf-actions-row">
    <span className="pf-actions-note">{done===checklist.length?'Semua data utama sudah lengkap.':`${checklist.length-done} data utama belum terisi (opsional).`}</span>
    <button type="button" className="pf-btn ghost" onClick={onCancel} disabled={saving}>Batal</button>
    <button type="submit" className="pf-btn solid" disabled={saving||photoBusy}>{saving?<Loader2 size={17} className="pf-spin"/>:<Check size={17}/>}{saving?'Menyimpan…':editing?'Simpan perubahan':'Simpan produk'}</button>
   </div>
  </footer>
 </motion.form>
}
