import { DOCUMENT, Injectable, PLATFORM_ID, afterNextRender, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export type ThemeChoice = 'auto' | 'dark' | 'light';

/**
 * **Il tema di partenza è lo scuro**, non «segui il sistema»: è il tema di
 * marca, e una scheda evento vista per la prima volta deve avere l'aspetto che
 * l'organizzatore si aspetta. `auto` resta una scelta esplicita.
 */
const DEFAULT_CHOICE: ThemeChoice = 'dark';
export type ResolvedTheme = 'dark' | 'light';

const KEY = 'mirada.theme';

/**
 * Tema dell'interfaccia — `data-theme` su `<html>`, letto da
 * `shared/mirada-theme.scss`. Senza attributo vale lo **scuro**, quindi una
 * pagina servita dal server non lampeggia mai in bianco prima dell'idratazione.
 *
 * **SSR.** `localStorage` e `matchMedia` non esistono sul server: la lettura
 * della preferenza e l'ascolto del sistema avvengono in `afterNextRender`, che
 * sul server non viene eseguito. Il marcatore reso dal server porta sempre il
 * tema scuro, che è quello di marca.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly doc = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly _choice = signal<ThemeChoice>(DEFAULT_CHOICE);
  private readonly _systemPrefersLight = signal(false);

  readonly choice = this._choice.asReadonly();
  readonly resolved = computed<ResolvedTheme>(() =>
    this._choice() === 'auto'
      ? this._systemPrefersLight()
        ? 'light'
        : 'dark'
      : (this._choice() as ResolvedTheme),
  );

  constructor() {
    afterNextRender(() => {
      this._choice.set(this.readStored());
      const mq = this.doc.defaultView?.matchMedia?.('(prefers-color-scheme: light)');
      if (mq) {
        this._systemPrefersLight.set(mq.matches);
        mq.addEventListener('change', (e) => {
          this._systemPrefersLight.set(e.matches);
          this.apply();
        });
      }
      this.apply();
    });
  }

  set(choice: ThemeChoice): void {
    this._choice.set(choice);
    if (this.isBrowser) {
      try {
        localStorage.setItem(KEY, choice);
      } catch {
        /* storage non disponibile: la scelta vale per la sessione corrente */
      }
    }
    this.apply();
  }

  /** Alterna fra i due temi espliciti, uscendo da `auto`. */
  toggle(): void {
    this.set(this.resolved() === 'dark' ? 'light' : 'dark');
  }

  private apply(): void {
    if (!this.isBrowser) return;
    const theme = this.resolved();
    const root = this.doc.documentElement;
    root.setAttribute('data-theme', theme);
    root.style.colorScheme = theme;
  }

  private readStored(): ThemeChoice {
    try {
      const v = localStorage.getItem(KEY);
      return v === 'light' || v === 'dark' || v === 'auto' ? v : DEFAULT_CHOICE;
    } catch {
      return DEFAULT_CHOICE;
    }
  }
}
