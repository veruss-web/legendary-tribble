# Update Multi-Pesanan Pelanggan

Halaman Pelanggan sekarang membaca beberapa jenis pesanan dari Catatan pelanggan, misalnya:

Pesan mie 10
Es 10
Ayam geprek 10

Setiap produk dihitung terpisah berdasarkan `product_name` pada transaksi Kasir yang sudah `completed`.

- Mie 10/10
- Es 10/10
- Ayam geprek 10/10

Status menjadi **Selesai** hanya jika seluruh target produk terpenuhi. Jika salah satu masih kurang, status tetap **Pending**.

Pelanggan yang masih Pending tetap muncul di pilihan pelanggan Kasir. Setelah seluruh target terpenuhi, pelanggan otomatis hilang dari pilihan Kasir melalui state realtime yang sudah ada.
