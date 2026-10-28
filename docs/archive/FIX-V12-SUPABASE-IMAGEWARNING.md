MIEFLOW V12 FIX
===============

Perbaikan utama:
1. Memperbaiki ReferenceError `imageWarning is not defined` saat menyimpan Categories/Customers.
   Penyebabnya: variabel imageWarning sebelumnya hanya dibuat di dalam cabang product,
   tetapi dipakai setelah proses save untuk semua jenis data.

2. Menambahkan retry otomatis untuk error PostgREST schema cache (PGRST205/42P01).
   Setelah Supabase baru membuat atau memperbaiki tabel, aplikasi mencoba ulang query
   setelah jeda singkat sebelum menampilkan error.

3. Pesan error products sekarang menampilkan kode/detail asli Supabase, sehingga tidak
   lagi menyembunyikan penyebab sebenarnya dengan pesan generik.

LANGKAH DEPLOY
--------------
- Upload ZIP ini ke GitHub/Vercel.
- Pastikan Vercel Environment Variables tetap:
  NEXT_PUBLIC_SUPABASE_URL
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
- Redeploy.

Jika setelah V12 Products masih menampilkan PGRST205/schema cache, jalankan file:
  supabase/REPAIR-EXISTING.sql
pada SQL Editor project Supabase dengan URL yang sama, lalu tunggu sekitar 1 menit dan refresh.
