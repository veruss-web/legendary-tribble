'use client';

/** Application shell: data loading, realtime sync, CRUD handlers, notifications, sidebar and top bar. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, Check, CheckCircle2, ChevronDown, ChevronRight, LogOut, Maximize2, Menu, Minimize2, Moon, Plus, Search, Settings, Sun, X } from 'lucide-react';
import { Settings as SettingsScreen } from '@/components/screens/settings';
import { RECEIPT_STORE } from '@/lib/store';
import { applyTheme, readStoredTheme, resolveTheme, storeTheme, systemPrefersDark, type ThemeMode } from '@/lib/theme';
import { ensureFreshSession, friendlySupabaseError, runWithAuthRetry, supabase } from '@/lib/supabase';
import { GlobalSearchResults } from '@/components/dashboard/global-search';
import { Analytics } from '@/components/screens/analytics';
import { Categories } from '@/components/screens/categories';
import { Customers } from '@/components/screens/customers';
import { Inventory } from '@/components/screens/inventory';
import { OrderDetailModal, Orders } from '@/components/screens/orders';
import { Overview } from '@/components/screens/overview';
import { POS } from '@/components/screens/pos';
import { ProductForm } from '@/components/screens/product-form';
import { Products } from '@/components/screens/products';
import { DeleteConfirmDialog, Modal } from '@/components/shared/modal';
import type { ModalType } from '@/components/shared/modal';
import { isCustomerOrderComplete } from '@/lib/customers';
import { money } from '@/lib/format';
import { levelOf } from '@/lib/inventory';
import { nav, pageDescription, pageTitle } from '@/lib/navigation';
import { uploadImageDataUrl } from '@/lib/product-images';
import type { AppNotification, CartItem, Category, Customer, Order, OrderItem, Page, Product, ProductInput, Receipt } from '@/lib/types';

type NotificationFilter = 'all' | 'unread' | 'transactions' | 'stock' | 'activity';
/** Icon glyph of a notification bubble. */
const noticeGlyph = (type?: string) => (type === 'success' ? '✓' : type === 'danger' || type === 'warning' ? '!' : 'i');

