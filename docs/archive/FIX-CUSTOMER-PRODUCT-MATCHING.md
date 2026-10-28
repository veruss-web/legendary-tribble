# Fix Customer ↔ Kasir Product Matching

Perbaikan ini memastikan progres pesanan pelanggan tidak lagi dicocokkan dengan nama produk yang hanya mirip.

## Aturan baru

1. Jika menu sudah ada di katalog, target pelanggan dicari berdasarkan **nama produk yang sama persis setelah normalisasi** lalu transaksi dicocokkan menggunakan **product_id**.
2. Jika menu belum dibuat di katalog, target tetap ditampilkan sebagai **Pending** dengan keterangan **Menu belum dibuat** dan progres 0/target.
3. Nama `mie` tidak akan lagi menerima transaksi `mie level tiga`, `mie level 2`, atau nama lain yang hanya mengandung kata `mie`.
4. Setelah menu yang sesuai dibuat dan transaksi dilakukan dari Kasir, transaksi hanya menambah target pelanggan yang dipilih di Kasir dan produk yang benar.
5. Pelanggan otomatis hilang dari pilihan Kasir hanya setelah seluruh target produknya terpenuhi.
6. Perubahan tetap mengikuti sinkronisasi realtime yang sudah ada.

## Contoh

Pelanggan Santos memiliki target:
- Mie level tiga 10
- Ayam geprek+telur 10
- Es jeruk 10
- Pangsit udang 5

Jika menu `Mie level tiga` belum dibuat, target tetap muncul `0/10 — Menu belum dibuat`.
Setelah menu tersebut dibuat, transaksi Kasir untuk Santos dengan produk `Mie level tiga` akan mengubahnya menjadi `1/10`, bukan menambah target `mie` milik pelanggan lain.
