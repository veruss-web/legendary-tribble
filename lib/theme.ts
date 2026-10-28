/** Light / dark / system theme: pure helpers (unit-tested) plus the few DOM calls that apply a theme. */
export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'mieflow-theme';

/** Anything that is not a known mode (missing, corrupted, old value) falls back to light. */
export const parseThemeMode = (raw: unknown): ThemeMode => (raw === 'dark' || raw === 'system' || raw === 'light' ? raw : 'light');

export const resolveTheme = (mode: ThemeMode, systemPrefersDark: boolean): ResolvedTheme =>
  mode === 'system' ? (systemPrefersDark ? 'dark' : 'light') : mode;

export const readStoredTheme = (): ThemeMode => {
  try {
    return parseThemeMode(window.localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return 'light';
  }
};

export const storeTheme = (mode: ThemeMode) => {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    /* private mode / storage disabled: the choice just lasts for this session */
  }
};

export const systemPrefersDark = (): boolean => {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return false;
  }
};

/** Puts the theme on <html>: `.dark` drives the dark stylesheet, color-scheme styles native controls and scrollbars. */
export function applyTheme(resolved: ResolvedTheme) {
  const root = document.documentElement;
  const dark = resolved === 'dark';
  if (root.classList.contains('dark') !== dark) {
    // short cross-fade only when the theme really changes (not on first paint)
    root.classList.add('theme-switching');
    window.setTimeout(() => root.classList.remove('theme-switching'), 420);
  }
  root.classList.toggle('dark', dark);
  root.dataset.theme = resolved;
  root.style.colorScheme = resolved;
}

/**
 * Inline script for <head>: applies the saved theme before the first paint so a dark-mode user never sees a white flash.
 * Keep in sync with THEME_STORAGE_KEY / resolveTheme above.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var m=localStorage.getItem('${THEME_STORAGE_KEY}');var d=m==='dark'||(m==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);var r=document.documentElement;if(d)r.classList.add('dark');r.dataset.theme=d?'dark':'light';r.style.colorScheme=d?'dark':'light'}catch(e){}})();`;
