# Changelog

## Unreleased

### Lupa password — kode verifikasi lewat email, form password baru yang modern
- **Alur baru** (`components/auth/login.tsx`): client mengisi email → Supabase mengirim kode 6 digit → client mengetik kode di website (satu kotak per digit; boleh ditempel; kode lengkap langsung diperiksa) → form **Buat password baru** langsung muncul di halaman yang sama. Tidak ada link yang perlu dibuka.
- **Form password baru dirombak:** indikator langkah (Email → Kode → Password), lencana "Kode terverifikasi" dengan email akun, meter kekuatan 4 segmen, daftar syarat yang menyala saat terpenuhi, petunjuk "Password cocok / belum sama" saat mengetik, tombol simpan aktif hanya bila valid, layar sukses sebelum masuk dashboard, dan tombol **Batalkan** yang mengakhiri sesi di browser ini saja (`signOut({ scope: 'local' })`, bukan semua perangkat). Kolom memakai `autocomplete` yang benar (`email`, `current-password`, `new-password`, `one-time-code`) agar password manager bekerja.
- **Kirim ulang kode** dengan hitung mundur 60 detik. Bila Supabase membalas "terlalu sering" (kode baru saja dikirim), client tetap diarahkan ke kotak kode dan bisa mengetik kode sebelumnya.
- **Tanpa kilatan dashboard:** memverifikasi kode berarti login, jadi `app/page.tsx` menandai mode reset *sebelum* memeriksa kode dan menyimpannya di `sessionStorage` (reload tetap di form password baru; tanda dibersihkan bila sesi kosong atau keluar, sehingga login biasa berikutnya tidak salah masuk ke form ini). Link reset dari template lama tetap bekerja (event `PASSWORD_RECOVERY`).
- **Wajib per project Supabase: ganti template email "Reset Password"** dengan `supabase/email-templates/recovery.html` (memuat `{{ .Token }}`). Langkah dan opsi (OTP expiration / length) ada di `docs/CLIENT-ONBOARDING.md`. Tanpa ini email masih berisi link lama dan tidak ada kode.
- Logika murni baru yang dites: `lib/auth.ts` (`cleanCode` mempertahankan angka nol di depan, `passwordChecks`, `passwordStrength`, `formatCountdown`, `throttleSeconds`, `friendlyAuthError`; yang terakhir dipindah dari `login.tsx` dan diperluas: kode salah / kedaluwarsa, password sama dengan yang lama, password lemah, sesi berakhir, koneksi). Tes: 68 → 74.
- CSS baru berawalan `rc-` di akhir `globals.css` (mode gelap dibuat ulang lewat `npm run theme:build`). Tautan "Lupa password?" dibesarkan dari 9px ke 13px agar mudah ditemukan.

