# MIEFLOW v7

Versi ini membuat alur produk sesederhana mungkin setelah Supabase siap:

- Tambah produk -> pilih Gallery -> preview -> Simpan sekali.
- Edit produk -> Simpan perubahan.
- Hapus produk -> Hapus.
- JWT/session otomatis dipelihara dan request akan dicoba ulang jika token kedaluwarsa.
- Produk tidak lagi gagal dimuat hanya karena tabel pendukung seperti orders/categories belum tersedia.
- Foto lokal yang dipilih dari Gallery akan otomatis dicoba upload saat tombol Simpan ditekan.
- Jika Storage belum siap, produk tetap dapat disimpan tanpa foto dan aplikasi menampilkan peringatan yang jelas.

## Satu-satunya setup manual

Supabase tetap memerlukan database/schema dibuat satu kali. Ini adalah batas keamanan Supabase: publishable key di browser tidak boleh membuat tabel PostgreSQL.

Jalankan `supabase/MIEFLOW-SUPABASE-SETUP-FINAL.sql` satu kali di Supabase SQL Editor.

Setelah itu tidak ada SQL yang perlu dijalankan setiap kali tambah/edit/hapus produk.
