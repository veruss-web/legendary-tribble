# Update Pelanggan — Sinkron dengan Kasir

Perubahan:
- Transaksi dari Kasir yang berhasil dibuat dengan status `completed` langsung masuk ke data `orders` di state dashboard.
- Halaman Pelanggan menghitung transaksi, total belanja, dan transaksi terakhir hanya dari order berstatus `completed`.
- Status pelanggan pada direktori sekarang `Selesai` jika memiliki minimal satu transaksi selesai.
- Pelanggan tanpa transaksi selesai tetap `Tidak aktif`.
- Filter `Aktif` di halaman Pelanggan diganti menjadi `Selesai`.
- Pilihan pelanggan di Kasir tetap menggunakan data `customers` yang sama.
- Pelanggan umum tetap tidak dibuat sebagai record customer; transaksi umum menggunakan `customer_id = null`.

Tidak ada perubahan struktur tabel Supabase yang diperlukan untuk perubahan ini.