### Analisa — halaman dirombak, chart interaktif (menu "Analisis" kini "Analisa")
- **Nama menu, judul halaman, deskripsi, dan placeholder pencarian: "Analisis" → "Analisa".** Kunci internal `Analytics` tidak berubah.
- **Halaman Analisa dirombak total** (`components/screens/analytics.tsx`, `components/analytics/*`, `app/analisa.css`, awalan `an-`): toolbar periode (7 / 30 / 90 hari / kustom) + unduh CSV, empat kartu KPI dengan sparkline dan selisih vs periode sebelumnya (panjang sama), grafik tren, aktivitas per jam, komposisi metode pembayaran, ranking produk, dan ringkasan (transaksi sukses, dibatalkan, item per transaksi). Mode gelap, mobile, dan `prefers-reduced-motion` ditangani.
- **Grafik tren interaktif:** hover / geser jari membaca tiap hari, klik atau ketuk untuk mem-pin (panel detail hari muncul di bawah grafik, lengkap dengan selisih vs hari yang sejajar di periode lalu), panah kiri/kanan, Home, End, Esc dari keyboard; ganti metrik Omzet ↔ Transaksi, tipe garis ↔ batang, dan tampilkan / sembunyikan pembanding periode lalu. Rentang panjang (> 62 hari) digabung per beberapa hari agar tetap terbaca.
- Jam sibuk (klik jam untuk menyorot), donut metode bayar (hover / klik irisan), dan ranking produk (urutkan Omzet / Terjual, klik baris untuk kontribusi dan harga rata-rata) ikut interaktif.
- **Chart Overview interaktif:** selain hover, kini bisa di-pin dengan klik / ketuk, dibaca dengan keyboard, pindah metrik Omzet ↔ Transaksi, dan pembanding bisa disembunyikan; tooltip menampilkan selisih persen. Garis menggambar dirinya saat periode atau metrik berganti.
- Logika murni baru yang dites: `lib/analytics.ts` (`analyze`, `pct`, `presetRange`, `toCsv`), `lib/chart-path.ts` (`smoothPath` dipindah dari sales-chart, `niceScale`, `axisTicks`); `salesSeries` kini juga mengembalikan `orders` / `previousOrders` per titik.
- **Kartu grafik Overview kini ikut tema** (sebelumnya selalu hitam): terang di mode terang, gelap di mode gelap. Warnanya lewat token `--hv-*` di `.ov-hero` (nilai gelap di `app/dark-overrides.css`); garis, grid, dan titik grafik memakai kelas CSS, bukan warna tetap di SVG.
- Catatan: komponen `Kpi` (`shared/primitives.tsx`) dan aturan CSS `.analytics-*` / `.saas-*` di `globals.css` tidak dipakai lagi; aman dihapus pada pembersihan CSS berikutnya.

### Kasir v2 — tampilan premium, stok terlihat dan akurat, layout aman dari sidebar
- **Stok selalu terlihat di menu.** Setiap kartu punya chip stok di foto (hijau = aman, kuning berdenyut = menipis `< LOW_STOCK`, merah = "Habis"); header menampilkan ringkasan tersedia / menipis / habis. Baris pesanan ikut menampilkan "Sisa N".
- **Stok akurat di semua mode (HP, tablet, desktop).** Ketukan terasa instan (keranjang dan angka stok berubah seketika) sementara panggilan `adjust_product_stock` berjalan di antrean per produk, jadi jawaban tidak pernah tiba terbalik. Angka di layar = stok database + panggilan yang belum dijawab (`availableStock`); saat server menjawab, nilai database menggantikan perkiraan, dan jika server menolak (mis. stok diambil kasir lain) ketukan itu dibatalkan dengan pesan jelas. Tombol Bayar dikunci ("Menyimpan stok…") selama masih ada panggilan terbuka, karena `create_sale` tidak mengurangi stok sendiri.
- **Menu yang habis tetap tampil** (redup, bertanda "Habis") alih-alih hilang. Sebelumnya porsi terakhir yang dimasukkan membuat kartunya lenyap beserta tombol "−", sehingga tidak bisa dikembalikan dari menu.
- Tombol **Kosongkan** di pesanan (konfirmasi dua ketukan) mengembalikan seluruh stok yang sedang direservasi.
- **Form pesanan tidak lagi tertutup sidebar.** Panel pesanan, scrim, bar bawah, dan struk dulunya `position: fixed` dari tepi layar dengan z-index di bawah sidebar (100/1000), sehingga sidebar menimpa bagian kiri mereka di tablet dan desktop sempit. Semuanya kini mulai dari `--ks-offset` (lebar sidebar, 0 di HP). Geometri: `>= 1280px` menu + pesanan berdampingan; `768–1279px` pesanan menjadi drawer kanan di dalam area kerja; `< 768px` bottom sheet. Total dan tombol Bayar ada di footer yang tidak ikut ter-scroll.
- Kartu menu dirancang ulang (foto 4:3 dengan gradasi, tombol tambah / stepper di footer kartu, harga tabular), mode gelap dan `prefers-reduced-motion` ditangani.
- `lib/pos.ts`: `filterMenu` / `menuCategories` tidak lagi menyaring stok 0; baru `availableStock`, `stockLevel`, `menuStats` (dites). Tidak ada perubahan database.

