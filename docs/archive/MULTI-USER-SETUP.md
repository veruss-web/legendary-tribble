# MIEFLOW — FIX MULTI-USER

Versi ini sudah diperbaiki agar setiap akun Supabase memiliki data toko sendiri.

## Yang sudah diperbaiki di aplikasi

- Products membaca data dengan `owner_id` user yang sedang login.
- Categories membaca data dengan `owner_id` user yang sedang login.
- Customers membaca data dengan `owner_id` user yang sedang login.
- Orders/dashboard membaca data dengan `owner_id` user yang sedang login.
- Produk/kategori/customer baru otomatis disimpan dengan `owner_id = user.id`.
- Inventory adjustment menyimpan `owner_id`.
- Foto produk baru disimpan pada folder `<user-id>/products/...`.
- Checkout RPC diperbaiki agar produk dan pelanggan harus berasal dari akun yang sedang login.
- RLS database diperbaiki dari policy shared `using(true)` menjadi tenant policy `owner_id = auth.uid()`.
- Akun baru tidak akan mendapatkan data akun lain.

## WAJIB: jalankan SQL

Buka Supabase → SQL Editor → New query, lalu jalankan seluruh:

`supabase/MIEFLOW-MULTI-USER-FIX.sql`

File `supabase/schema.sql` dan `supabase/MIEFLOW-SUPABASE-SETUP-FINAL.sql` juga sudah diarahkan ke versi multi-user yang sama.

### Data lama

Karena database versi lama tidak menyimpan pemilik data, migration memberikan data lama yang `owner_id`-nya kosong kepada akun Supabase tertua. Setelah itu akun baru akan melihat data kosong.

Jika akun yang seharusnya menjadi pemilik data lama bukan akun tertua, ubah `owner_id` data lama menggunakan UUID akun yang benar sebelum dipakai sebagai toko.

## Setelah SQL selesai

1. Redeploy project di Vercel.
2. Logout dari MIEFLOW.
3. Login dengan Email A → data A saja.
4. Logout.
5. Login dengan Email B → data B saja; jika B belum membuat data, semua modul utama kosong/0.
6. Tambahkan produk dari B → produk hanya muncul di B.
7. Login kembali A → produk B tidak terlihat.
