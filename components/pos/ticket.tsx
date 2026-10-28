'use client';

/** The order ticket of Kasir: items (with the stock left per item), customer / note, payment method, cash helpers and the pay button.
 *  Layout: header and footer never scroll, so the total and the pay button are always in reach; the middle scrolls. */
import { useEffect, useState } from 'react';
import { AlertCircle, Banknote, Check, ChevronDown, CreditCard, Loader2, Minus, Plus, Receipt as ReceiptIcon, Smartphone, Trash2, Users, X } from 'lucide-react';
import { CustomerPicker } from '@/components/shared/customer-picker';
import { compactNumber, digitsOnly, groupDigits, money } from '@/lib/format';
import { LOW_STOCK } from '@/lib/inventory';
import type { PaymentMethod } from '@/lib/payments';
import { cartCount, cartTotal, changeDue, quickCashAmounts, shortBy, stockLevel } from '@/lib/pos';
import type { CartItem, Customer } from '@/lib/types';

const METHODS: { value: PaymentMethod; label: string; icon: typeof Banknote }[] = [
  { value: 'cash', label: 'Tunai', icon: Banknote },
  { value: 'ewallet', label: 'E-Wallet', icon: Smartphone },
  { value: 'atm', label: 'ATM', icon: CreditCard },
];

export type TicketProps = {
  cart: CartItem[]; customers: Customer[];
  customer: string; note: string; payment: PaymentMethod; paid: string;
  /** `saving`: the sale is being created. `syncing`: stock calls are still on their way, so paying now could sell a portion that is not reserved yet. */
  saving: boolean; syncing: boolean; error: string; hasReceipt: boolean;
  /** Stock still sellable for a product id (already corrected for calls in flight). */
  stockOf: (id: string) => number;
  onCustomer: (id: string) => void; onNote: (value: string) => void; onPayment: (method: PaymentMethod) => void; onPaid: (value: string) => void;
  onPlus: (item: CartItem) => void; onMinus: (item: CartItem) => void; onRemove: (item: CartItem) => void; onClear: () => void;
  onPay: () => void; onDismissError: () => void; onShowReceipt: () => void;
  /** Only given when the ticket is a drawer (below the side-by-side breakpoint). */
  onClose?: () => void;
};