### Added
- **Overview dirombak** (`components/screens/overview.tsx`, `components/overview/sales-chart.tsx`): sapaan + aksi cepat, panel grafik omzet sebagai hero dengan data nyata (kumulatif per jam untuk hari ini, per hari untuk 7 / 30 hari) dibandingkan dengan periode sebelumnya, hover untuk melihat nilai, strip ringkasan (transaksi, rata-rata, item terjual, stok perlu perhatian), lalu menu terlaris, daftar restock, transaksi terbaru (klik membuka detail), dan katalog menu dengan filter kategori + urutan. Menggantikan kurva "Sales Statistics" statis dan lembar urutan produk.
- **Kasir dirombak** (`components/screens/pos.tsx`, `components/pos/*`): rel kategori dengan jumlah, kartu menu foto-besar dengan stepper di kartu (tap menambah, "−" mengurangi, "−" pada porsi terakhir menghapus), panel pesanan bergaya tiket yang menempel di samping (di layar kecil menjadi bottom sheet dengan dock "Lihat pesanan"), metode bayar bergambar, tunai diterima dengan pecahan cepat ("Uang pas", pecahan di atas total) dan kembalian/kekurangan langsung, pelanggan & catatan dilipat jadi satu baris, serta **lembar struk** setelah bayar (pilih 58 / 80 mm, cetak, Esc untuk menutup) dan tombol "Struk terakhir".
- Logika murni yang dites: `lib/overview.ts` (deret penjualan, delta, menu terlaris, restock, `timeAgo`), `lib/pos.ts` (total keranjang, kembalian, `quickCashAmounts`, `filterMenu`, `menuCategories`). Tes 36 → 49.
- `lib/receipt.ts`: `receiptCss()` + `printReceipt()`; `digitsOnly` / `groupDigits` pindah ke `lib/format.ts` (dipakai form produk dan Kasir).
- **Form produk halaman penuh** (`components/screens/product-form.tsx`) menggantikan modal tambah/ubah produk: hero dengan indikator kelengkapan, kartu Informasi dasar / Harga & stok / Kategori, kolom harga jual Rupiah berformat (`25.000`) berdampingan dengan stok, stepper stok (+1, +10, +50, +100), pilihan kategori berupa chip, unggah foto tarik-lepas, pratinjau kartu katalog, saklar status, validasi per kolom, dan bilah aksi yang menempel di bawah. Terang, gelap, dan mobile.
- Logika murni yang dites: `lib/products.ts` (format uang, validasi tunggal `parseDraft`), `lib/inventory.ts` (`levelOf`, `compareBy`, `LOW_STOCK`), `lib/payments.ts` (label & nada metode bayar). Tes 24 → 36.
- `components/shared/option-sheet.tsx`: satu komponen bottom-sheet pilihan, menggantikan empat salinan di Riwayat Transaksi dan Analisis.
- Tombol **Perbarui urutan** di Inventory, muncul hanya jika urutan terkunci sudah tidak sesuai stok terbaru.

