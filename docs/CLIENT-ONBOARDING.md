# Panduan simpel: jual Mieflow ke client (akun dibuat admin)

- Client **tidak daftar sendiri**. Admin membuat akun lalu mengirim email + password ke client.
- Client yang lupa password **membuat password baru sendiri**: kode 6 digit dikirim ke emailnya, kode diketik di website, lalu form password baru langsung muncul. Admin tidak terlibat.

## Setup sekali per project Supabase

1. Jalankan `supabase/schema.sql` di **SQL Editor**.
2. Matikan pendaftaran publik: Authentication → Sign In / Providers → matikan **Allow new users to sign up**.
3. Aktifkan pengiriman email (wajib agar "Lupa password" sampai ke client):
   Authentication → Emails → SMTP Settings → **Enable custom SMTP**.
   Tanpa ini Supabase hanya mengirim ke anggota tim project dan dibatasi 2 email per jam.
   Cara termudah memakai Gmail Anda:
   - Host `smtp.gmail.com`, port `465`
   - Username: alamat Gmail Anda
   - Password: **App Password** (akun Google → Keamanan → Verifikasi 2 langkah aktif → Sandi aplikasi). Bukan password Gmail biasa.
   - Sender email: Gmail yang sama, sender name: nama aplikasi Anda
4. **Template email reset password** (wajib agar "Lupa password" mengirim kode, bukan link):
   Authentication → Emails → Templates → **Reset password**.
   - Subject: `Kode reset password Mieflow`
   - Message body: salin seluruh isi `supabase/email-templates/recovery.html`, lalu **Save**.
   - Isi template harus memuat `{{ .Token }}` (itulah kode 6 digitnya). Jangan menambahkan `{{ .ConfirmationURL }}`: link di email bisa dibuka otomatis oleh pemindai email (Gmail, Outlook) dan menghanguskan kode.
   - Opsional, di pengaturan provider Email: **Email OTP Expiration** (detik), mis. `600` agar kode berlaku 10 menit. Bila **Email OTP Length** diubah dari 6, ubah juga `OTP_LENGTH` di `lib/auth.ts`.
5. Authentication → URL Configuration → **Site URL** = alamat deploy client, mis. `https://toko-budi.vercel.app`.

Di Vercel isi environment variable: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_STORE_NAME`.

## Setiap ada client baru

1. Client menekan **Minta akses ke admin** di halaman login (email siap kirim ke admin).
2. Admin: Supabase → Authentication → Users → **Add user → Create new user**.
   Isi email client + password sementara, centang **Auto Confirm User**.
3. Admin mengirim alamat aplikasi, email, dan password itu ke client.

## Client lupa password

1. Client menekan **Lupa password?**, mengisi emailnya, lalu **Kirim kode verifikasi**.
2. Kode 6 digit masuk ke email client. Client mengetik kode itu di halaman yang sama (boleh ditempel; kotak terisi otomatis dan kode langsung diperiksa).
3. Kode benar → form **Buat password baru** langsung muncul. Client mengisi password baru (minimal 8 karakter) dan menekan **Simpan password baru**. Selesai.

Kode berlaku sementara dan hanya sekali pakai. Tombol **Kirim ulang kode** aktif setelah hitung mundur 60 detik. Link reset dari template lama masih berfungsi, tetapi template baru tidak memuat link.

Cek bila ada kendala:
- Email tidak datang: lihat folder Spam, lalu pastikan SMTP tersimpan dan App Password benar.
- Email berisi link, bukan kode: template di langkah 4 belum diganti atau belum disimpan.
- "Kode salah atau sudah kedaluwarsa": minta kode baru, lalu ketik kode yang terbaru.

## Satu Supabase untuk beberapa client (menghemat langkah 3)

Pengaturan SMTP, template email, dan matikan sign-up berlaku **per project Supabase**. Bila setiap client punya project sendiri, langkah 2-5 diulang tiap client.
Bila beberapa client memakai satu project Supabase (satu Vercel deploy per client dengan `NEXT_PUBLIC_STORE_NAME` masing-masing, URL dan key Supabase sama):
- langkah 1-4 cukup sekali (satu template kode untuk semua client),
- alur kode tidak memakai link, jadi alamat deploy tiap client tidak perlu didaftarkan di **Redirect URLs** untuk reset password.

Data client tetap terpisah lewat `owner_id` + RLS. Satu akun = satu toko. Beberapa kasir dalam satu toko memakai satu login bersama.
Project Supabase free dapat di-pause bila lama tidak aktif; untuk client berbayar sebaiknya pakai plan berbayar.
