/** Sidebar items and page titles/descriptions. */
import { BarChart3, Box, LayoutDashboard, Package, ShoppingBag, Tags, Users, WalletCards } from 'lucide-react';
import type { Page } from '@/lib/types';

export const nav:[string,Page,any][]= [['Overview','Overview',LayoutDashboard],['Kasir','POS',ShoppingBag],['Riwayat Transaksi','Orders',WalletCards],['Analisa','Analytics',BarChart3],['Produk','Products',Package],['Kategori','Categories',Tags],['Pelanggan','Customers',Users],['Inventory','Inventory',Box]];

export function pageTitle(p:Page){return ({Overview:'Dashboard',POS:'Kasir',Orders:'Riwayat Transaksi',Analytics:'Analisa',Products:'Produk',Categories:'Kategori',Customers:'Pelanggan',Inventory:'Inventory',Settings:'Pengaturan'} as any)[p]}

export function pageDescription(p:Page){return ({Overview:'Pusat kendali penjualan, stok, pelanggan, dan performa toko.',POS:'Kasir premium untuk transaksi cepat, rapi, dan aman.',Orders:'Riwayat seluruh transaksi yang tersimpan di Supabase.',Analytics:'Analisa omzet, transaksi, jam sibuk, dan performa produk.',Products:'Kelola menu, harga, stok, foto, dan status produk.',Categories:'Atur kategori menu agar katalog lebih rapi.',Customers:'Database pelanggan lengkap dengan kontak dan catatan.',Inventory:'Pantau stok dan lakukan penyesuaian dengan cepat.',Settings:'Pengaturan operasional toko.'} as any)[p]}