### Fixed
- **Stok bocor saat pindah halaman dari Kasir.** Menambah item langsung mengurangi stok di database, tetapi keranjang hanya hidup di halaman Kasir; berpindah halaman membuang keranjang sementara stoknya tetap berkurang. Keranjang kini disimpan di `Dashboard` sehingga bertahan dan reservasi stok tetap konsisten.
- **`position: sticky` tidak pernah menempel di seluruh aplikasi.** `body` dan `.shell` memakai `overflow-x: hidden`, yang membuat sumbu y menjadi `auto` dan menjadikannya scroll container palsu. Diganti `overflow-x: clip` (dengan fallback `hidden`). Dampaknya juga memperbaiki bilah aksi form produk yang seharusnya melayang di bawah layar.
- **`supabase/schema.sql`: `create_sale` menolak pesanan yang lebih besar dari sisa stok.** Stok sudah dikurangi saat item masuk keranjang, tetapi `create_sale` di `schema.sql` masih membandingkan stok (yang sudah berkurang) dengan jumlah pesanan, sehingga stok 5 / beli 4 ditolak ("Stok … tidak mencukupi (tersisa 1)"). Pemeriksaan itu dihapus agar sama dengan migrasi 003. Proyek yang dibuat dari `schema.sql` lama perlu menjalankan `migrations/003_pos_stock_immediate.sql`. README Supabase kini juga memuat migrasi 003 dan 004 yang sebelumnya tidak terdaftar.
- Toast "Pembayaran berhasil" ganda setelah bayar (lembar struk sudah menandakan keberhasilan; notifikasi tetap dicatat).
- **Inventory: baris melompat setelah +1 / +10.** Daftar diurutkan ulang dengan stok langsung, sehingga produk pindah posisi (di bawah kursor) dan daftar "Perlu perhatian" menciut. Urutan dan keanggotaan daftar kini dikunci pada snapshot yang dihitung ulang hanya saat filter, urutan, pencarian, atau daftar produk berubah; angka, bar, dan badge tetap diperbarui langsung. `localStock` (state kembar dari parent) dihapus.
- Tab notifikasi **Semua** hanya menampilkan yang belum dibaca (salah prioritas operator `||` dalam ternary).
- Menyimpan **kategori/pelanggan** menampilkan toast "Produk berhasil ditambahkan", menambah notifikasi "Produk ditambahkan", dan memuat ulang seluruh dashboard (layar berkedip). Kini tiap jenis punya toast/notifikasi sendiri dan state lokal disinkronkan tanpa reload (nama/warna kategori ikut diperbarui di produk, pelanggan di transaksi).
- Ambang "stok menipis" tidak konsisten (notifikasi `≤ 5`, halaman lain `< 5`); semuanya memakai `LOW_STOCK`.
- Judul modal kategori/pelanggan selalu "Tambah …" walau sedang mengubah data.
- Foto produk langsung diunggah saat dipilih sehingga membatalkan form meninggalkan file yatim di bucket; kini dikompres di browser (WebP, maks. 900 px) dan diunggah saat Simpan. Teks batas "5 MB" disamakan dengan batas sebenarnya (10 MB).
- Kanal realtime pesanan berhenti-langganan dan berlangganan ulang setiap daftar pelanggan berubah; kini membaca pelanggan lewat `ref`.

### Changed
- Struk tidak lagi tertanam di panel pembayaran: tampil sebagai lembar setelah bayar. CSS struk kini satu sumber (`receiptCss()` dipakai untuk pratinjau dan jendela cetak); sekitar 60 aturan bertumpuk dan 4 blok `@media print` di `globals.css` dihapus, diganti satu blok `@media print` bersih. 
- Judul halaman generik disembunyikan di Overview dan Kasir (keduanya punya header sendiri); `Dashboard` tidak lagi menghitung `revenue` / `todayOrders` (Overview menghitung sendiri dari `orders`), dan efek reset pelanggan yang terduplikasi di Kasir dihapus (sudah ada di `CustomerPicker`).
- Pembungkus panel pesanan dan kolom samping form memakai `div`, bukan `aside`: CSS sidebar mobile mengenai semua `aside` di dalam `.shell`.
- `dashboard.tsx`: `save()` dipecah menjadi `saveProduct` / `saveCategory` / `saveCustomer` (+ `requireUserId`), rantai ternary halaman menjadi `renderPage()` dengan `switch`, daftar notifikasi tidak lagi dihitung dua kali, prop `money` yang diteruskan tanpa perlu dihapus. `Modal` kini hanya untuk kategori dan pelanggan.
- Pembersihan CSS tahap kedua: 433 aturan yang selector-nya tidak pernah cocok lagi (terutama `product-modal`, `category-picker-*`, `image-drop`), 40 deklarasi yang selalu tertimpa, 3 `@keyframes`, dan 6 custom property yatim dihapus (CSS hasil build 367 KB → ±331 KB). Computed style tiap elemen dibandingkan sebelum/sesudah di 32 state UI (halaman, modal, sheet, notifikasi, hover) pada 390 / 1440 px terang dan 1440 px gelap, serta 9 halaman pada 820 dan 1100 px: tidak ada selisih.

