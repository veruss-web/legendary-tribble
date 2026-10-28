# Mieflow – Perbaikan Deployment & CRUD

Perbaikan yang sudah diterapkan:

- Memperbaiki tipe `Order` agar memiliki `customer_id`, sehingga build TypeScript tidak gagal saat data order dipetakan ke pelanggan.
- Menjadikan SQL setup final lengkap sebagai `supabase/schema.sql`.
- SQL final sekarang membuat tabel dan relasi yang benar-benar dipakai aplikasi: `categories`, `products`, `customers`, `orders`, `order_items`, dan `stock_movements`.
- Menambahkan RPC `create_sale` untuk checkout atomik: transaksi, item pesanan, pengurangan stok, dan riwayat stok berjalan dalam satu proses.
- Mengaktifkan RLS dan policy CRUD untuk pengguna yang sudah login.
- Menyiapkan bucket `product-images` dan policy upload/read/update/delete foto produk.

## Sebelum deploy
1. Di Supabase, buka SQL Editor dan jalankan seluruh isi `supabase/schema.sql`.
2. Di Vercel, isi Environment Variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
3. Redeploy project.

## Fungsi CRUD
- Products: tambah, tampilkan, ubah, hapus.
- Categories: tambah, tampilkan, ubah, hapus.
- Customers: tambah, tampilkan, ubah, hapus.
- POS: checkout otomatis membuat order dan order items serta mengurangi stok secara atomik.
