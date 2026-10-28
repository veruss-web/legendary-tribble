# Perbaikan Metode Pembayaran

Perubahan:
- Filter Riwayat Transaksi hanya menampilkan: Tunai, E-Wallet, ATM.
- Pencarian transaksi sekarang juga mengenali nama tampilan E-Wallet dan ATM.
- Data lama `qris` ditampilkan dan difilter sebagai E-Wallet.
- Data lama `card` ditampilkan dan difilter sebagai ATM.
- Di POS/Kasir, opsi DANA diganti menjadi E-Wallet.
- Opsi Transfer / Bank diganti menjadi ATM.
- Tidak perlu mengubah database Supabase untuk kompatibilitas data lama.