### Removed
- CSS lama Overview dan Kasir (±530 aturan: `reference-*`, `pos-*`, `profit-*`, `overview-*`, lembar urutan produk, dll.) dan variabel yang kini yatim. CSS hasil build 367 KB → ±270 KB. Halaman lain diverifikasi tidak berubah: computed style tiap elemen dibandingkan sebelum/sesudah pada 7 halaman dan 21 kondisi UI (terang, gelap, mobile); satu-satunya selisih adalah perubahan `overflow` pada `.shell` di atas.
- Pelajaran yang dicatat di ARCHITECTURE: class global `.open` dan `.danger` menimpa class state dengan nama sama; beri awalan (`ks-open`).
- **Harga modal.** Kolom harga modal dan panel margin dihapus dari form produk (`cost` juga hilang dari tipe `Product` / `ProductInput`). Tempat yang tadinya menampilkan "Nilai modal" / "Nilai persediaan" (Inventory: kartu, statistik hero, baris produk; Kategori: per kategori dan total) kini menampilkan **Nilai stok** = stok × harga jual. Kolom `products.cost` tetap ada di database (default 0) supaya data lama aman, tetapi tidak lagi dibaca maupun ditulis aplikasi; produk yang diubah mempertahankan nilai lamanya.
- Dependensi tak terpakai: seluruh paket Radix, Recharts, Zod, React Hook Form, cmdk, vaul, sonner, date-fns, dll. **dan Tailwind** (`tailwindcss`, `tailwindcss-animate`, `tailwind.config.ts`; tidak ada direktif `@tailwind` di CSS, hash CSS hasil build identik). Dependensi runtime 61 → 16.
- Kontrol yang tidak berfungsi: dua tombol *view-switch* di Kasir, petunjuk `F9` pada tombol bayar, dan petunjuk `Ctrl /` pada kolom pencarian (tidak ada handler-nya).
- Kode mati: `Head`, `TableHead` (primitives), `THEME_MODES`, halaman placeholder `Promotions` (tipe `Page`, judul, dan fallback), label pembayaran ganda di `orders.tsx` / `pos.tsx`.

### Changed
- Halaman **Kategori** dirancang ulang: hero dengan grafik distribusi produk, 4 kartu ringkasan, kartu per kategori (jumlah produk, unit stok, nilai modal, porsi katalog, produk di dalamnya, peringatan stok menipis), pencarian + urutan, kartu "Kategori baru", dan peringatan untuk produk tanpa kategori. Datanya kini terhubung ke produk (`Categories` menerima `products` dan `onAdd`).
- Halaman **Inventory** dirancang ulang: hero dengan donat kesehatan stok, kartu ringkasan (total unit, nilai persediaan, menipis, habis), panel "Perlu perhatian" dengan tombol restock +10, filter status + filter kategori + urutan, baris produk dengan indikator level stok, stepper −/+ dan +10. Logika penyesuaian stok (compare-and-swap) tidak diubah. Kolom "Update: Baru saja" yang palsu diganti nilai modal per produk.
- `compactNumber()` dipindah ke `lib/format.ts` (dipakai halaman Pelanggan, Kategori, Inventory) dan dites.

### Removed
- ±840 baris CSS lama untuk halaman Inventory/Kategori (`inventory-*`, `category-row`, dll.); tampilan halaman lain diverifikasi identik per piksel (terang & gelap).

