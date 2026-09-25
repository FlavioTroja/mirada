import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { ActivityKind, ActivityRow } from '../../core/domain/dashboard-today';
import { minutesText } from './dashboard-text';

type FeedFilter = 'ALL' | 'CHECK_IN' | 'REGISTRATION' | 'PAYMENT' | 'CALENDAR';

const FILTERS: { key: FeedFilter; label: string }[] = [
  { key: 'ALL', label: 'Tutto' },
  { key: 'CHECK_IN', label: 'Ingressi' },
  { key: 'REGISTRATION', label: 'Iscrizioni' },
  { key: 'PAYMENT', label: 'Incassi' },
  { key: 'CALENDAR', label: 'Calendario' },
];

const KIND_LABEL: Record<ActivityKind, string> = {
  CHECK_IN: 'Ingresso',
  REGISTRATION: 'Iscrizione',
  PAYMENT: 'Incasso',
  CALENDAR: 'Calendario',
  PROSPECT: 'Open day',
};

/** Il prospect sta con le iscrizioni: è una persona che potrebbe iscriversi. */
const KIND_FILTER: Record<ActivityKind, FeedFilter> = {
  CHECK_IN: 'CHECK_IN',
  REGISTRATION: 'REGISTRATION',
  PROSPECT: 'REGISTRATION',
  PAYMENT: 'PAYMENT',
  CALENDAR: 'CALENDAR',
};

const COLOR: Record<FeedFilter, string> = { ALL: '', CHECK_IN: 's1', REGISTRATION: 's2', PAYMENT: 's3', CALENDAR: 's4' };

const LETTER: Record<ActivityKind, string> = { CHECK_IN: '→', REGISTRATION: '+', PROSPECT: '?', PAYMENT: '€', CALENDAR: '▦' };

/**
 * **In tempo reale**: la colonna della Dashboard (`21-dashboard.md` §4), come
 * il centro notifiche. Ogni riga d'attività con il suo colore, filtrabile; le
 * righe arrivate dopo l'apertura scivolano dentro una volta sola.
 */