export function Ticket(p: TicketProps) {
  const [meta, setMeta] = useState(false);
  /** "Kosongkan" needs a second tap within 3 s, so an accidental touch cannot wipe the order. */
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(t);
  }, [armed]);
  useEffect(() => { if (!p.cart.length) setArmed(false); }, [p.cart.length]);
  const who = p.customers.find((c) => c.id === p.customer)?.name;
  const total = cartTotal(p.cart), count = cartCount(p.cart);
  const cash = p.payment === 'cash';
  const short = shortBy(p.paid, total), change = changeDue(p.paid, total);
  const typed = p.paid !== '';
  const blocked = !p.cart.length || p.saving || p.syncing || (cash && Number(p.paid || 0) < total);
  const label = p.saving ? 'Memproses…' : p.syncing ? 'Menyimpan stok…' : p.cart.length ? `Bayar ${money(total)}` : 'Bayar';

  return <section className="ks-ticket" aria-label="Pesanan">
    <header className="ks-ticket-head">
      <div className="ks-ticket-title"><h2>Pesanan</h2><p>{count ? `${count} item · ${p.cart.length} menu` : 'Belum ada item'}</p></div>
      <div className="ks-ticket-tools">
        {p.cart.length > 0 && <button type="button" className={`ks-tool danger ${armed ? 'armed' : ''}`} onClick={() => { if (armed) { setArmed(false); p.onClear(); } else setArmed(true); }}><Trash2 size={14} /><span>{armed ? 'Yakin kosongkan?' : 'Kosongkan'}</span></button>}
        {p.hasReceipt && <button type="button" className="ks-tool" onClick={p.onShowReceipt}><ReceiptIcon size={14} /><span>Struk terakhir</span></button>}
        {p.onClose && <button type="button" className="ks-close" aria-label="Tutup pesanan" onClick={p.onClose}><X size={18} /></button>}
      </div>
    </header>

    <div className="ks-lines">
      {p.cart.length ? p.cart.map((item) => {
        const left = p.stockOf(item.id), level = stockLevel(left, LOW_STOCK);
        return <div className="ks-line" key={item.id}>
          <span className="ks-line-img">{item.image_url ? <img src={item.image_url} alt="" /> : <span>🍜</span>}</span>
          <div className="ks-line-info">
            <b>{item.name}</b>
            <small>{money(Number(item.price))}<i aria-hidden="true">·</i><em className={`ks-left ${level}`}>{left <= 0 ? 'Stok habis' : `Sisa ${left}`}</em></small>
          </div>
          <div className="ks-step">
            <button type="button" aria-label={item.qty <= 1 ? `Hapus ${item.name}` : `Kurangi ${item.name}`} onClick={() => (item.qty <= 1 ? p.onRemove(item) : p.onMinus(item))}>{item.qty <= 1 ? <Trash2 size={14} /> : <Minus size={14} />}</button>
            <b>{item.qty}</b>
            <button type="button" aria-label={`Tambah ${item.name}`} disabled={left <= 0} onClick={() => p.onPlus(item)}><Plus size={14} /></button>
          </div>
          <strong className="ks-line-total">{money(Number(item.price) * item.qty)}</strong>
        </div>;
      }) : <div className="ks-empty"><span>🍜</span><b>Belum ada pesanan</b><small>Ketuk menu untuk menambahkannya ke sini.</small></div>}
    </div>

    <div className="ks-tear" aria-hidden="true" />

    <div className="ks-pay">
      <button type="button" className="ks-meta" aria-expanded={meta} onClick={() => setMeta((open) => !open)}>
        <Users size={16} />
        <span><b>{who || 'Pelanggan umum'}</b><small>{p.note ? `Catatan: ${p.note}` : 'Tambah pelanggan atau catatan'}</small></span>
        <ChevronDown size={16} className={meta ? 'up' : ''} />
      </button>
      {meta && <div className="ks-fields">
        <div className="ks-field"><span>Pelanggan</span><CustomerPicker customers={p.customers} value={p.customer} onChange={p.onCustomer} /></div>
        <label className="ks-field"><span>Catatan</span><input value={p.note} maxLength={120} placeholder="Contoh: tanpa pedas" onChange={(e) => p.onNote(e.target.value)} /></label>
      </div>}

      <div className="ks-methods" role="radiogroup" aria-label="Metode pembayaran">
        {METHODS.map(({ value, label: text, icon: Icon }) => <button type="button" role="radio" aria-checked={p.payment === value} key={value} className={p.payment === value ? 'active' : ''} onClick={() => p.onPayment(value)}><Icon size={17} />{text}</button>)}
      </div>

      {cash && <div className="ks-cash">
        <label className="ks-cash-input"><span>Tunai diterima</span>
          <div><i>Rp</i><input inputMode="numeric" autoComplete="off" placeholder="0" value={groupDigits(p.paid)} onChange={(e) => p.onPaid(digitsOnly(e.target.value))} /></div>
        </label>
        <div className="ks-quick">{quickCashAmounts(total).map((amount, i) => <button type="button" key={amount} title={money(amount)} className={Number(p.paid) === amount ? 'on' : ''} onClick={() => p.onPaid(String(amount))}>{i === 0 ? 'Uang pas' : compactNumber(amount)}</button>)}</div>
        <div className={`ks-change ${typed ? (short > 0 ? 'short' : 'ok') : ''}`}><span>{typed && short > 0 ? 'Kurang' : 'Kembalian'}</span><b>{money(typed && short > 0 ? short : change)}</b></div>
      </div>}

      {p.error && <div className="ks-error" role="alert"><AlertCircle size={16} /><span>{p.error}</span><button type="button" aria-label="Tutup pesan" onClick={p.onDismissError}><X size={14} /></button></div>}
    </div>

    <footer className="ks-foot">
      <div className="ks-total"><span>Total</span><strong>{money(total)}</strong></div>
      <button type="button" className="ks-pay-btn" disabled={blocked} onClick={p.onPay}>{p.saving || p.syncing ? <Loader2 size={18} className="ks-spin" /> : <Check size={18} />}{label}</button>
    </footer>
  </section>;
}