### Added
- Dark mode lengkap dan konsisten di semua halaman (Overview, Kasir, Riwayat, Analisis, Produk, Kategori, Pelanggan, Inventory, modal, pemilih pelanggan). Tombol matahari/bulan di bilah atas dan halaman **Pengaturan** (Terang / Gelap / Otomatis mengikuti perangkat). Pilihan disimpan di perangkat, diterapkan sebelum render pertama (tanpa kedip putih), dengan transisi halus.
- `scripts/generate-dark-theme.mjs` menghasilkan `app/dark-theme.generated.css` dari `globals.css` (jalan otomatis lewat `predev`/`prebuild`; manual: `npm run theme:build`). Tweak manual ada di `app/dark-overrides.css`. Tes memastikan berkas hasil selalu terbaru.

### Changed
- Tema kini dipasang di `<html>` (class `dark`), bukan di `.shell`, sehingga elemen portal (pemilih pelanggan) ikut tema. Aturan `.shell.dark` lama (termasuk yang memaksa Analytics tetap terang) dihapus.

### Added
- Menu di form pelanggan selalu mengikuti katalog: produk baru dari Produk/Kasir, perangkat lain, atau tab lain muncul otomatis (Realtime `products`/`categories`, refresh saat tab aktif dan saat form dibuka). Migrasi `supabase/migrations/004_realtime_catalog.sql` mengaktifkan Realtime untuk tabel katalog. Menu bertanda "Stok habis" tetap bisa dipilih untuk pesanan di muka.

### Removed
- Kode tidak terpakai: kit `components/ui/` (shadcn), `hooks/use-toast.ts`, `lib/utils.ts`, `components.json`; variabel/state mati di `pos.tsx`, `modal.tsx`, `analytics.tsx`, `dashboard.tsx`; ±1.750 baris CSS (258 aturan, 264 selector, 3 `@keyframes`) untuk class yang tidak dipakai komponen mana pun, termasuk seluruh style `customer-*` lama. Tampilan diverifikasi identik per piksel.

### Changed
- Redesign premium & modern untuk seluruh bagian pelanggan: halaman Pelanggan (hero, KPI, grafik, insight, direktori), pemilih pelanggan di Kasir, form tambah/ubah pelanggan, dan baris pelanggan pada pencarian global. Style baru memakai prefix `cx-*` di akhir `app/globals.css`; logika data tidak berubah.
- Form tambah/ubah pelanggan kini punya pemilih menu makanan & minuman dengan filter kategori, pencarian, dan stepper jumlah. Pilihan otomatis ditulis ke catatan sebagai `Nama menu jumlah` (format yang sudah dibaca pelacak progres pesanan), jadi tidak perlu perubahan database. Helper: `splitNotesIntoMenu` dan `composeNotesFromMenu` di `lib/customers.ts` (dengan tes).

## 0.2.0 — Professional clean-up

### Fixed

- **Stale data after deleting.** Deleting a category left its old name and tab on products until a reload; the same happened for
  customers on orders and products on order items. Local state now mirrors the database's `ON DELETE SET NULL`.
- **Lost stock updates.** A manual stock adjustment could overwrite a sale made on another device (the screen wrote an absolute number
  computed from a stale value). Adjustments are now compare-and-swap: on conflict nothing is written, the number is refreshed and the user is asked to repeat.
  The movement record is no longer able to leave the screen out of sync, and the blocking `alert()` was replaced by the in-app error banner.
- **`supabase/schema.sql` did not create the `notifications` table** that the app uses, so projects set up from the documented file silently lost
  notification persistence. The canonical schema now includes it (`migrations/002_notifications.sql` for existing projects).
- **Duplicate `create_sale` overloads** (4 and 5 arguments) could trigger PostgREST `PGRST203`. Only the 5-argument function remains (`migrations/001_drop_legacy_create_sale.sql`).
- **Writes are explicit.** Category and customer saves no longer spread the whole form state into the database call (previously `id` / `created_at` were sent on edit);
  names are trimmed and required. Product updates are scoped by `owner_id` like every other table.
- **Type errors that were hidden behind `ignoreBuildErrors`**: `runWithAuthRetry` rejected Supabase query builders (they are `PromiseLike`, not `Promise`),
  the notification list type, the `POS` `onDone` signature, a strict-null error on `Map.get`, six callbacks without parameter types,
  and iterating a `Map` with `target: es5` (target is now `ES2017`; Next.js compiles with SWC regardless).
