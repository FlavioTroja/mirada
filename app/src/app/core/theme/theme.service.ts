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
 * Tema dell'interfaccia — `data-theme` su `<html>`, letto da `src/styles.scss`.
 *
 * Il tema **scuro** è quello di marca, ereditato dalla wall (`RF-WALL-31`): per
 * la proiezione in sala non è una scelta estetica ma di sicurezza. Il tema
 * **chiaro** esiste per il back-office, che si usa di giorno e spesso su
 * schermi non calibrati.
 *
 * Senza attributo vale lo scuro, quindi una pagina che si carica prima che
 * Angular parta non lampeggia mai in bianco.
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
      /* matchMedia non disponibile: resta il tema scuro */
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
    return v === 'light' || v === 'dark' || v === 'auto' ? v : 'auto';
  } catch {
    return 'auto';
  }
}

function systemPrefersLight(): boolean {
  try {
    return window.matchMedia('(prefers-color-scheme: light)').matches;
  } catch {
    return false;
  }
}
