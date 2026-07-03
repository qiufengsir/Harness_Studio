// ============================================================
// Server-side i18n helpers — read lang from cookies() for RSC
// ============================================================
import { cookies } from 'next/headers';
import { Lang, translate, DICT } from './dictionary';

export const DEFAULT_LANG: Lang = 'zh';

export async function getServerLang(): Promise<Lang> {
  try {
    const store = await cookies();
    const v = store.get('hs-lang')?.value;
    if (v === 'zh' || v === 'en') return v;
  } catch {}
  return DEFAULT_LANG;
}

export function tFor(lang: Lang, key: string): string {
  return translate(lang, key);
}

export function pickLang<T>(lang: Lang, zh: T, en: T): T {
  return lang === 'zh' ? zh : en;
}

export { DICT };
