# FIX DEPLOYMENT VERCEL

Perbaikan untuk error:

`Module not found: Can\'t resolve '@/lib/supabase'`

## Yang sudah diperbaiki

1. File `lib/supabase.ts` dipastikan ada di project.
2. Import pada `app/page.tsx` menggunakan path relatif `../lib/supabase` agar tidak bergantung pada alias `@`.
3. `tsconfig.json` memiliki `baseUrl: "."` dan alias `@/*`.
4. Dependency `@supabase/supabase-js` sudah tercantum di `package.json`.

## Setelah upload ke GitHub

Push seluruh isi ZIP ini sebagai isi repository (bukan ZIP di dalam repository), lalu redeploy di Vercel.

Pastikan Environment Variables Vercel:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Alternatif key lama yang juga didukung aplikasi:

- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
