import { createRequire } from 'node:module';
import { join } from 'node:path';

/** Loads a module compiled by scripts/run-tests.mjs, e.g. load('lib/customers'). */
export const load = (name) => createRequire(import.meta.url)(join(process.env.MIEFLOW_BUILD, `${name}.js`));

export const order = (id, customer_id, status = 'completed') => ({ id, customer_id, status });
export const item = (order_id, product_id, product_name, quantity) => ({ order_id, product_id, product_name, quantity });
export const product = (id, name) => ({ id, name });
