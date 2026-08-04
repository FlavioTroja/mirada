// keijo-ui: scaffolded — do not remove this marker if you intend to re-run ng add
import { Injectable, Signal, inject, signal } from '@angular/core';
import { NavigationStart, Router } from '@angular/router';
import { filter } from 'rxjs/operators';

/**
 * Header title channel. A page declares the title shown in `<keijo-header>`.
 *
 * On a detail route (e.g. `/soci/:id`) this MUST be the entity **type name**
 * (`'Socio'`), never the `:id` and never the instance name
 * (`KEIJO-DETAIL-HEADER-TITLE-NEVER-ID`). The title is auto-cleared on every
 * navigation, so a page that doesn't set one falls back to the shell's
 * route-derived title.
 *
 * Framework plumbing (signal-based) — not domain state, so it stays signal-based
 * regardless of the project's chosen state pattern.
 */
@Injectable({ providedIn: 'root' })
export class HeaderTitleService {
  private readonly _title = signal<string | null>(null);
  readonly title: Signal<string | null> = this._title.asReadonly();

  constructor() {
    inject(Router)
      .events.pipe(filter((e): e is NavigationStart => e instanceof NavigationStart))
      .subscribe(() => this._title.set(null));
  }

  /** Declare the current page's header title (every page should call this). */
  set(title: string): void {
    this._title.set(title);
  }

  clear(): void {
    this._title.set(null);
  }
}
