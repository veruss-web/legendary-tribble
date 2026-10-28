/** Methods a cashier can choose in Kasir. */
export type PaymentMethod = 'cash' | 'ewallet' | 'atm';

/** Payment-method labels shared by Riwayat Transaksi, the order detail and the receipt. Older orders may still hold the legacy values `qris` / `card`. */
export const paymentLabel = (method: string) =>
  method === 'cash' ? 'Tunai' : method === 'qris' || method === 'ewallet' ? 'E-Wallet' : method === 'card' || method === 'atm' ? 'ATM' : String(method || '').toUpperCase();

/** CSS tone class of the payment chip (`.transaction-payment.<tone>`). */
export const paymentTone = (method: string) =>
  method === 'cash' ? 'cash' : method === 'qris' || method === 'ewallet' ? 'qris' : method === 'card' || method === 'atm' ? 'card' : 'ewallet';
