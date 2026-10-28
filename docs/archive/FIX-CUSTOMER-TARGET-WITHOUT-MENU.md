# Fix — Customer target walaupun menu belum dibuat

- Pelanggan dapat dibuat dengan beberapa target pesanan meskipun produk/menu belum ada di tabel `products`.
- Setiap target yang belum memiliki menu tetap tampil sebagai `Menu belum dibuat` dan tetap berstatus Pending.
- Setelah menu dibuat dengan nama produk yang sama, transaksi kasir akan dicocokkan berdasarkan `product_id`.
- `mie` tidak pernah dianggap sama dengan `mie level tiga`.
- Jika produk sudah tersedia, transaksi hanya dihitung untuk pelanggan yang dipilih di Kasir dan `product_id` yang sama.
- Status pelanggan menjadi Selesai hanya jika seluruh target produk sudah terpenuhi.
