/**
 * Store profile printed on thermal receipts (58 mm and 80 mm).
 * Override with the NEXT_PUBLIC_STORE_* variables in .env.local / the hosting environment (see .env.local.example).
 */
export const RECEIPT_STORE={
 name:process.env.NEXT_PUBLIC_STORE_NAME||'Warung Mie',
 address:process.env.NEXT_PUBLIC_STORE_ADDRESS||'Alamat toko • Kota Anda',
 phone:process.env.NEXT_PUBLIC_STORE_PHONE||'',
 footer:process.env.NEXT_PUBLIC_STORE_FOOTER||'Terima kasih atas kunjungan Anda. Selamat menikmati!'
};
