/** Customer order-target parsing and fulfilment tracking (pure functions, covered by tests). */
import type { Customer, CustomerTarget, Order, OrderItem, Product } from '@/lib/types';

export const normalizeProductName=(value:string)=>{
 const numberWords:Record<string,string>={
  nol:'0',satu:'1',dua:'2',tiga:'3',empat:'4',lima:'5',enam:'6',tujuh:'7',delapan:'8',sembilan:'9',sepuluh:'10',
  sebelas:'11',duabelas:'12',tigabelas:'13',empatbelas:'14',limabelas:'15',enambelas:'16',tujuhbelas:'17',delapanbelas:'18',sembilanbelas:'19',
  'dua puluh':'20','tiga puluh':'30','empat puluh':'40','lima puluh':'50','enam puluh':'60','tujuh puluh':'70','delapan puluh':'80','sembilan puluh':'90'
 };
 let text=String(value||'').toLowerCase().replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim();
 // Samakan penulisan angka Indonesia agar "level tiga" dan "level 3" dianggap produk yang sama.
 Object.entries(numberWords).sort((a,b)=>b[0].length-a[0].length).forEach(([word,digit])=>{
  text=text.replace(new RegExp(`\\b${word.replace(/ /g,'\\s+')}\\b`,'g'),digit);
 });
 return text.replace(/\s+/g,' ').trim();
};

export const parseCustomerTargets=(customer:Customer):CustomerTarget[]=>{
 const text=String(customer.notes||'').replace(/\r/g,'').trim();
 if(!text)return [];
 const lines=text.split(/\n|[,;]+/).map(x=>x.trim()).filter(Boolean);
 const out:CustomerTarget[]=[];
 const add=(name:string,qty:number)=>{
  const clean=name.replace(/^(pesan|pesanan|target|order)\s*/i,'').trim();
  if(!clean||!qty)return;
  const key=normalizeProductName(clean);
  const existing=out.find(x=>normalizeProductName(x.name)===key);
  if(existing)existing.qty+=qty; else out.push({name:clean,qty});
 };
 lines.forEach(line=>{
  // Ambil ANGKA TERAKHIR sebagai jumlah pesanan. Angka yang berada
  // di dalam nama produk tetap menjadi bagian dari nama, misalnya:
  // "Mie Level 3 10" => nama "Mie Level 3", qty 10.
  const cleanLine=line.replace(/^(pesan|pesanan|target|order)\s*/i,'').trim();
  const finalQty=cleanLine.match(/^(.+?)\s+(?:x\s*)?(\d+)\s*(?:mie|porsi|pcs|buah|item)?$/i);
  if(finalQty){
   add(finalQty[1].trim(),Number(finalQty[2]));
   return;
  }
  // Bentuk alternatif: "Mie Level 3 x 10".
  const xQty=cleanLine.match(/^(.+?)\s+x\s*(\d+)\s*$/i);
  if(xQty){
   add(xQty[1].trim(),Number(xQty[2]));
   return;
  }
  // Jika tidak ada jumlah di akhir, jangan menebak angka dari tengah nama produk.
 });
 return out;
};

export const getCustomerFulfillment=(customerId:string,targets:CustomerTarget[],orders:Order[],orderItems:OrderItem[],products:Product[]=[] )=>{
 const completedItems=orders.filter(o=>o.customer_id===customerId&&o.status==='completed').flatMap(o=>orderItems.filter(i=>i.order_id===o.id));
 return targets.map(target=>{
  const wanted=normalizeProductName(target.name);
  // Target pelanggan boleh dibuat SEBELUM menu dibuat.
  // Setelah menu tersedia, pencocokan WAJIB memakai product_id agar transaksi
  // tidak pernah masuk ke produk lain yang hanya memiliki nama mirip.
  const product=products.find(p=>normalizeProductName(p.name)===wanted);
  const fulfilled=completedItems.filter(i=>{
   if(product) return i.product_id===product.id;
   // Belum ada menu: hanya dukung transaksi lama yang memang menyimpan nama
   // produk persis. Ini tidak boleh dipakai untuk mencocokkan nama yang mirip.
   return !i.product_id && normalizeProductName(i.product_name)===wanted;
  }).reduce((sum,i)=>sum+Number(i.quantity||0),0);
  return {...target,name:product?.name||target.name,fulfilled:Math.min(fulfilled,target.qty),productExists:!!product,productId:product?.id||null};
 });
};

export const isCustomerOrderComplete=(customer:Customer,orders:Order[],orderItems:OrderItem[],products:Product[]=[] )=>{
 const targets=parseCustomerTargets(customer);
 if(!targets.length)return orders.some(o=>o.customer_id===customer.id&&o.status==='completed');
 return getCustomerFulfillment(customer.id,targets,orders,orderItems,products).every(x=>x.fulfilled>=x.qty);
};

/**
 * Menu picker support for the customer form.
 * The order target of a customer is stored as plain text in `notes` (one "Nama menu 20" per line), because that is what
 * parseCustomerTargets() reads. These two helpers convert between a {productId: qty} selection and that text.
 */
export type MenuPicks=Record<string,number>;

/** Split saved notes into menu selections (lines that match an existing product) and the remaining free text. */
export const splitNotesIntoMenu=(notes:string|null|undefined,products:Pick<Product,'id'|'name'>[]):{picks:MenuPicks;extra:string}=>{
 const picks:MenuPicks={};
 const extra:string[]=[];
 String(notes||'').replace(/\r/g,'').split('\n').forEach(line=>{
  const trimmed=line.trim();
  if(!trimmed)return;
  trimmed.split(/[,;]+/).map(x=>x.trim()).filter(Boolean).forEach(segment=>{
   const target=parseCustomerTargets({id:'',name:'',phone:null,email:null,notes:segment})[0];
   const product=target&&products.find(p=>normalizeProductName(p.name)===normalizeProductName(target.name));
   if(target&&product)picks[product.id]=(picks[product.id]||0)+target.qty;
   else extra.push(segment);
  });
 });
 return {picks,extra:extra.join('\n')};
};

/** Build the notes text again: menu lines first, then the free text. Commas are removed from names so they cannot split a line. */
export const composeNotesFromMenu=(picks:MenuPicks,products:Pick<Product,'id'|'name'>[],extra:string):string=>{
 const lines=products.filter(p=>(picks[p.id]||0)>0).map(p=>`${p.name.replace(/[,;]+/g,' ').replace(/\s+/g,' ').trim()} ${Math.floor(picks[p.id])}`);
 const free=String(extra||'').replace(/\r/g,'').split('\n').map(x=>x.trimEnd()).filter(x=>x.trim());
 return [...lines,...free].join('\n');
};
