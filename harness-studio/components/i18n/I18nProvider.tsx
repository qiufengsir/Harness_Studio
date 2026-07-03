'use client';

// ============================================================
// I18nProvider — React Context for language switching
// Persists choice to localStorage + cookie (so server components
// can read the same lang via next/headers cookies()).
// ============================================================
import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { Lang, translate, LANGS } from '@/lib/i18n/dictionary';

interface I18nCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  toggle: () => void;
  t: (key: string) => string;
}

const Ctx = createContext<I18nCtx | null>(null);

const STORAGE_KEY = 'hs-lang';
const COOKIE_KEY = 'hs-lang';
const DEFAULT_LANG: Lang = 'zh';

function detectInitialLang(): Lang {
  if (typeof window === 'undefined') return DEFAULT_LANG;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'zh' || stored === 'en') return stored;
  } catch {}
  // Fall back to browser language
  const nav = window.navigator.language?.toLowerCase() ?? '';
  return nav.startsWith('zh') ? 'zh' : 'en';
}

function writeCookie(lang: Lang) {
  if (typeof document === 'undefined') return;
  document.cookie = `${COOKIE_KEY}=${lang}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  // Start with DEFAULT_LANG to keep SSR/CSR markup stable; real value applied in effect.
  const [lang, setLangState] = useState<Lang>(DEFAULT_LANG);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const detected = detectInitialLang();
    setLangState(detected);
    writeCookie(detected);
    setHydrated(true);
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try { window.localStorage.setItem(STORAGE_KEY, l); } catch {}
    writeCookie(l);
  }, []);

  const toggle = useCallback(() => {
    setLang(lang === 'zh' ? 'en' : 'zh');
  }, [lang, setLang]);

  const t = useCallback((key: string) => translate(lang, key), [lang]);

  // Once hydrated, also reflect lang on <html lang> for a11y
  useEffect(() => {
    if (!hydrated) return;
    document.documentElement.lang = lang;
  }, [lang, hydrated]);

  const value = useMemo<I18nCtx>(() => ({ lang, setLang, toggle, t }), [lang, setLang, toggle, t]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18nCtx {
  const ctx = useContext(Ctx);
  if (!ctx) {
    // Safe fallback so non-wrapped components still work
    return {
      lang: DEFAULT_LANG,
      setLang: () => {},
      toggle: () => {},
      t: (k: string) => translate(DEFAULT_LANG, k),
    };
  }
  return ctx;
}

export { LANGS };