@Component({
  selector: 'app-dashboard-feed',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <aside class="feed" aria-label="Attività in tempo reale">
      <div class="feed-head">
        <h3>In tempo reale <span class="w-sub">ultime 24 ore</span></h3>
        <div class="filters" role="group" aria-label="Filtra le attività">
          @for (f of filters; track f.key) {
            <button type="button" [attr.aria-pressed]="filter() === f.key" (click)="filter.set(f.key)">
              @if (f.key !== 'ALL') { <i [class]="'dot ' + color(f.key)"></i> }
              {{ f.label }}
            </button>
          }
        </div>
      </div>
      <div class="feed-list" aria-live="polite">
        @for (row of visibleFeed(); track row.id) {
          <article class="fi" [class.fresh]="fresh().has(row.id)">
            <span [class]="'av ' + color(kindFilter(row.kind))" aria-hidden="true">{{ letter(row.kind) }}</span>
            <div>
              <div class="top"><b>{{ kindLabel(row.kind) }}</b><span>{{ ago(row.createdAt) }}</span></div>
              <p>{{ row.actorName ? row.actorName + ' · ' : '' }}{{ row.text }}</p>
              @if (row.severity !== 'INFO') {
                <span class="status-tag" [class.crit]="row.severity === 'CRITICAL'">{{ row.severity === 'CRITICAL' ? '! da risolvere' : '• da seguire' }}</span>
              }
            </div>
          </article>
        } @empty {
          <p class="sub pad">Niente di questo tipo nelle ultime 24 ore.</p>
        }
      </div>
    </aside>
  `,
  styles: [
    `
      :host {
        display: block;
        --s1: #7a3a9e; --s2: #1baf7a; --s3: #eb6834; --s4: #2a78d6;
        --crit: #b2261e; --crit-soft: #fdecea; --warn: #8a5a00; --warn-soft: #fff4dc;
        --soft: rgba(var(--text-rgb), 0.06); --line: var(--color-default-border);
      }
      :host-context([data-theme='dark']) {
        --s1: #a974d0; --s2: #199e70; --s3: #d95926; --s4: #3987e5;
        --crit: #ff8a80; --crit-soft: rgba(255, 138, 128, 0.12); --warn: #f2c14e; --warn-soft: rgba(242, 193, 78, 0.12);
      }
      .s1 { --c: var(--s1); } .s2 { --c: var(--s2); } .s3 { --c: var(--s3); } .s4 { --c: var(--s4); }
      .dot { width: 9px; height: 9px; border-radius: 50%; display: inline-block; flex: none; background: var(--c); }
      .w-sub { font-size: 12px; font-weight: 400; opacity: 0.65; }
      .sub { font-size: 12.5px; opacity: 0.7; margin: 0; }
      .feed {
        background: rgb(var(--foreground-color)); border: 1px solid var(--line); border-radius: 22px; box-shadow: var(--keijo-shadow-md);
        display: flex; flex-direction: column; min-height: 0; max-height: calc(100vh - 110px); position: sticky; top: 12px;
      }
      @media (max-width: 1100px) { .feed { position: static; max-height: 640px; } }
      .feed-head { padding: 16px 16px 10px; display: grid; gap: 10px; border-bottom: 1px solid var(--line); }
      .feed-head h3 { margin: 0; font-size: 16px; font-weight: 600; display: flex; justify-content: space-between; align-items: center; gap: 8px; }
      .filters { display: flex; gap: 6px; flex-wrap: wrap; }
      .filters button {
        border: 1px solid var(--mirada-control-border); background: transparent; color: inherit; border-radius: 999px;
        padding: 4px 10px; font: inherit; font-size: 12px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;
      }
      .filters button[aria-pressed='true'] { background: rgb(var(--text-rgb)); color: rgb(var(--background-color)); border-color: transparent; }
      :host-context([data-theme='dark']) .filters button[aria-pressed='true'] { color: #170b1e; }
      .feed-list { overflow-y: auto; padding: 8px; display: grid; gap: 6px; align-content: start; }
      .fi { display: grid; grid-template-columns: 34px minmax(0, 1fr); gap: 10px; padding: 10px; border-radius: 16px; background: var(--soft); }
      .fi.fresh { animation: slide 0.45s ease; }
      @keyframes slide { from { transform: translateY(-8px); opacity: 0.3; } to { transform: none; opacity: 1; } }
      .av { width: 34px; height: 34px; border-radius: 11px; display: grid; place-items: center; color: #fff; font-weight: 700; font-size: 13px; background: var(--c); }
      :host-context([data-theme='dark']) .av { color: #170b1e; }
      .fi .top { display: flex; justify-content: space-between; gap: 8px; font-size: 11.5px; opacity: 0.8; }
      .fi .top b { font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; font-size: 10.5px; }
      .fi p { font-size: 13px; line-height: 1.4; margin: 2px 0 0; }
      .fi .status-tag { display: inline-flex; font-size: 11px; font-weight: 600; border-radius: 999px; padding: 1px 7px; margin-top: 5px; background: var(--warn-soft); color: var(--warn); }
      .fi .status-tag.crit { background: var(--crit-soft); color: var(--crit); }
      .pad { padding: 12px; }
      @media (prefers-reduced-motion: reduce) { .fi.fresh { animation: none; } }
    `,
  ],
})
export class DashboardFeedComponent {
  readonly rows = input.required<ActivityRow[]>();
  readonly fresh = input<Set<number>>(new Set());
  /** L'ora corrente, dalla pagina: «2 min fa» si aggiorna con lei. */
  readonly now = input.required<Date>();

  readonly filters = FILTERS;
  readonly filter = signal<FeedFilter>('ALL');

  readonly visibleFeed = computed(() => {
    const filter = this.filter();
    return this.rows().filter((row) => filter === 'ALL' || KIND_FILTER[row.kind] === filter);
  });

  kindLabel(kind: ActivityKind): string {
    return KIND_LABEL[kind];
  }

  kindFilter(kind: ActivityKind): FeedFilter {
    return KIND_FILTER[kind];
  }

  color(filter: FeedFilter): string {
    return COLOR[filter];
  }

  letter(kind: ActivityKind): string {
    return LETTER[kind];
  }

  ago(value: string): string {
    const ms = this.now().getTime() - new Date(value).getTime();
    return ms < 90_000 ? 'adesso' : minutesText(ms, 'fa');
  }
}
