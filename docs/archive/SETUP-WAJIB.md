# SETUP SUPABASE MIEFLOW — MULTI-USER

MIEFLOW sekarang memisahkan data berdasarkan akun Supabase dengan `owner_id = auth.uid()` dan RLS.

## 1. Vercel

Pastikan Environment Variables:

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
```

## 2. Supabase

1. Pastikan minimal satu akun Mieflow sudah terdaftar.
2. Buka **Supabase → SQL Editor → New query**.
3. Jalankan seluruh file `supabase/MIEFLOW-MULTI-USER-FIX.sql` satu kali.
4. File ini menambahkan `owner_id`, memisahkan RLS, mengamankan checkout, dan memindahkan data lama ke akun Supabase tertua.
5. Setelah selesai, jalankan `NOTIFY pgrst, 'reload schema';` jika perlu.

### Penting tentang data lama

Data lama yang sebelumnya bercampur tidak mempunyai pemilik. Migration memberikan data tersebut ke **akun Supabase tertua**. Akun baru tidak akan melihat data lama.

Jika data lama ternyata harus dimiliki akun lain, gunakan SQL berikut setelah mengetahui ID akun yang benar:

```sql
-- Contoh: ganti USER_ID_LAMA dengan UUID akun pemilik data lama.
update public.products set owner_id='USER_ID_LAMA' where owner_id='OWNER_LAMA_SALAH';
update public.categories set owner_id='USER_ID_LAMA' where owner_id='OWNER_LAMA_SALAH';
update public.customers set owner_id='USER_ID_LAMA' where owner_id='OWNER_LAMA_SALAH';
update public.orders set owner_id='USER_ID_LAMA' where owner_id='OWNER_LAMA_SALAH';
update public.order_items set owner_id='USER_ID_LAMA' where owner_id='OWNER_LAMA_SALAH';
update public.stock_movements set owner_id='USER_ID_LAMA' where owner_id='OWNER_LAMA_SALAH';
```

## 3. Jangan gunakan SQL lama

`schema.sql`, `MIEFLOW-SUPABASE-SETUP-FINAL.sql`, dan `REPAIR-EXISTING.sql` pada project lama adalah versi shared-data. Untuk database multi-user gunakan `MIEFLOW-MULTI-USER-FIX.sql`.

## 4. Hasil yang diharapkan

- Email A login → hanya data A.
- Email B login → hanya data B.
- Email B belum membuat data → Products, Categories, Customers, Orders kosong; Overview 0.
- Email B tidak dapat membaca, mengubah, atau menghapus data A melalui API.
- Checkout hanya menerima produk dan pelanggan milik akun yang sedang login.
