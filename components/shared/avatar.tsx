/** Customer avatar: initial on a gradient that stays the same for the same name everywhere in the app. */
const TONES: [string, string][] = [
  ['#ff7a45', '#ff3d71'],
  ['#7c5cff', '#b79bff'],
  ['#12b886', '#38d9a9'],
  ['#228be6', '#74c0fc'],
  ['#f59f00', '#ff922b'],
  ['#e64980', '#f783ac'],
];

export const avatarTone = (name: string): [string, string] => {
  let h = 0;
  for (const ch of String(name || '?')) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return TONES[h % TONES.length];
};

export function CustomerAvatar({ name, size = 'md' }: { name?: string | null; size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  const label = String(name || '?').trim();
  const [a, b] = avatarTone(label);
  return (
    <span className={`cx-avatar cx-avatar-${size}`} style={{ ['--a' as any]: a, ['--b' as any]: b }} aria-hidden="true">
      {label.slice(0, 1).toUpperCase()}
    </span>
  );
}
