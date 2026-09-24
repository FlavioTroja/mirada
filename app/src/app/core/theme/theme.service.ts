import { Injectable, computed, signal } from '@angular/core';

/**
 * I due temi dell'interfaccia.
 *
 * `auto` non è un terzo tema: è «segui il sistema». Viene risolto in `dark` o
 * `light` al momento dell'applicazione, e resta reattivo se l'utente cambia
 * l'impostazione del sistema operativo mentre l'app è aperta.
 */
export type ThemeChoice = 'auto' | 'dark' | 'light';
export type ResolvedTheme = 'dark' | 'light';

const KEY = 'mirada.theme';

/**
 * **Il tema di partenza è il chiaro**, non «segui il sistema».
 *
 * Dal 24 settembre 2026 l'identità è quella di slesh.it (`shared/mirada-theme.scss`):
 * superfici chiare, prugna e viola. Chi apre Mirada per la prima volta deve
 * vedere il prodotto com'è pensato, non come il suo sistema operativo lo
 * interpreta. `auto` resta disponibile come scelta **esplicita**.
 *
 * Chi aveva già scelto un tema lo ritrova: la scelta vive in `localStorage`, e
 * questo valore vale solo per chi non ha mai scelto.
 */
const DEFAULT_CHOICE: ThemeChoice = 'light';

/**
 * Tema dell'interfaccia — `data-theme` su `<html>`, letto da `src/styles.scss`.
 *
 * Il **chiaro** è quello di marca. Lo **scuro**, prugna e viola, resta per chi
 * lavora di sera e per la wall (`RF-WALL-31`), dove in sala buia non è una
 * scelta estetica ma di sicurezza.
 *
 * Senza attributo vale il chiaro, come `index.html`.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly _choice = signal<ThemeChoice>(readStored());
  private readonly _systemPrefersLight = signal(systemPrefersLight());

  /** La scelta dell'utente, `auto` compreso. */
  readonly choice = this._choice.asReadonly();

  /** Il tema effettivamente applicato: `auto` è già risolto. */
  readonly resolved = computed<ResolvedTheme>(() =>
    this._choice() === 'auto' ? (this._systemPrefersLight() ? 'light' : 'dark') : (this._choice() as ResolvedTheme),
  );

  constructor() {
    // Il cambio di impostazione del sistema si riflette subito, ma **solo**
    // quando la scelta è `auto`: se l'utente ha scelto esplicitamente, la sua
    // scelta vince sempre.
    try {
      const mq = window.matchMedia('(prefers-color-scheme: light)');
      mq.addEventListener('change', (e) => {
        this._systemPrefersLight.set(e.matches);
        this.apply();
      });
    } catch {
      /* matchMedia non disponibile: resta la scelta salvata o il chiaro */
    }
    this.apply();
  }

  set(choice: ThemeChoice): void {
    this._choice.set(choice);
    try {
      localStorage.setItem(KEY, choice);
    } catch {
      /* storage non disponibile: la scelta vale per la sessione corrente */
    }
    this.apply();
  }

  /** Alterna fra i due temi espliciti, uscendo da `auto`. */
  toggle(): void {
    this.set(this.resolved() === 'dark' ? 'light' : 'dark');
  }

  private apply(): void {
    const theme = this.resolved();
    document.documentElement.setAttribute('data-theme', theme);
    // `color-scheme` sull'elemento radice governa i widget nativi che non
    // passano dal CSS — barre di scorrimento, selettori di data, autofill.
    document.documentElement.style.colorScheme = theme;
  }
}

function readStored(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' || v === 'auto' ? v : DEFAULT_CHOICE;
  } catch {
    return DEFAULT_CHOICE;
  }
}

function systemPrefersLight(): boolean {
  try {
    return window.matchMedia('(prefers-color-scheme: light)').matches;
  } catch {
    return false;
  }
}
