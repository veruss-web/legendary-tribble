# FIX QRIS / Checkout Mieflow

## Apa yang diperbaiki
- Error checkout tidak lagi memakai `alert()` yang menutupi halaman; error tampil di panel POS.
- Error `public.products` sekarang dibedakan dari error QRIS. Jika URL Supabase salah, aplikasi akan menyebutkan endpoint yang sedang dipakai.
- Error `public.create_sale` yang belum ada sekarang dijelaskan dengan langkah perbaikan.
- Pemilihan QRIS tidak lagi dianggap sebagai integrasi payment gateway. Aplikasi ini mencatat `payment_method = qris` setelah kasir menekan **Bayar & simpan transaksi**.
- Alur checkout tetap atomic: order, order_items, pengurangan stok, dan stock movement dilakukan oleh RPC `create_sale`.

## Penyebab error pada screenshot
Pesan `Tabel products tidak ditemukan pada Supabase ...` menunjukkan aplikasi sedang terhubung ke **project Supabase yang berbeda** dari project tempat tabel `products` dibuat, atau tabel/function belum dibuat di project tersebut. Jadi mengganti pilihan menjadi QRIS saja tidak akan memperbaiki akar masalah.

## Wajib dilakukan setelah deploy
1. Buka project Supabase yang memang menyimpan tabel `products`.
2. Supabase → SQL Editor → jalankan seluruh `supabase/schema.sql` dari folder project ini.
3. Pastikan Table Editor menampilkan:
   - `products`
   - `categories`
   - `customers`
   - `orders`
   - `order_items`
   - `stock_movements`
4. Pastikan function `public.create_sale(uuid,text,numeric,jsonb)` tersedia.
5. Di Vercel → Project → Settings → Environment Variables, isi:
   - `NEXT_PUBLIC_SUPABASE_URL` = Project URL dari project yang sama.
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` = publishable/anon key dari project yang sama.
6. Redeploy Vercel setelah mengubah environment variable.

### Catatan penting
`NEXT_PUBLIC_SUPABASE_URL` dan key harus berasal dari **project yang sama**. Jangan memakai URL project A dengan key project B.