export function Dashboard({session}:{session:Session}){
 const [page,setPage]=useState<Page>('Overview'),[theme,setTheme]=useState<ThemeMode>(()=>typeof window==='undefined'?'light':readStoredTheme()),[systemDark,setSystemDark]=useState(()=>typeof window==='undefined'?false:systemPrefersDark()),[mobile,setMobile]=useState(false),[products,setProducts]=useState<Product[]>([]),[categories,setCategories]=useState<Category[]>([]),[customers,setCustomers]=useState<Customer[]>([]),[orders,setOrders]=useState<Order[]>([]),[orderItems,setOrderItems]=useState<OrderItem[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[toast,setToast]=useState(''),[modal,setModal]=useState<ModalType|null>(null),[editing,setEditing]=useState<Category|Customer|null>(null),[productForm,setProductForm]=useState<{product:Product|null}|null>(null),[cart,setCart]=useState<CartItem[]>([]),[query,setQuery]=useState(''),[notificationsOpen,setNotificationsOpen]=useState(false),[notificationFilter,setNotificationFilter]=useState<NotificationFilter>('all'),[activityNotifications,setActivityNotifications]=useState<AppNotification[]>([]),[readNotificationIds,setReadNotificationIds]=useState<string[]>([]),[notificationFlash,setNotificationFlash]=useState<any>(null),[isFullscreen,setIsFullscreen]=useState(false),[selectedOrder,setSelectedOrder]=useState<Order|null>(null),[selectedNotification,setSelectedNotification]=useState<any>(null),[deleteConfirm,setDeleteConfirm]=useState<any>(null);
 // Kanal realtime membaca pelanggan lewat ref supaya tidak berhenti-langganan/berlangganan ulang setiap daftar pelanggan berubah.
 const customersRef=useRef(customers);
 customersRef.current=customers;
 useEffect(()=>{
  if(typeof document==='undefined') return;
  document.body.style.overflow=mobile?'hidden':'';
  return()=>{document.body.style.overflow='';};
 },[mobile]);

 const load=async()=>{
  setLoading(true); setError('');
  try {
   const sessionNow=await ensureFreshSession();
   if(!sessionNow){setError('Sesi login tidak ditemukan. Silakan masuk kembali.');return;}

   // Produk adalah data inti. Modul lain tidak boleh membuat halaman Products ikut mati.
   const productsResult=await runWithAuthRetry(()=>supabase.from('products').select('*').eq('owner_id',sessionNow.user.id).order('created_at',{ascending:false}));
   if(productsResult.error) throw productsResult.error;
   setProducts((productsResult.data||[]) as Product[]);

   // Data pendukung dimuat terpisah dan boleh kosong jika modulnya belum dibuat.
   const [categoriesResult,customersResult,ordersResult,orderItemsResult]=await Promise.all([
    runWithAuthRetry(()=>supabase.from('categories').select('*').eq('owner_id',sessionNow.user.id).order('name')),
    runWithAuthRetry(()=>supabase.from('customers').select('*').eq('owner_id',sessionNow.user.id).order('created_at',{ascending:false})),
    runWithAuthRetry(()=>supabase.from('orders').select('*').eq('owner_id',sessionNow.user.id).order('created_at',{ascending:false}).limit(1000)),
    runWithAuthRetry(()=>supabase.from('order_items').select('*').eq('owner_id',sessionNow.user.id).limit(5000))
   ]);
   const categoryRows=(categoriesResult.data||[]) as Category[];
   const customerRows=(customersResult.data||[]) as Customer[];
   const orderRows=(ordersResult.data||[]) as Order[];
   const orderItemRows=(orderItemsResult.data||[]) as OrderItem[];
   setCategories(categoryRows);
   setCustomers(customerRows);
   const categoryMap=new Map(categoryRows.map(x=>[x.id,x]));
   const customerMap=new Map(customerRows.map(x=>[x.id,x]));
   setProducts(current=>current.map(x=>({...x,categories:x.category_id?categoryMap.get(x.category_id)||null:null})));
   setOrders(orderRows.map(x=>({...x,customers:x.customer_id?customerMap.get(x.customer_id)||null:null})));
   setOrderItems(orderItemRows);

   const optionalErrors=[categoriesResult.error,customersResult.error,ordersResult.error,orderItemsResult.error].filter(Boolean);
   if(optionalErrors.length){
    // Products tetap usable; modul pendukung yang belum siap tidak memblokir CRUD produk.
    console.warn('Mieflow optional modules:', optionalErrors);
   }
  } catch(err:any){setError(friendlySupabaseError(err));}
  finally{setLoading(false);}
 };
 useEffect(()=>{
  const loadNotifications=async()=>{
   try{
    const result=await runWithAuthRetry(()=>supabase.from('notifications').select('*').eq('owner_id',session.user.id).order('created_at',{ascending:false}).limit(100));
    if(result.error){console.warn('Notifications belum tersedia di database:',result.error.message);setActivityNotifications([]);setReadNotificationIds([]);return;}
    const rows=(result.data||[]).map((n:any)=>({id:n.id,type:n.type,title:n.title,detail:n.detail,time:n.created_at?new Date(n.created_at).toLocaleString('id-ID'):'Baru saja',page:n.page as Page,targetId:n.target_id,is_read:n.is_read,created_at:n.created_at}));
    setActivityNotifications(rows);
    setReadNotificationIds(rows.filter((n:any)=>n.is_read).map((n:any)=>n.id));
   }catch(err){console.warn('Gagal memuat notifikasi',err);}
  };
  loadNotifications();
 },[session.user.id]);
 useEffect(()=>{load()},[]);
 useEffect(()=>{
  if(!session?.user?.id) return;
  let active=true;
  const channel=supabase.channel(`mieflow-live-${session.user.id}`)
   .on('postgres_changes',{event:'*',schema:'public',table:'orders',filter:`owner_id=eq.${session.user.id}`},payload=>{
    if(!active)return;
    const row=payload.new as Order;
    if(payload.eventType==='INSERT'||payload.eventType==='UPDATE'){
      const customerRow=row.customer_id?customersRef.current.find(c=>c.id===row.customer_id)||null:null;
      setOrders(prev=>{
        const next={...row,customers:customerRow};
        const exists=prev.some(o=>o.id===row.id);
        return exists?prev.map(o=>o.id===row.id?{...o,...next}:o):[next,...prev];
      });
    }else if(payload.eventType==='DELETE'){
      setOrders(prev=>prev.filter(o=>o.id!==payload.old?.id));
      setOrderItems(prev=>prev.filter(i=>i.order_id!==payload.old?.id));
    }
   })
   .on('postgres_changes',{event:'*',schema:'public',table:'order_items',filter:`owner_id=eq.${session.user.id}`},payload=>{
    if(!active)return;
    const row=payload.new as OrderItem;
    if(payload.eventType==='INSERT'){
      setOrderItems(prev=>prev.some(i=>i.id===row.id)?prev:[...prev,row]);
    }else if(payload.eventType==='UPDATE'){
      setOrderItems(prev=>prev.map(i=>i.id===row.id?{...i,...row}:i));
    }else if(payload.eventType==='DELETE'){
      setOrderItems(prev=>prev.filter(i=>i.id!==payload.old?.id));
    }
   })
   .subscribe(status=>{ if(status==='CHANNEL_ERROR'||status==='TIMED_OUT') console.warn('Realtime pelanggan tidak tersedia:',status); });
  return()=>{active=false;supabase.removeChannel(channel);};
 },[session?.user?.id]);
 // Tema: terang / gelap / otomatis (ikut sistem). Pilihan disimpan di perangkat ini; skrip di <head> menerapkannya sebelum render pertama.
 const resolvedTheme=resolveTheme(theme,systemDark);
 useEffect(()=>{
  const query=window.matchMedia('(prefers-color-scheme: dark)');
  const onChange=(e:MediaQueryListEvent)=>setSystemDark(e.matches);
  query.addEventListener('change',onChange);
  return()=>query.removeEventListener('change',onChange);
 },[]);
 useEffect(()=>{applyTheme(resolvedTheme)},[resolvedTheme]);
 const changeTheme=(mode:ThemeMode)=>{setTheme(mode);storeTheme(mode)};
 const toggleTheme=()=>changeTheme(resolvedTheme==='dark'?'light':'dark');
 // Katalog (produk + kategori) selalu mengikuti database: produk baru dari Produk/Kasir, perangkat lain, atau tab lain
 // langsung tersedia di pilihan menu form pelanggan. Dibaca ulang (bukan ditambal dari payload) agar hapus/nonaktif ikut benar.
 const refreshCatalog=useCallback(async()=>{
  const uid=session?.user?.id;
  if(!uid)return;
  try{
   const [productsResult,categoriesResult]=await Promise.all([
    runWithAuthRetry(()=>supabase.from('products').select('*').eq('owner_id',uid).order('created_at',{ascending:false})),
    runWithAuthRetry(()=>supabase.from('categories').select('*').eq('owner_id',uid).order('name')),
   ]);
   if(productsResult.error||categoriesResult.error)return;
   const categoryRows=(categoriesResult.data||[]) as Category[];
   const categoryMap=new Map(categoryRows.map(x=>[x.id,x]));
   setCategories(categoryRows);
   setProducts(((productsResult.data||[]) as Product[]).map(x=>({...x,categories:x.category_id?categoryMap.get(x.category_id)||null:null})));
  }catch(err){console.warn('Katalog gagal disegarkan:',err)}
 },[session?.user?.id]);
 useEffect(()=>{
  const uid=session?.user?.id;
  if(!uid||typeof document==='undefined')return;
  let active=true;
  let timer:ReturnType<typeof setTimeout>|undefined;
  const schedule=()=>{if(timer)clearTimeout(timer);timer=setTimeout(()=>{if(active)refreshCatalog()},300)};
  const onVisible=()=>{if(document.visibilityState==='visible')schedule()};
  const channel=supabase.channel(`mieflow-catalog-${uid}`)
   .on('postgres_changes',{event:'*',schema:'public',table:'products',filter:`owner_id=eq.${uid}`},schedule)
   .on('postgres_changes',{event:'*',schema:'public',table:'categories',filter:`owner_id=eq.${uid}`},schedule)
   .subscribe(status=>{if(status==='CHANNEL_ERROR'||status==='TIMED_OUT')console.warn('Realtime katalog tidak tersedia, memakai refresh saat tab aktif:',status)});
  window.addEventListener('focus',schedule);
  document.addEventListener('visibilitychange',onVisible);
  return()=>{active=false;if(timer)clearTimeout(timer);window.removeEventListener('focus',schedule);document.removeEventListener('visibilitychange',onVisible);supabase.removeChannel(channel)};
 },[session?.user?.id,refreshCatalog]);
 // Menu terbaru dijamin tampil saat form pelanggan dibuka, walau realtime belum diaktifkan di Supabase.
 useEffect(()=>{if(modal==='customer')refreshCatalog()},[modal,refreshCatalog]);
 useEffect(()=>{if(typeof document==='undefined')return;const sync=()=>setIsFullscreen(Boolean(document.fullscreenElement));document.addEventListener('fullscreenchange',sync);return()=>document.removeEventListener('fullscreenchange',sync)},[]);useEffect(()=>{if(toast){const t=setTimeout(()=>setToast(''),2500);return()=>clearTimeout(t)}},[toast]);useEffect(()=>{if(!notificationFlash)return;const t=setTimeout(()=>setNotificationFlash(null),4500);return()=>clearTimeout(t)},[notificationFlash]);
 const notifications=useMemo(()=>{
   const items:AppNotification[]=[];
   items.push(...activityNotifications.map(n=>({...n,targetId:n.targetId||n.id?.replace(/^order-/,'')})));
   products.filter(p=>levelOf(p.stock)==='out').slice(0,4).forEach(p=>items.push({id:`out-${p.id}`,targetId:p.id,type:'danger',title:'Stok habis',detail:`${p.name} sudah tidak tersedia.`,time:'Perlu tindakan',page:'Inventory'}));
   products.filter(p=>levelOf(p.stock)==='low').slice(0,4).forEach(p=>items.push({id:`low-${p.id}`,targetId:p.id,type:'warning',title:'Stok menipis',detail:`${p.name} tersisa ${p.stock} unit.`,time:'Perlu perhatian',page:'Inventory'}));
   orders.filter(o=>o.status==='completed').slice(0,5).forEach(o=>items.push({id:`order-${o.id}`,targetId:o.id,type:'success',title:'Pembayaran berhasil',detail:`#${o.order_number} • ${money(Number(o.total))}`,time:new Date(o.created_at).toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'}),page:'Orders'}));
   const seen=new Set<string>();
   return items.filter(x=>{if(seen.has(x.id))return false;seen.add(x.id);return true}).sort((a,b)=>String(b.time).localeCompare(String(a.time))).slice(0,15);
 },[products,orders,activityNotifications]);
 const unreadNotifications=notifications.filter(n=>!readNotificationIds.includes(n.id)).length;
 const pushNotification=async(n:any)=>{const draft={type:n.type||'info',title:n.title,detail:n.detail,time:n.time||'Baru saja',page:n.page,targetId:n.targetId||null};setNotificationFlash(draft);setNotificationsOpen(false);try{const r=await runWithAuthRetry(()=>supabase.from('notifications').insert({owner_id:session.user.id,type:draft.type,title:draft.title,detail:draft.detail,page:draft.page,target_id:draft.targetId,is_read:false}).select('*').single());if(r.error)throw r.error;const row=r.data;const item={...draft,id:row.id,is_read:false,created_at:row.created_at,time:new Date(row.created_at).toLocaleString('id-ID')};setActivityNotifications(prev=>[item,...prev].slice(0,100));}catch(err){console.warn('Notifikasi tidak tersimpan ke database:',err);}};
 const markNotificationsRead=async()=>{const ids=notifications.map(n=>n.id);setReadNotificationIds(ids);const customIds=activityNotifications.filter(n=>!n.is_read).map(n=>n.id);if(customIds.length){const r=await runWithAuthRetry(()=>supabase.from('notifications').update({is_read:true}).in('id',customIds).eq('owner_id',session.user.id));if(r.error)console.warn(r.error);setActivityNotifications(prev=>prev.map(n=>({...n,is_read:true})));}};
 /** Id of the signed-in user after making sure the session is fresh. Every write below starts here. */
 const requireUserId=async()=>{
  const sessionNow=await ensureFreshSession();
  if(!sessionNow)throw new Error('Sesi login sudah berakhir. Silakan login kembali.');
  return sessionNow.user.id;
 };
 const remove=(table:string,id:string)=>{
   const label=table==='products'?'produk':table==='categories'?'kategori':'pelanggan';
   const item=table==='products'?products.find(x=>x.id===id):table==='customers'?customers.find(x=>x.id===id):categories.find(x=>x.id===id);
   setDeleteConfirm({table,id,label,name:item?.name||label});
 };
 const confirmRemove=async()=>{
   if(!deleteConfirm)return;
   const {table,id,label,name}=deleteConfirm;
   setDeleteConfirm(null);
   try{
    const uid=await requireUserId();
    const res=await runWithAuthRetry(()=>supabase.from(table).delete().eq('id',id).eq('owner_id',uid));
    if(res.error)throw res.error;
    // Database memakai ON DELETE SET NULL; state lokal harus mengikuti agar tidak ada label/tab usang sampai refresh.
    if(table==='products'){
     setProducts(items=>items.filter(x=>x.id!==id));
     setOrderItems(items=>items.map(x=>x.product_id===id?{...x,product_id:null}:x));
    }
    if(table==='categories'){
     setCategories(items=>items.filter(x=>x.id!==id));
     setProducts(items=>items.map(x=>x.category_id===id?{...x,category_id:null,categories:null}:x));
    }
    if(table==='customers'){
     setCustomers(items=>items.filter(x=>x.id!==id));
     setOrders(items=>items.map(x=>x.customer_id===id?{...x,customer_id:null,customers:null}:x));
    }
    pushNotification({type:'danger',title:`${label[0].toUpperCase()+label.slice(1)} dihapus`,detail:`${name} berhasil dihapus dari data Mieflow.`,time:'Baru saja',page:table==='products'?'Products':table==='categories'?'Categories':'Customers'});
    setToast(`${label[0].toUpperCase()+label.slice(1)} berhasil dihapus`);
   }catch(err:any){setError(friendlySupabaseError(err))}
 };

 // Setiap save* melempar error bila gagal; pemanggilnya (form produk / modal) yang menampilkannya.
 const saveProduct=async(input:ProductInput)=>{
  const uid=await requireUserId();
  const editingProduct=productForm?.product||null;
  let imageUrl=input.image_url,imageWarning='';
  // Foto masih berupa preview lokal sampai di sini: diunggah saat Simpan, jadi membatalkan form tidak meninggalkan file di bucket.
  if(imageUrl?.startsWith('data:image/')){
   try{imageUrl=await uploadImageDataUrl(imageUrl)}
   catch(uploadErr){imageWarning=' Produk tetap disimpan tanpa foto karena Storage belum siap.';imageUrl=null;console.warn(uploadErr)}
  }
  const payload={...input,description:input.description||null,image_url:imageUrl,owner_id:uid};
  const res=await runWithAuthRetry(()=>editingProduct
   ?supabase.from('products').update(payload).eq('id',editingProduct.id).eq('owner_id',uid).select('*').single()
   :supabase.from('products').insert(payload).select('*').single());
  if(res.error)throw res.error;
  const saved=res.data as Product;
  // Sertakan relasi kategori di state lokal: Kasir membentuk filter kategori dari p.categories, jadi produk baru langsung muncul tanpa refresh.
  const normalized:Product={...saved,categories:saved.category_id?categories.find(c=>c.id===saved.category_id)||null:null};
  setProducts(items=>editingProduct?items.map(x=>x.id===saved.id?normalized:x):[normalized,...items]);
  if(!editingProduct)pushNotification({type:'info',title:'Produk ditambahkan',detail:`${saved.name} berhasil ditambahkan ke katalog.`,time:'Baru saja',page:'Products'});
  setToast((editingProduct?'Perubahan produk disimpan':'Produk berhasil ditambahkan')+imageWarning);
  setProductForm(null);
 };
 const saveCategory=async(form:{name:string;color:string})=>{
  const name=String(form.name||'').trim();
  if(!name)throw new Error('Nama kategori wajib diisi.');
  const uid=await requireUserId();
  const editingCategory=editing as Category|null;
  const payload={name,color:String(form.color||'#111827'),owner_id:uid};
  const res=await runWithAuthRetry(()=>editingCategory
   ?supabase.from('categories').update(payload).eq('id',editingCategory.id).eq('owner_id',uid).select().single()
   :supabase.from('categories').insert(payload).select().single());
  if(res.error)throw res.error;
  const saved=res.data as Category;
  setCategories(items=>(editingCategory?items.map(x=>x.id===saved.id?saved:x):[...items,saved]).sort((a,b)=>a.name.localeCompare(b.name)));
  // Produk membawa salinan kategorinya (p.categories): perbarui agar nama/warna baru langsung tampil tanpa memuat ulang semua data.
  setProducts(items=>items.map(x=>x.category_id===saved.id?{...x,categories:saved}:x));
  if(!editingCategory)pushNotification({type:'info',title:'Kategori ditambahkan',detail:`${saved.name} berhasil ditambahkan ke kategori.`,time:'Baru saja',page:'Categories'});
  setToast(editingCategory?'Perubahan kategori disimpan':'Kategori berhasil ditambahkan');
 };
 const saveCustomer=async(form:{name:string;phone:string;email:string;notes:string})=>{
  const name=String(form.name||'').trim();
  if(!name)throw new Error('Nama pelanggan wajib diisi.');
  const uid=await requireUserId();
  const editingCustomer=editing as Customer|null;
  const payload={name,phone:form.phone,email:form.email,notes:form.notes,owner_id:uid};
  const res=await runWithAuthRetry(()=>editingCustomer
   ?supabase.from('customers').update(payload).eq('id',editingCustomer.id).eq('owner_id',uid).select().single()
   :supabase.from('customers').insert(payload).select().single());
  if(res.error)throw res.error;
  const saved=res.data as Customer;
  setCustomers(items=>editingCustomer?items.map(x=>x.id===saved.id?saved:x):[saved,...items]);
  setOrders(items=>items.map(x=>x.customer_id===saved.id?{...x,customers:saved}:x));
  if(!editingCustomer)pushNotification({type:'info',title:'Pelanggan ditambahkan',detail:`${saved.name} berhasil ditambahkan ke pelanggan.`,time:'Baru saja',page:'Customers'});
  setToast(editingCustomer?'Perubahan pelanggan disimpan':'Pelanggan berhasil ditambahkan');
 };
 const saveModal=async(type:ModalType,form:any)=>{
  try{
   await (type==='category'?saveCategory(form):saveCustomer(form));
   setModal(null);setEditing(null);
  }catch(err:any){setError(friendlySupabaseError(err))}
 };
 const openModal=(type:ModalType,item:Category|Customer|null=null)=>{setEditing(item);setModal(type)};
 const openProductForm=(product:Product|null=null)=>{setProductForm({product});setModal(null);setEditing(null);setNotificationsOpen(false)};
 const updateStock=(id:string,stock:number)=>setProducts(prev=>prev.map(p=>p.id===id?{...p,stock}:p));
 const go=(p:Page)=>{setPage(p);setProductForm(null);setQuery('');if(typeof window!=='undefined'&&window.innerWidth<=900)setMobile(false)};
 const openOrder=(order:Order)=>{setSelectedOrder(order);setNotificationsOpen(false);go('Orders')};
 const handleNotificationClick=(n:any)=>{
   // Tetap di halaman saat ini. Detail transaksi dibuka sebagai modal premium.
   setReadNotificationIds(prev=>prev.includes(n.id)?prev:[...prev,n.id]);
   setNotificationsOpen(false);
   setSelectedNotification({...n});
 };
 const searchPlaceholders:any={Overview:'Cari produk, pelanggan, atau transaksi…',POS:'Cari produk untuk kasir…',Orders:'Cari nomor order, pelanggan, atau status…',Analytics:'Cari data analisa…',Products:'Cari produk, kategori, atau stok…',Categories:'Cari kategori…',Customers:'Cari nama, telepon, atau email…',Inventory:'Cari produk atau kategori…',Settings:'Cari pengaturan…'};
 const filteredProducts=products.filter(p=>{const q=query.trim().toLowerCase();const hay=[p.name,p.description||'',p.categories?.name||'',String(p.stock),String(p.price)].join(' ').toLowerCase();return !q||hay.includes(q)});
 const pendingKasirCustomers=useMemo(()=>customers.filter(c=>!isCustomerOrderComplete(c,orders,orderItems,products)),[customers,orders,orderItems,products]);
 const q=query.trim();
 // Setelah pembayaran: jangan reload seluruh dashboard (layar berkedip "Memuat data toko").
 // Sinkronkan hanya yang berubah: transaksi baru, item pesanan, dan notifikasi.
 const handleSaleDone=(receipt:Receipt,_soldItems:CartItem[],newOrderItems:OrderItem[]=[])=>{
  if(receipt?.id){
   const customerRow=customers.find(c=>c.id===receipt.customer_id)||null;
   setOrders(prev=>[{
    ...receipt,
    owner_id:session.user.id,
    status:'completed',
    payment_method:receipt.payment_method||'cash',
    subtotal:Number(receipt.subtotal??receipt.total??0),
    discount:0,
    total:Number(receipt.total??0),
    amount_paid:Number(receipt.amount_paid??receipt.total??0),
    change_due:Number(receipt.change_due??0),
    created_at:receipt.created_at||new Date().toISOString(),
    customers:customerRow
   },...prev.filter(o=>o.id!==receipt.id)] as Order[]);
  }
  if(Array.isArray(newOrderItems)&&newOrderItems.length){
   setOrderItems(prev=>[...prev.filter(i=>!newOrderItems.some(n=>n.id===i.id)),...newOrderItems]);
  }
  pushNotification({id:receipt?.id?`order-${receipt.id}`:undefined,type:'success',title:'Pembayaran berhasil',detail:`#${receipt?.order_number||'Transaksi'} • ${money(Number(receipt?.total||0))}`,time:'Baru saja',page:'Orders',targetId:receipt?.id||receipt?.order_number});
 };
 const visibleNotifications=notifications.filter(n=>
  notificationFilter==='all'?true
  :notificationFilter==='unread'?!readNotificationIds.includes(n.id)
  :notificationFilter==='transactions'?n.page==='Orders'
  :notificationFilter==='stock'?n.page==='Inventory'
  :n.page!=='Orders'&&n.page!=='Inventory');
 const renderPage=()=>{
  if(productForm)return <ProductForm key={productForm.product?.id||'new'} product={productForm.product} categories={categories} onCancel={()=>setProductForm(null)} onSubmit={saveProduct}/>;
  if(q&&(page==='Overview'||page==='Analytics'||page==='Settings'))return <GlobalSearchResults query={q} products={products} customers={customers} categories={categories} orders={orders} go={go}/>;
  if(loading)return <div className="loading"><div className="spinner"/> Memuat data toko…</div>;
  switch(page){
   case 'Overview':return <Overview products={products} orders={orders} orderItems={orderItems} go={go} onOpenOrder={openOrder} onAddProduct={()=>openProductForm()}/>;
   case 'POS':return <POS products={products} categories={categories} customers={pendingKasirCustomers} query={query} cart={cart} onCartChange={setCart} onStockChange={updateStock} onDone={handleSaleDone}/>;
   case 'Products':return <Products products={filteredProducts} onEdit={openProductForm} onDelete={id=>remove('products',id)}/>;
   case 'Categories':return <Categories categories={categories} products={products} query={query} onAdd={()=>openModal('category')} onEdit={x=>openModal('category',x)} onDelete={id=>remove('categories',id)}/>;
   case 'Customers':return <Customers customers={customers} orders={orders} orderItems={orderItems} products={products} query={query} onEdit={(x:Customer)=>openModal('customer',x)} onDelete={(id:string)=>remove('customers',id)}/>;
   case 'Orders':return <Orders orders={orders} orderItems={orderItems} query={query} onOpen={openOrder}/>;
   case 'Inventory':return <Inventory products={products} categories={categories} onError={setError} query={query} onStockChange={updateStock} onAdd={()=>openProductForm()} onDelete={id=>remove('products',id)}/>;
   case 'Analytics':return <Analytics orders={orders} orderItems={orderItems} products={products}/>;
   case 'Settings':return <SettingsScreen email={session.user.email||''} theme={theme} resolvedTheme={resolvedTheme} onThemeChange={changeTheme} onSignOut={()=>supabase.auth.signOut()}/>;
  }
 };

 return <main className="shell"><AnimatePresence>{mobile&&<motion.button className="backdrop" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={()=>setMobile(false)}/>}</AnimatePresence><aside className={mobile?'sidebar open':'sidebar'}><div className="brand"><div className="brand-logo">M</div><div><b>MIEFLOW</b><small>BUSINESS POS</small></div><button className="mobile-close" onClick={()=>setMobile(false)}><X/></button></div><div className="store-card"><span className="live-dot"/><div><b>{RECEIPT_STORE.name}</b><small>Online • Secure</small></div></div><nav>{nav.map(([label,key,Icon])=><button key={key} className={page===key?'active':''} onClick={()=>go(key)}><Icon size={18}/><span>{label}</span></button>)}</nav><div className="side-bottom"><button onClick={()=>go('Settings')}><Settings size={18}/>Pengaturan</button><button className="logout" onClick={()=>supabase.auth.signOut()}><LogOut size={18}/>Keluar</button><div className="user"><div>{(session.user.email||'A')[0].toUpperCase()}</div><span><b>{session.user.email}</b><small>Authenticated</small></span></div></div></aside>
 <section className="main">{notificationFlash&&<AnimatePresence><motion.div className="notification-flash" initial={{opacity:0,y:-18,scale:.96}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:-12,scale:.97}} transition={{duration:.22}} role="status"><div className={`notification-flash-icon ${notificationFlash.type}`}>{noticeGlyph(notificationFlash.type)}</div><div className="notification-flash-copy"><span>{notificationFlash.type==='success'?'PAYMENT CONFIRMED':'NOTIFIKASI BARU'}</span><b>{notificationFlash.title}</b><small>{notificationFlash.detail}</small><button className="notification-flash-action" onClick={()=>setNotificationFlash(null)}>Mengerti <CheckCircle2 size={13}/></button></div><button className="notification-flash-close" onClick={()=>setNotificationFlash(null)} aria-label="Tutup notifikasi"><X size={15}/></button></motion.div></AnimatePresence>}<header className={`${page==='POS'?'topbar pos-topbar':'topbar'}${page==='Overview'?' overview-topbar':''}`}><button className="hamb" onClick={()=>setMobile(true)}><Menu/></button><div className="crumb">{page==='POS'?<b>Kasir / POS</b>:<>Workspace <ChevronRight size={14}/><b>{pageTitle(page)}</b></>}</div><div className="top-actions"><label className="global-search universal-search"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder={searchPlaceholders[page]||'Cari data…'} aria-label={`Pencarian ${pageTitle(page)}`}/><button type="button" className="global-search-clear" onClick={()=>setQuery('')} aria-label="Hapus pencarian" style={{display:query?'grid':'none'}}>×</button></label><button type="button" className="top-icon theme-toggle" data-theme={resolvedTheme} onClick={toggleTheme} aria-label={resolvedTheme==='dark'?'Beralih ke mode terang':'Beralih ke mode gelap'} aria-pressed={resolvedTheme==='dark'} title={resolvedTheme==='dark'?'Mode terang':'Mode gelap'}><Sun className="theme-sun" size={19}/><Moon className="theme-moon" size={19}/></button><div className="notification-wrap"><button onClick={()=>setNotificationsOpen(v=>!v)} className="top-icon top-bell" aria-label="Notifikasi"><span>{unreadNotifications>99?"99+":unreadNotifications}</span><Bell size={19}/></button>{notificationsOpen&&<div className="notification-panel"><div className="notification-head"><div><b>Notifikasi</b><small>{notifications.length?`${notifications.length} aktivitas penting`:"Semua aman"}</small></div><button onClick={markNotificationsRead} disabled={!unreadNotifications}>Tandai dibaca</button></div><div className="notification-filters">{[['all','Semua'],['unread','Belum dibaca'],['transactions','Transaksi'],['stock','Stok'],['activity','Aktivitas']].map(([key,label])=><button key={key} className={notificationFilter===key?'active':''} onClick={()=>setNotificationFilter(key as any)}>{label}</button>)}</div><div className="notification-list">{visibleNotifications.length?visibleNotifications.map(n=><button key={n.id} className={`notification-item ${readNotificationIds.includes(n.id)?'read':''}`} onClick={()=>handleNotificationClick(n)}><i className={`notification-icon ${n.type}`}>{noticeGlyph(n.type)}</i><span><b>{n.title}</b><small>{n.detail}</small><em>{n.time}</em></span><ChevronRight size={14} className="notification-arrow"/></button>):<div className="notification-empty"><CheckCircle2 size={22}/><b>Tidak ada notifikasi</b><span>Tidak ada aktivitas pada filter ini.</span></div>}</div></div>}</div>{page==='Overview'&&<button className="pos-fullscreen overview-fullscreen" type="button" aria-label={isFullscreen?'Perkecil layar':'Perbesar layar'} title={isFullscreen?'Perkecil layar':'Perbesar layar'} onClick={async()=>{try{if(document.fullscreenElement){await document.exitFullscreen?.()}else{await document.documentElement.requestFullscreen?.()}}catch(e){console.warn('Fullscreen tidak tersedia',e)}}}>{isFullscreen?<Minimize2 size={17}/>:<Maximize2 size={17}/>}</button>}<div className="top-admin"><div className="top-admin-avatar">A</div><div><b>Admin</b><small>Owner</small></div><ChevronDown size={15}/></div></div></header><div className="content">{error&&<div className="error"><span>{error}</span><button onClick={()=>setError('')}><X size={16}/></button></div>}{productForm||page==='Overview'||page==='POS'?null:<div className="page-title"><div><span className="eyebrow">MIEFLOW / {new Date().toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'})}</span><h1>{pageTitle(page)}</h1><p>{pageDescription(page)}</p></div>{['Products','Categories','Customers'].includes(page)&&<button className="primary" onClick={()=>page==='Products'?openProductForm():openModal(page==='Categories'?'category':'customer')}><Plus size={17}/> Tambah</button>}</div>}{renderPage()}</div></section>
 <AnimatePresence>{selectedOrder&&<OrderDetailModal order={selectedOrder} items={orderItems.filter(i=>i.order_id===selectedOrder.id)} onClose={()=>setSelectedOrder(null)}/>} {modal&&<Modal type={modal} initial={editing} categories={categories} products={products} onClose={()=>{setModal(null);setEditing(null)}} onSave={saveModal}/>}</AnimatePresence>{selectedNotification&&<AnimatePresence><motion.div className="notification-detail-backdrop" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={()=>setSelectedNotification(null)}><motion.section className="notification-detail-modal" initial={{opacity:0,y:18,scale:.97}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:12,scale:.98}} onClick={e=>e.stopPropagation()}><div className={`notification-detail-icon ${selectedNotification.type||'info'}`}>{noticeGlyph(selectedNotification.type)}</div><button className="notification-detail-close" onClick={()=>setSelectedNotification(null)} aria-label="Tutup detail notifikasi"><X size={18}/></button><span className="notification-detail-eyebrow">{selectedNotification.type==='success'?'TRANSACTION CONFIRMED':'NOTIFICATION DETAIL'}</span><h2>{selectedNotification.title}</h2><p>{selectedNotification.detail}</p><div className="notification-detail-meta"><div><small>WAKTU</small><b>{selectedNotification.time||'Baru saja'}</b></div><div><small>STATUS</small><b>{selectedNotification.type==='success'?'Berhasil':'Tercatat'}</b></div></div><div className="notification-detail-note"><CheckCircle2 size={17}/><span>Notifikasi telah dibuka dan ditandai sebagai sudah dibaca. Anda tetap berada di halaman saat ini.</span></div><button className="notification-detail-action" onClick={()=>setSelectedNotification(null)}>Selesai <Check size={16}/></button></motion.section></motion.div></AnimatePresence>}{deleteConfirm&&<DeleteConfirmDialog data={deleteConfirm} onCancel={()=>setDeleteConfirm(null)} onConfirm={confirmRemove}/>}{toast&&<motion.div className="toast" initial={{y:20,opacity:0}} animate={{y:0,opacity:1}}><Check size={17}/>{toast}</motion.div>}</main>}
