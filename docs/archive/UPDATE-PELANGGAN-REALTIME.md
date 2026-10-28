# Update Pelanggan Real-time

- Setelah transaksi berhasil di Kasir, state `orders` dan `order_items` langsung diperbarui tanpa reload halaman.
- Detail `order_items` transaksi baru diambil langsung setelah RPC `create_sale` selesai, sehingga progress mie pelanggan langsung berubah.
- Ditambahkan Supabase Realtime listener untuk `orders` dan `order_items` berdasarkan `owner_id`, sehingga perubahan dari tab/perangkat lain dapat masuk otomatis.
- Status pelanggan dihitung dari order `completed` dan jumlah `order_items.quantity` yang terkait dengan pelanggan.
