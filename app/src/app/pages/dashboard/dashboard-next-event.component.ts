import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DashboardToday } from '../../core/domain/dashboard-today';
import {
  CapacitySection,
  CommittedSection,
  RegistrationsByRole,
  Section,
  isAvailable,
} from '../../core/domain/dashboard';
import { LOCALE, TIMEZONE } from '../../core/i18n/format';
import { LocaleService, i18nPlain } from '../../core/i18n/i18n-text';

const RING = 2 * Math.PI * 52;
const dayFmt = new Intl.DateTimeFormat(LOCALE, { timeZone: TIMEZONE, weekday: 'long', day: 'numeric', month: 'long' });

type NextEvent = NonNullable<DashboardToday['nextEvent']>;

/**
 * **Prossimo evento**, nella Dashboard (`21-dashboard.md` §3): conto alla
 * rovescia, sala impegnata, impegnato per titolo, equilibrio dei ruoli. I numeri
 * vengono dal cruscotto dell'evento, lo stesso della vista «Evento».
 */
@Component({
  selector: 'app-dashboard-next-event',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    @let ev = event();
    <section class="w" aria-label="Prossimo evento">
      <div class="event-top">
        <div>
          <span class="w-title">{{ started() ? 'Evento in corso' : 'Prossimo evento' }}</span>
          <h3>{{ i18n(ev.title) }}</h3>
          <p class="sub">{{ eventDates() }}</p>
        </div>
        <div class="event-actions">
          @if (started()) {
            <span class="running">In corso</span>
          } @else {
            <div class="countdown" [attr.aria-label]="countdownLabel()">
              <div><b class="num">{{ countdown().days }}</b><span>giorni</span></div>
              <div><b class="num">{{ countdown().hours }}</b><span>ore</span></div>
            </div>
          }
          <a class="w-link" routerLink="/dashboard/event" [queryParams]="{ id: ev.id }">Apri la vista evento</a>
        </div>
      </div>
      <div class="grid inner">
        <div class="span-4 cap">
          @if (room(); as r) {
            <div class="gauge" role="img" [attr.aria-label]="r.consumed + ' posti impegnati su ' + r.limit">
              <svg viewBox="0 0 128 128"><circle class="ring-bg soft" cx="64" cy="64" r="52" /><circle class="ring-fg s1" cx="64" cy="64" r="52" [attr.stroke-dasharray]="ring" [attr.stroke-dashoffset]="ringOffset(r.consumed, r.limit)" /></svg>
              <div class="gauge-label"><div><b class="num">{{ r.consumed }}</b><br /><span>su {{ r.limit }} posti</span></div></div>
            </div>
            <p class="sub">{{ percent(r.consumed, r.limit) }}% della sala impegnata.</p>
          } @else {
            <p class="sub">La sala non ha una capienza impostata.</p>
          }
        </div>
        <div class="span-4 tt" aria-label="Impegnato per titolo">
          @for (line of committed(); track line.ticketTypeId) {
            <div class="tt-row">
              <span class="name">{{ i18n(line.name) }}</span>
              <span class="val num">{{ line.committed ?? 0 }}{{ line.limit ? ' / ' + line.limit : '' }}</span>
              <span class="meter"><span [style.width.%]="line.limit ? percent(line.committed ?? 0, line.limit) : 0"></span></span>
            </div>
          } @empty {
            <p class="sub">Nessun titolo d'ingresso ancora.</p>
          }
        </div>
        <div class="span-4 roles">
          @if (roles(); as r) {
            <span class="roles-title">Equilibrio dei ruoli</span>
            <div class="roles-bar" aria-hidden="true">
              <span class="s1" [style.width.%]="share(r.leader, r.leader + r.follower)"></span>
              <span class="s2" [style.width.%]="share(r.follower, r.leader + r.follower)"></span>
            </div>
            <div class="roles-legend">
              <span><i class="dot s1"></i><b class="num">{{ r.leader }}</b> leader</span>
              <span><b class="num">{{ r.follower }}</b> follower<i class="dot s2"></i></span>
            </div>
            <span class="sub">{{ balanceText(r) }}</span>
          }
        </div>
      </div>
    </section>
  `,
  styles: [
    `
      :host { display: block; --s1: #7a3a9e; --s2: #1baf7a; --soft: rgba(var(--text-rgb), 0.06); }
      :host-context([data-theme='dark']) { --s1: #a974d0; --s2: #199e70; }
      .num { font-variant-numeric: tabular-nums; }
      .s1 { --c: var(--s1); } .s2 { --c: var(--s2); }
      .w {
        background: rgb(var(--foreground-color)); border: 1px solid var(--color-default-border); border-radius: 22px; padding: 18px;
        box-shadow: var(--keijo-shadow-md); display: flex; flex-direction: column; gap: 12px;
      }
      .w-title { font-size: 12px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; opacity: 0.7; }
      .w-link { font-size: 12.5px; font-weight: 600; color: var(--color-accent); text-decoration: none; white-space: nowrap; }
      .w-link:hover { text-decoration: underline; }
      .sub { font-size: 12.5px; opacity: 0.7; margin: 0; }
      .grid { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: 18px; }
      .span-4 { grid-column: span 4; }
      @media (max-width: 860px) { .span-4 { grid-column: span 12; } }
      .gauge { position: relative; width: 128px; height: 128px; flex: none; }
      .gauge svg { width: 100%; height: 100%; transform: rotate(-90deg); }
      .ring-bg { fill: none; stroke-width: 12; stroke: var(--soft); }
      .ring-fg { fill: none; stroke-width: 12; stroke-linecap: round; stroke: var(--s1); transition: stroke-dashoffset 0.7s ease; }
      .gauge-label { position: absolute; inset: 0; display: grid; place-items: center; text-align: center; line-height: 1.1; }
      .gauge-label b { font-size: 28px; font-weight: 600; letter-spacing: -0.02em; }
      .gauge-label span { font-size: 11px; opacity: 0.75; }
      .event-top { display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
      .event-top h3 { margin: 6px 0 0; font-size: 19px; font-weight: 600; }
      .event-actions { display: flex; flex-direction: column; align-items: flex-end; gap: 8px; }
      .countdown { display: flex; gap: 8px; }
      .countdown div { background: var(--soft); border-radius: 12px; padding: 6px 10px; text-align: center; min-width: 52px; }
      .countdown b { display: block; font-size: 20px; font-weight: 600; line-height: 1.1; }
      .countdown span { font-size: 10.5px; opacity: 0.7; text-transform: uppercase; letter-spacing: 0.06em; }
      .cap { display: flex; gap: 16px; align-items: center; }
      .tt { display: grid; gap: 10px; align-content: start; }
      .tt-row { display: grid; grid-template-columns: minmax(0, 1fr) 80px; gap: 4px 12px; align-items: center; }
      .tt-row .name { font-size: 13px; font-weight: 500; }
      .tt-row .val { font-size: 12.5px; opacity: 0.7; text-align: right; }
      .meter { grid-column: 1 / -1; height: 8px; border-radius: 999px; background: var(--soft); overflow: hidden; }
      .meter > span { display: block; height: 100%; background: var(--s1); border-radius: 999px; }
      .roles { display: grid; gap: 6px; align-content: start; }
      .roles-title { font-size: 13px; font-weight: 600; }
      .roles-bar { display: flex; height: 14px; border-radius: 999px; overflow: hidden; gap: 2px; }
      .roles-bar span { display: block; height: 100%; background: var(--c); }
      .roles-legend { display: flex; justify-content: space-between; font-size: 12.5px; }
      .roles-legend span { display: inline-flex; align-items: center; gap: 6px; }
      .dot { width: 9px; height: 9px; border-radius: 50%; display: inline-block; flex: none; }
      .running {
        font-size: 12.5px; font-weight: 600; border-radius: 999px; padding: 4px 12px;
        background: rgba(27, 110, 60, 0.12); color: var(--color-success);
      }
      @media (prefers-reduced-motion: reduce) { .ring-fg { transition: none; } }
    `,
  ],
})
export class DashboardNextEventComponent {
  readonly event = input.required<NextEvent>();
  readonly now = input.required<Date>();

  private readonly locale = inject(LocaleService);
  readonly ring = RING.toFixed(1);

  readonly room = computed(() => {
    const section = this.event().dashboard.sections['capacity'] as unknown as Section<CapacitySection> | undefined;
    return isAvailable<CapacitySection>(section) ? section.room : null;
  });
  readonly committed = computed(() => {
    const section = this.event().dashboard.sections['committedByTicketType'] as unknown as Section<CommittedSection> | undefined;
    return isAvailable<CommittedSection>(section) ? section.items.slice(0, 4) : [];
  });
  readonly roles = computed(() => {
    const section = this.event().dashboard.sections['registrationsByRole'] as unknown as Section<RegistrationsByRole> | undefined;
    return isAvailable<RegistrationsByRole>(section) ? section : null;
  });

  readonly eventDates = computed(() => {
    const from = dayFmt.format(new Date(this.event().startAt));
    const to = dayFmt.format(new Date(this.event().endAt));
    return from === to ? from : `${from} – ${to}`;
  });
  /** Già cominciato: niente conto alla rovescia a zero, si dice che è in corso. */
  readonly started = computed(() => new Date(this.event().startAt).getTime() <= this.now().getTime());
  readonly countdown = computed(() => {
    const ms = Math.max(0, new Date(this.event().startAt).getTime() - this.now().getTime());
    return { days: Math.floor(ms / 86_400_000), hours: Math.floor((ms % 86_400_000) / 3_600_000) };
  });
  readonly countdownLabel = computed(() => `Mancano ${this.countdown().days} giorni e ${this.countdown().hours} ore`);

  i18n(value: unknown): string {
    return i18nPlain(value as never, this.locale.lang());
  }

  ringOffset(value: number, of: number): string {
    return (RING * (1 - (of > 0 ? Math.min(1, value / of) : 0))).toFixed(1);
  }

  percent(value: number, of: number): number {
    return of > 0 ? Math.round((value / of) * 100) : 0;
  }

  share(value: number, total: number): number {
    return total > 0 ? (value / total) * 100 : 50;
  }

  balanceText(r: RegistrationsByRole): string {
    const diff = Math.abs(r.imbalance);
    if (r.imbalanceTolerance === null) return `Differenza ${diff}.`;
    return diff <= r.imbalanceTolerance
      ? `Differenza ${diff}, tolleranza ${r.imbalanceTolerance}: in equilibrio.`
      : `Differenza ${diff}, oltre la tolleranza di ${r.imbalanceTolerance}.`;
  }
}
