import { Injectable, signal } from '@angular/core';

/**
 * `I18nText` del §3.5: `{ it: string, en?: string }`.
 *
 * In assenza della traduzione si mostra il **testo originale con l'indicazione
 * della lingua**, mai una stringa vuota (`RF-PUB-10`).
 */
export interface I18nText {
  it: string;
  en?: string | null;
}

export type UiLang = 'it' | 'en';

export const UI_LANG_LABEL: Record<UiLang, string> = { it: 'Italiano', en: 'English' };

/** Lingua dell'interfaccia: IT + EN dal giorno uno (§5). */
@Injectable({ providedIn: 'root' })
export class LocaleService {
  private static readonly KEY = 'mirada.uiLang';
  private readonly _lang = signal<UiLang>(readStoredLang());
  readonly lang = this._lang.asReadonly();

  set(lang: UiLang): void {
    this._lang.set(lang);
    try {
      localStorage.setItem(LocaleService.KEY, lang);
    } catch {
      /* storage non disponibile: la scelta vale per la sessione corrente */
    }
  }

  toggle(): void {
    this.set(this._lang() === 'it' ? 'en' : 'it');
  }
}

function readStoredLang(): UiLang {
  try {
    return localStorage.getItem('mirada.uiLang') === 'en' ? 'en' : 'it';
  } catch {
    return 'it';
  }
}

export interface ResolvedI18n {
  /** Il testo da mostrare. Mai vuoto se almeno una lingua è valorizzata. */
  text: string;
  /** La lingua di ciò che si sta effettivamente mostrando. */
  lang: UiLang;
  /**
   * `true` quando la traduzione nella lingua richiesta manca e si sta
   * mostrando l'originale: l'interfaccia deve **dichiarare la lingua**.
   */
  fallback: boolean;
}

/**
 * Risolve un `I18nText` nella lingua richiesta. Se la traduzione manca torna
 * l'originale marcato `fallback`, così il chiamante può mostrare l'indicazione
 * della lingua accanto al testo.
 */
export function resolveI18n(
  value: I18nText | null | undefined,
  lang: UiLang = 'it',
): ResolvedI18n | null {
  if (!value) return null;
  const it = (value.it ?? '').trim();
  const en = (value.en ?? '').trim();

  if (lang === 'en') {
    if (en) return { text: en, lang: 'en', fallback: false };
    if (it) return { text: it, lang: 'it', fallback: true };
    return null;
  }

  if (it) return { text: it, lang: 'it', fallback: false };
  if (en) return { text: en, lang: 'en', fallback: true };
  return null;
}

/** Testo semplice, per titoli e tooltip dove non c'è spazio per il marcatore. */
export function i18nPlain(
  value: I18nText | null | undefined,
  lang: UiLang = 'it',
  empty = '—',
): string {
  const resolved = resolveI18n(value, lang);
  if (!resolved) return empty;
  return resolved.fallback ? `${resolved.text} (${resolved.lang.toUpperCase()})` : resolved.text;
}

/** Costruisce un `I18nText` da due campi di form, omettendo la seconda lingua vuota. */
export function buildI18n(it: string, en?: string | null): I18nText {
  const trimmedEn = (en ?? '').trim();
  return trimmedEn ? { it: it.trim(), en: trimmedEn } : { it: it.trim() };
}

/** Legge un valore che il backend restituisce come `Json`. */
export function asI18n(value: unknown): I18nText | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const it = typeof record['it'] === 'string' ? (record['it'] as string) : '';
  const en = typeof record['en'] === 'string' ? (record['en'] as string) : undefined;
  if (!it && !en) return null;
  return { it, en };
}
