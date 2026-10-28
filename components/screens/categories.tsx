'use client';

/** Category management: structure of the menu catalog, with live product counts, stock and share per category. */
import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Edit3, Layers, PackageOpen, Plus, Search, Sparkles, Tags, Trash2, Wallet } from 'lucide-react';
import { compactNumber, money } from '@/lib/format';
import type { Category, Product } from '@/lib/types';

type Sort = 'count' | 'name' | 'new';
type Row = { category: Category; items: Product[]; count: number; units: number; value: number; low: number };
const SORTS: [Sort, string][] = [['count', 'Terbanyak'], ['name', 'A–Z'], ['new', 'Terbaru']];
const units = (p: Product) => Math.max(0, Number(p.stock) || 0);

export function Categories({ categories, products = [], query, onAdd, onEdit, onDelete }: {
  categories: Category[]; products?: Product[]; query?: string; onAdd?: () => void; onEdit: (c: Category) => void; onDelete: (id: string) => void;
}) {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<Sort>('count');

  /** One row per category, plus the products that belong to none (or to a category that no longer exists). */
  const { rows, loose } = useMemo(() => {
    const known = new Set(categories.map((c) => c.id));
    const loose = products.filter((p) => !p.category_id || !known.has(p.category_id));
    const rows: Row[] = categories.map((category) => {
      const items = products.filter((p) => p.category_id === category.id);
      return {
        category, items, count: items.length,
        units: items.reduce((a, p) => a + units(p), 0),
        value: items.reduce((a, p) => a + units(p) * (Number(p.price) || 0), 0),
        low: items.filter((p) => Number(p.stock) < 5).length,
      };
    });
    return { rows, loose };
  }, [categories, products]);

  const totalProducts = products.length;
  const categorized = totalProducts - loose.length;
  const biggest = rows.reduce<Row | null>((best, r) => (!best || r.count > best.count ? r : best), null);
  const avgPerCategory = rows.length ? categorized / rows.length : 0;
  const q = (search || query || '').trim().toLowerCase();
  const visible = rows
    .filter((r) => !q || r.category.name.toLowerCase().includes(q) || String(r.category.color).toLowerCase().includes(q))
    .sort((a, b) => sort === 'name' ? a.category.name.localeCompare(b.category.name, 'id')
      : sort === 'new' ? String(b.category.created_at || '').localeCompare(String(a.category.created_at || ''))
      : b.count - a.count || a.category.name.localeCompare(b.category.name, 'id'));
  const segments = rows.filter((r) => r.count > 0).sort((a, b) => b.count - a.count);

  const kpis = [
    { tone: 'violet', icon: Layers, label: 'Total kategori', value: rows.length.toLocaleString('id-ID'), note: 'Pengelompokan menu' },
    { tone: 'green', icon: Tags, label: 'Produk terkategori', value: `${categorized}/${totalProducts}`, note: totalProducts ? `${Math.round((categorized / totalProducts) * 100)}% sudah punya kategori` : 'Belum ada produk' },
    { tone: loose.length ? 'amber' : 'blue', icon: loose.length ? AlertTriangle : Sparkles, label: 'Tanpa kategori', value: loose.length.toLocaleString('id-ID'), note: loose.length ? 'Perlu dikelompokkan' : 'Semua produk rapi' },
    { tone: 'orange', icon: Wallet, label: 'Kategori terbesar', value: biggest && biggest.count ? biggest.category.name : '—', note: biggest && biggest.count ? `${biggest.count} produk` : 'Belum ada data' },
  ];

  return <div className="ct-page">
    <section className="ct-hero">
      <div className="ct-hero-copy">
        <span className="ct-eyebrow"><Layers size={13}/> Catalog Structure</span>
        <h2>Kategori Menu</h2>
        <p>Susun menu ke dalam kategori agar kasir lebih cepat memilih dan stok lebih mudah dipantau.</p>
        <div className="ct-hero-actions">
          {onAdd && <button type="button" className="ct-cta" onClick={onAdd}><Plus size={16}/> Tambah kategori</button>}
          <div className="ct-hero-stats"><div><b>{rows.length}</b><span>Kategori</span></div><div><b>{totalProducts}</b><span>Produk</span></div><div><b>{avgPerCategory.toLocaleString('id-ID', { maximumFractionDigits: 1 })}</b><span>Rata-rata / kategori</span></div></div>
        </div>
      </div>
      <div className="ct-hero-panel">
        <div className="ct-panel-head"><span>Distribusi produk</span><b>{categorized} item</b></div>
        {segments.length ? <>
          <div className="ct-stack" role="img" aria-label="Distribusi produk per kategori">
            {segments.map((r) => <i key={r.category.id} title={`${r.category.name}: ${r.count}`} style={{ flexGrow: r.count, ['--c' as any]: r.category.color }}/>)}
            {loose.length > 0 && <i className="loose" style={{ flexGrow: loose.length }} title={`Tanpa kategori: ${loose.length}`}/>}
          </div>
          <ul className="ct-legend">
            {segments.slice(0, 4).map((r) => <li key={r.category.id} style={{ ['--c' as any]: r.category.color }}><i/><span>{r.category.name}</span><b>{Math.round((r.count / Math.max(1, totalProducts)) * 100)}%</b></li>)}
            {segments.length > 4 && <li className="more"><span>+{segments.length - 4} kategori lain</span></li>}
          </ul>
        </> : <div className="ct-panel-empty"><Sparkles size={18}/> Tambahkan produk ke kategori untuk melihat distribusinya.</div>}
      </div>
    </section>

    <section className="ct-kpis">{kpis.map((k, i) => <motion.div key={k.label} className={`ct-kpi ${k.tone}`} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .35, delay: i * .05 }}><div className="ct-kpi-icon"><k.icon size={19}/></div><span>{k.label}</span><b title={String(k.value)}>{k.value}</b><small>{k.note}</small></motion.div>)}</section>

    <section className="ct-card ct-board">
      <div className="ct-board-head">
        <div><span className="ct-kicker">Daftar kategori</span><h3>Semua kategori</h3><p>Ringkasan produk, stok, dan nilai stok untuk setiap kategori.</p></div>
        <div className="ct-live"><i/> Live data</div>
      </div>
      <div className="ct-toolbar">
        <label className="ct-search"><Search size={17}/><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari nama atau kode warna…" aria-label="Cari kategori"/></label>
        <div className="ct-tabs" role="tablist" aria-label="Urutkan">{SORTS.map(([key, label]) => <button key={key} type="button" role="tab" aria-selected={sort === key} className={sort === key ? 'active' : ''} onClick={() => setSort(key)}>{label}</button>)}</div>
      </div>

      <div className="ct-grid">
        {visible.map((r, idx) => {
          const share = totalProducts ? (r.count / totalProducts) * 100 : 0;
          const c = r.category;
          return <motion.article key={c.id} className="ct-tile" style={{ ['--c' as any]: c.color }} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .28, delay: Math.min(idx, 8) * .035 }}>
            <header>
              <span className="ct-tile-icon"><Tags size={20}/></span>
              <div className="ct-tile-title"><h4>{c.name}</h4><span><i/>{String(c.color).toUpperCase()}{c.created_at ? ` · ${new Date(c.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}` : ''}</span></div>
              <div className="ct-tile-actions"><button type="button" aria-label={`Ubah ${c.name}`} title="Ubah" onClick={() => onEdit(c)}><Edit3 size={15}/></button><button type="button" className="danger" aria-label={`Hapus ${c.name}`} title="Hapus" onClick={() => onDelete(c.id)}><Trash2 size={15}/></button></div>
            </header>
            <div className="ct-metrics">
              <div><b>{r.count}</b><span>Produk</span></div>
              <div><b>{compactNumber(r.units)}</b><span>Unit stok</span></div>
              <div><b>{compactNumber(r.value)}</b><span>Nilai stok</span></div>
            </div>
            <div className="ct-share"><div><span>Porsi katalog</span><b>{Math.round(share)}%</b></div><div className="ct-share-bar"><i style={{ width: `${Math.max(r.count ? 6 : 0, share)}%` }}/></div></div>
            <footer>
              {r.items.length
                ? <div className="ct-chips">{r.items.slice(0, 3).map((p) => <span key={p.id}>{p.name}</span>)}{r.items.length > 3 && <em>+{r.items.length - 3}</em>}</div>
                : <div className="ct-chips empty"><PackageOpen size={14}/> Belum ada produk</div>}
              {r.low > 0 && <span className="ct-warn" title="Produk dengan stok kurang dari 5"><AlertTriangle size={12}/> {r.low} menipis</span>}
            </footer>
          </motion.article>;
        })}
        {onAdd && !q && <button type="button" className="ct-new" onClick={onAdd}><span><Plus size={20}/></span><b>Kategori baru</b><small>Kelompokkan menu dengan warna khas</small></button>}
        {!visible.length && <div className="ct-empty"><span><Tags size={26}/></span><b>{rows.length ? 'Kategori tidak ditemukan' : 'Belum ada kategori'}</b><small>{rows.length ? 'Coba kata kunci lain.' : 'Buat kategori pertama untuk merapikan menu Anda.'}</small>{!rows.length && onAdd && <button type="button" className="ct-cta" onClick={onAdd}><Plus size={16}/> Tambah kategori</button>}</div>}
      </div>

      {loose.length > 0 && <div className="ct-loose">
        <div className="ct-loose-head"><span><AlertTriangle size={15}/></span><div><b>{loose.length} produk belum punya kategori</b><small>Pilih kategori saat mengubah produk agar tampil rapi di Kasir.</small></div></div>
        <div className="ct-chips">{loose.slice(0, 8).map((p) => <span key={p.id}>{p.name}</span>)}{loose.length > 8 && <em>+{loose.length - 8}</em>}</div>
      </div>}

      <div className="ct-foot"><span>Menampilkan <b>{visible.length}</b> dari <b>{rows.length}</b> kategori</span><span>Total nilai stok <b>{money(rows.reduce((a, r) => a + r.value, 0))}</b></span></div>
    </section>
  </div>;
}
