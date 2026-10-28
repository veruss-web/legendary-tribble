/** Product photo upload to the Supabase Storage bucket `product-images` (scoped to the signed-in user). */
import { ensureFreshSession, runWithAuthRetry, supabase } from '@/lib/supabase';

export async function uploadImageDataUrl(dataUrl:string){
 const response=await fetch(dataUrl);
 const blob=await response.blob();
 const userId=(await ensureFreshSession())?.user.id;
 if(!userId) throw new Error('Sesi login tidak ditemukan.');
 const path=`${userId}/products/${crypto.randomUUID()}.webp`;
 const result=await runWithAuthRetry(()=>supabase.storage.from('product-images').upload(path,blob,{contentType:'image/webp',upsert:false,cacheControl:'3600'}));
 if(result.error) throw result.error;
 const publicUrl=supabase.storage.from('product-images').getPublicUrl(path).data.publicUrl;
 if(!publicUrl) throw new Error('URL foto tidak tersedia.');
 return publicUrl;
}

/** Reads a picked photo, scales it to at most 900 px on the long side and returns a WebP data URL.
 *  The photo stays local (preview only) until the product is saved; `Dashboard.saveProduct` then uploads it with `uploadImageDataUrl`,
 *  so cancelling the form never leaves orphan files in the bucket. */
export function compressImageFile(file:File){
 return new Promise<string>((resolve,reject)=>{
  const reader=new FileReader();
  reader.onerror=()=>reject(new Error('Foto tidak bisa dibaca.'));
  reader.onload=()=>{
   const img=new Image();
   img.onerror=()=>reject(new Error('Format foto tidak didukung.'));
   img.onload=()=>{
    const scale=Math.min(1,900/Math.max(img.width,img.height));
    const canvas=document.createElement('canvas');
    canvas.width=Math.max(1,Math.round(img.width*scale));canvas.height=Math.max(1,Math.round(img.height*scale));
    const ctx=canvas.getContext('2d');
    if(!ctx)return reject(new Error('Browser tidak mendukung pemrosesan foto.'));
    ctx.drawImage(img,0,0,canvas.width,canvas.height);
    resolve(canvas.toDataURL('image/webp',0.78));
   };
   img.src=String(reader.result);
  };
  reader.readAsDataURL(file);
 });
}
