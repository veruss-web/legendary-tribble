/** Shared domain types (Supabase rows as the UI consumes them). */
export type Page='Overview'|'POS'|'Orders'|'Analytics'|'Products'|'Categories'|'Customers'|'Inventory'|'Settings';

export type Category={id:string;name:string;color:string;created_at?:string;owner_id?:string};

export type Product={id:string;name:string;description:string|null;price:number;stock:number;image_url:string|null;category_id:string|null;is_active:boolean;owner_id?:string;categories?:Category|null};

/** Validated values of the product form (numbers already parsed); what Dashboard writes to Supabase. */
export type ProductInput={name:string;description:string;price:number;stock:number;image_url:string|null;category_id:string|null;is_active:boolean};

export type Customer={id:string;name:string;phone:string|null;email:string|null;notes:string|null;owner_id?:string};

export type Order={id:string;order_number:string;customer_id?:string|null;status:string;payment_method:string;subtotal:number;discount:number;total:number;amount_paid:number;change_due:number;notes?:string|null;created_at:string;owner_id?:string;customers?:Customer|null};

export type OrderItem={id:string;order_id:string;product_id?:string|null;product_name:string;quantity:number;unit_price:number;line_total:number;owner_id?:string};

export type CartItem=Product&{qty:number};

/** What Kasir keeps after a successful sale: the create_sale result plus the cart that was paid. */
export type Receipt={id?:string;order_number?:string;customer_id:string|null;payment_method:string;notes:string|null;created_at:string;items:CartItem[];subtotal?:number;total?:number;amount_paid?:number;change_due?:number};

export type AppNotification={id:string;type:'danger'|'warning'|'success'|'info';title:string;detail:string;time:string;page:Page;targetId?:string|null;is_read?:boolean;created_at?:string};

export type CustomerTarget={name:string;qty:number};
