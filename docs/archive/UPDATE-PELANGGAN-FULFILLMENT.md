# Update Status Pelanggan Berdasarkan Pemenuhan Pesanan

Status pelanggan sekarang dihitung dari jumlah mie yang benar-benar sudah masuk transaksi selesai di kasir.

Contoh:
- Catatan pelanggan: `Pesan mie 20`
- Transaksi selesai: 10 mie -> `Pending • 10/20`
- Transaksi selesai berikutnya: 10 mie -> `Selesai`

Jumlah dihitung kumulatif dari `order_items` untuk order pelanggan yang statusnya `completed`.
Target dibaca dari catatan pelanggan (`notes`) dengan pola seperti `Pesan mie 20`, `Pesan 20 mie`, `target 20`, atau `order 20`.

Status otomatis tersinkron dari data kasir karena halaman Pelanggan menggunakan `orders` + `order_items` yang sama.
