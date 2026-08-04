// keijo-ui: scaffolded — do not remove this marker if you intend to re-run ng add
import { Injectable, Signal, inject, signal } from '@angular/core';
import { NavigationStart, Router } from '@angular/router';
import { filter } from 'rxjs/operators';
import { HeaderActionButton } from '@keijo/ui';

/** A header action descriptor plus the callback to run when it is clicked. */
export interface PageAction extends HeaderActionButton {
  run: () => void;
}

/**
 * Header actions channel. Entity/primary page actions (Nuovo / Salva / Esporta…)
 * live in the header, not in the page (`KEIJO-ENTITY-ACTIONS-IN-HEADER`). A page
 * registers them here; the shell renders them in `<keijo-header [buttons]>`.
 *
 * Ordering follows the header contract: `buttons[0]` is the primary (rightmost,
 * labelled, single word); any others are icon-only. Auto-cleared on navigation.
 *
 * Framework plumbing (signal-based) — not domain state, so it stays signal-based
 * regardless of the project's chosen state pattern.
 */
@Injectable({ providedIn: 'root' })
export class PageActionsService {
  private readonly _actions = signal<PageAction[]>([]);
  readonly actions: Signal<PageAction[]> = this._actions.asReadonly();

  constructor() {
    inject(Router)
      .events.pipe(filter((e): e is NavigationStart => e instanceof NavigationStart))
      .subscribe(() => this._actions.set([]));
  }

  /** Register the current page's header action(s). */
  set(actions: PageAction[]): void {
    this._actions.set(actions);
  }

  clear(): void {
    this._actions.set([]);
  }
}
