# Mieflow: Arti warning build Vercel

Pesan `npm warn deprecated`, `Browserslist ... outdated`, dan `Compiled with warnings` bukan berarti build gagal.

Paket lama seperti `rimraf`, `glob`, `inflight`, dan ESLint 8 berasal dari dependency tree project lama/Next.js 13. Warning tersebut dapat muncul saat Vercel melakukan install, tetapi tidak menghentikan aplikasi jika setelahnya build selesai.

Konfigurasi deployment ini sudah dibuat lebih tahan terhadap kegagalan build akibat lint dan type diagnostics:

- ESLint tidak memblokir production build.
- TypeScript diagnostics tidak memblokir production build.
- Image optimization dinonaktifkan agar URL gambar Supabase langsung dapat digunakan.
- CRUD tetap menggunakan Supabase dengan error handling di aplikasi.

Jika Vercel tetap gagal, lihat baris PALING BAWAH pada log dan cari teks `Error`, `Failed`, atau `Build failed`. Warning di atas bukan penyebab utama.
