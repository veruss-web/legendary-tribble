/**
 * The Mieflow websites: the central e-commerce site and its branches.
 * Pure data + helpers (no React / browser imports), so they are unit-tested. The cards live in components/screens/settings.tsx.
 */
export type BranchId = 'pusat' | 'cabang-1' | 'cabang-2';

export type Branch = { id: BranchId; name: string; note: string; url: string };

export const BRANCHES: Branch[] = [
  { id: 'pusat', name: 'E-Commerce Pusat', note: 'Website pusat', url: 'https://legendary-tribble-eta.vercel.app/' },
  { id: 'cabang-1', name: 'Cabang 1', note: 'Website cabang pertama', url: 'https://fictional-octo-tribble-delta.vercel.app/' },
  { id: 'cabang-2', name: 'Cabang 2', note: 'Website cabang kedua', url: 'https://expert-system-azure.vercel.app/' },
];

/** "https://expert-system-azure.vercel.app/" -> "expert-system-azure.vercel.app". Returns '' for anything that is not a URL. */
export const hostOf = (url: unknown): string => {
  try {
    return new URL(String(url ?? '')).hostname.toLowerCase();
  } catch {
    return '';
  }
};

/** The branch whose website is open right now (`window.location.hostname`), or null (localhost, a custom domain, ...). */
export function currentBranch(hostname: unknown, branches: Branch[] = BRANCHES): Branch | null {
  const host = String(hostname ?? '').trim().toLowerCase();
  if (!host) return null;
  return branches.find((b) => hostOf(b.url) === host) || null;
}
