/** Pure helpers for the product form: money field, draft <-> input conversion and validation (unit-tested in tests/products.test.mjs). */
import type { Product, ProductInput } from '@/lib/types';
export { digitsOnly, groupDigits } from './format';

/** Column limits from supabase/schema.sql: price numeric(12,2), stock integer. */
export const MAX_MONEY_DIGITS = 10;
export const MAX_STOCK_DIGITS = 9;
export const MAX_NAME = 80;
export const MAX_DESCRIPTION = 200;

/** Everything the form edits, as the strings the inputs hold. */
export type ProductDraft = {name:string;description:string;price:string;stock:string;image_url:string|null;category_id:string;is_active:boolean};
export type ProductErrors = Partial<Record<'name'|'price'|'stock',string>>;

export const emptyDraft = (): ProductDraft => ({name:'',description:'',price:'',stock:'0',image_url:null,category_id:'',is_active:true});

export const draftFromProduct = (p: Product|null): ProductDraft => !p ? emptyDraft() : {
  name:p.name, description:p.description??'', price:String(Math.round(Number(p.price)||0)),
  stock:String(Math.max(0,Math.floor(Number(p.stock)||0))), image_url:p.image_url||null, category_id:p.category_id??'', is_active:p.is_active,
};

/** Single validation point for the form: returns the parsed input and, when something is wrong, one message per field. */
export function parseDraft(d: ProductDraft): {input: ProductInput; errors: ProductErrors} {
  const errors: ProductErrors = {};
  const name = d.name.trim();
  if (name.length < 2) errors.name = 'Nama produk minimal 2 karakter.';
  if (d.price === '') errors.price = 'Harga jual wajib diisi.';
  const price = Number(d.price||0), stock = Math.floor(Number(d.stock||0));
  if (!Number.isFinite(price) || price < 0) errors.price = 'Harga jual tidak valid.';
  if (!Number.isFinite(stock) || stock < 0) errors.stock = 'Stok tidak valid.';
  return {
    errors,
    input: {name, description:d.description.trim(), price, stock, image_url:d.image_url||null, category_id:d.category_id||null, is_active:d.is_active},
  };
}