- Dangling reference to a non-existent “PINDAHKAN DATA LAMA” section in the SQL header (replaced by a commented helper), and error hints that still mentioned QRIS.

### Changed

- `app/page.tsx` (one 141 KB file) is split into 20 modules under `components/` and `lib/`; the page itself is an 18-line auth gate.
  Declarations were moved verbatim by a script, not retyped (see Verification).
- `app/globals.css`: removed 613 rules whose selectors can never match (105 classes no component renders) and 2,102 declarations that a later rule for
  the same selector always overrides, and merged duplicate blocks.
  Delivered size: 400 KB → 290 KB minified (−27 %), 63 KB → 49 KB gzip (−22 %); `!important` 4,737 → 3,314.
- Fonts are loaded with `<link>` in `app/layout.tsx` instead of a CSS `@import` (parallel instead of chained requests).
- `next.config.js`: `STRICT_BUILD=1` turns type errors into build failures (CI sets it); security headers in production; `poweredByHeader` off.
  Linting is a separate gate (`npm run lint`).
- Receipt store profile comes from `NEXT_PUBLIC_STORE_*` variables (defaults unchanged).
- Package renamed to `mie-kelar-pos` (was the template name `nextjs`); page metadata, `noindex`, web manifest and app icons added.
- README and docs rewritten to describe what the code actually uses; new `docs/ARCHITECTURE.md`.

### Added

- `npm test` (12 unit tests for the customer-target and formatting logic, no extra packages) and `npm run verify`.
- GitHub Actions CI (Node 20 and 22): typecheck, tests, lint (non-blocking until clean), strict build.
- Accessibility: `prefers-reduced-motion` support, keyboard focus ring for controls without their own focus style, accessible names on row action buttons.
- `.editorconfig`, `.nvmrc`, `.prettierrc.json`, `supabase/README.md`.

### Removed

- Build artifacts and clutter: `tsconfig.tsbuildinfo`, `next.config.js.bak`, `.bolt/`.
- Duplicate SQL: `MIEFLOW-MULTI-USER-FIX.sql` (identical to the old `schema.sql`), `MIEFLOW-SUPABASE-SETUP-FINAL.sql` and `REPAIR-EXISTING.sql`
  (identical to each other and a strict superset of the old `schema.sql`, now merged into `schema.sql`). Older scripts moved to `supabase/legacy/`.

### Verification

How this release was checked (the sandbox it was prepared in had no internet access, so `npm install` and `next build` could not be run there):

- **Render equivalence of the module split:** 40 components and helpers rendered with identical props before and after the split produce identical HTML.
  The one deliberate difference: the chart tooltips (`<title>`) in Overview now use a single string child, because React 19 renders a `<title>` with array children as empty.
- **Stylesheet equivalence:** the computed style of every element (plus `::before` / `::after`) was compared between the old and new stylesheet in
  55 UI states (desktop, tablet, phone, modals, pickers, search, notification panel, dark-theme class): 17,438 element states identical,
  plus 443 hover and keyboard-focus states identical. The only intended differences are the keyboard focus ring and reduced motion.
  A negative control (deliberately damaged stylesheets) was detected, including a one-digit colour change inside a `:hover` rule.
- **Behavior:** 11 end-to-end scenarios against an in-memory backend (delete flows, stock conflict, error display, trimming, payload shape,
  duplicate name, checkout, product edit, login gate). 6 failed on v0.1.0 (the bugs above); all 11 pass on v0.2.0.
- **Types:** strict TypeScript check with stubbed third-party typings: 0 errors. Run `npm run verify` once with dependencies installed
  (CI does) to confirm against the real library typings.
- **Unit tests:** `npm test` passes (12 tests).

### Recommended next steps

Format the sources with Prettier, prune the unused template dependencies, split `dashboard.tsx` into hooks, and upgrade Next.js to a patched release
(details in `docs/ARCHITECTURE.md`).
