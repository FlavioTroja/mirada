import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { InfoBoxComponent, PageWrapperComponent } from '@keijo/ui';
import { celebration, warning } from '@keijo/ui/icons';
import { HeaderTitleService } from '../../services/header-title.service';
import { PageActionsService } from '../../services/page-actions.service';
import { AuthService } from '../../core/auth/auth.service';
import { TodaySession } from '../../core/domain/dashboard-today';
import {
  CapacitySection,
  CommittedSection,
  RegistrationsByRole,
  Section,
  isAvailable,
} from '../../core/domain/dashboard';
import { formatCents, formatTime, LOCALE, TIMEZONE } from '../../core/i18n/format';
import { LocaleService, i18nPlain } from '../../core/i18n/i18n-text';
import { minuteOfDay } from '../../core/i18n/zoned';
import { liveOn } from '../../core/realtime/live';
import { REALTIME_EVENTS } from '../../core/realtime/realtime.service';
import { DashboardTodayStore } from '../../stores/dashboard-today.store';
import { DashboardFeedComponent } from './dashboard-feed.component';
import { DashboardNextEventComponent } from './dashboard-next-event.component';
import { minutesText } from './dashboard-text';

/** Più segnali ravvicinati — dieci ingressi in un minuto — sono una rilettura sola. */
const REFRESH_COALESCE_MS = 1_000;
const RING = 2 * Math.PI * 52;

const dayFmt = new Intl.DateTimeFormat(LOCALE, { timeZone: TIMEZONE, weekday: 'long', day: 'numeric', month: 'long' });
const hourFmt = new Intl.DateTimeFormat(LOCALE, { timeZone: TIMEZONE, hour: 'numeric', hour12: false });

/**
 * `/dashboard` — **la giornata dell'organizzazione** (`21-dashboard.md`).
 *
 * Il cruscotto per evento resta, come vista «Evento» (`/dashboard/event`).
 * Questa pagina risponde a «che cosa sta succedendo adesso?», e si muove da
 * sola: ogni segnale che la tocca la fa rileggere, e le riletture ravvicinate
 * si fondono in una.
 */
@Component({
  selector: 'app-dashboard-today',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageWrapperComponent, InfoBoxComponent, RouterLink, DashboardFeedComponent, DashboardNextEventComponent],
  template: `
    <keijo-page-wrapper>
      @if (store.error(); as message) {
        <keijo-info-box variant="warning" [icon]="warningIcon" title="Dashboard non aggiornata">{{ message }}</keijo-info-box>
      }

      <div class="layout">
        <main>
          <div class="greet">
            <div>
              <h2>{{ greeting() }}</h2>
              <p>{{ subtitle() }}</p>
            </div>
            <span class="live" [class.off]="!live()"><span class="pulse"></span>{{ live() ? 'In tempo reale' : 'In attesa' }}</span>
          </div>

          <div class="grid">
            <!-- Adesso -->
            <section class="w now span-8" aria-label="Adesso">
              <div class="w-head">
                <span class="w-title">{{ nowTitle() }}</span>
                <span class="w-sub num">{{ clock() }}</span>
              </div>
              @if (current(); as s) {
                <div class="now-main">
                  <div>
                    <h3>{{ title(s) }}</h3>
                    <div class="now-meta">
                      @if (s.family === 'COURSE' || !s.isImplicit) { <span>{{ i18n(s.name) }}</span> }
                      @if (s.room) { <span>{{ s.room }}</span> }
                      @if (s.venue) { <span>{{ s.venue }}</span> }
                      <span class="num">{{ time(s.startAt) }} – {{ time(s.endAt) }}</span>
                    </div>
                    @if (s.phase === 'ONGOING') {
                      <div class="progress" aria-hidden="true"><span [style.width.%]="progress(s)"></span></div>
                      <div class="prog-legend"><span>iniziata {{ sinceStart(s) }}</span><span>{{ untilEnd(s) }}</span></div>
                    } @else {
                      <p class="now-hint">Comincia {{ untilStart(s) }}</p>
                    }
                    @if (s.entries !== null) {
                      <div class="roles-mini"><span><b>{{ s.leaders }}</b> leader</span><span><b>{{ s.followers }}</b> follower</span></div>
                    } @else {
                      <p class="now-hint">Le lezioni non registrano presenze: sono <b>{{ s.expected }}</b> iscritti al corso.</p>
                    }
                  </div>
                  @if (s.entries !== null) {
                    <div class="gauge" role="img" [attr.aria-label]="s.entries + ' entrati su ' + s.expected + ' attesi'">
                      <svg viewBox="0 0 128 128"><circle class="ring-bg" cx="64" cy="64" r="52" /><circle class="ring-fg" cx="64" cy="64" r="52" [attr.stroke-dasharray]="ring" [attr.stroke-dashoffset]="ringOffset(s.entries, s.expected)" /></svg>
                      <div class="gauge-label"><div><b class="num">{{ s.entries }}</b><br /><span>su {{ s.expected }} attesi</span></div></div>
                    </div>
                  } @else {
                    <div class="gauge" role="img" [attr.aria-label]="s.expected + ' iscritti'">
                      <svg viewBox="0 0 128 128"><circle class="ring-bg" cx="64" cy="64" r="52" /></svg>
                      <div class="gauge-label"><div><b class="num">{{ s.expected }}</b><br /><span>iscritti</span></div></div>
                    </div>
                  }
                </div>
                @if (alsoNow().length) {
                  <div class="next-up">
                    <span class="chip">Anche in corso</span>
                    @for (o of alsoNow(); track o.id) {
                      <span><b>{{ title(o) }}</b>{{ o.room ? ' · ' + o.room : '' }}</span>
                    }
                  </div>
                }
              } @else {
                <p class="empty-now">Nessuna lezione o serata oggi. Quando comincia qualcosa, compare qui.</p>
              }
            </section>

            <!-- Da sistemare -->
            <section class="w span-4" aria-label="Da sistemare">
              <div class="w-head"><span class="w-title">Da sistemare</span><span class="w-sub num">{{ todos().length }}</span></div>
              @if (todos().length) {
                <div class="todo">
                  @for (t of todos(); track t.label) {
                    <a class="todo-item" [class.crit]="t.crit" [routerLink]="t.link">
                      <span class="badge" aria-hidden="true">{{ t.crit ? '!' : '•' }}</span>
                      <div><b>{{ t.label }}</b><span>{{ t.detail }}</span></div>
                    </a>
                  }
                </div>
              } @else {
                <p class="all-good"><span class="ok-dot" aria-hidden="true">✓</span> Tutto a posto</p>
              }
            </section>

            <!-- In sala -->
            <section class="w span-4" aria-label="In sala adesso">
              <div class="w-head"><span class="w-title"><span class="ic s1" aria-hidden="true"></span>In sala adesso</span></div>
              <div class="kpi">
                <div><div class="big num">{{ t()?.inRoom ?? 0 }}</div><div class="sub">su {{ t()?.expectedToday ?? 0 }} attesi oggi</div></div>
                <svg class="spark s1" viewBox="0 0 120 44" aria-hidden="true">
                  @if (sparkEntries(); as sp) {
                    <polygon class="sp-area" [attr.points]="sp.area" />
                    <polyline class="sp-line" [attr.points]="sp.line" />
                    <circle class="sp-dot" [attr.cx]="sp.x" [attr.cy]="sp.y" r="4" />
                  }
                </svg>
              </div>
              <span class="sub">{{ lastQuarterText() }}</span>
            </section>

            <!-- Iscrizioni -->
            <section class="w span-4" aria-label="Iscrizioni di oggi">
              <div class="w-head"><span class="w-title"><span class="ic s2" aria-hidden="true"></span>Iscrizioni oggi</span><a class="w-link" routerLink="/registrations">Iscritti</a></div>
              <div class="kpi">
                <div>
                  <div class="big num">{{ t()?.registrations?.today ?? 0 }}</div>
                  <div class="sub">{{ t()?.registrations?.byFamily?.EVENT ?? 0 }} eventi · {{ t()?.registrations?.byFamily?.COURSE ?? 0 }} corsi</div>
                </div>
                <svg class="spark s2" viewBox="0 0 120 44" aria-hidden="true">
                  @if (sparkRegistrations(); as sp) {
                    <polygon class="sp-area" [attr.points]="sp.area" />
                    <polyline class="sp-line" [attr.points]="sp.line" />
                    <circle class="sp-dot" [attr.cx]="sp.x" [attr.cy]="sp.y" r="4" />
                  }
                </svg>
              </div>
              <span class="sub">{{ weekCompare() }}</span>
            </section>

            <!-- Incasso -->
            <section class="w span-4" aria-label="Incassato oggi">
              <div class="w-head"><span class="w-title"><span class="ic s3" aria-hidden="true"></span>Incassato oggi</span><a class="w-link" routerLink="/reports">Report</a></div>
              <div class="kpi">
                <div>
                  <div class="big num">{{ cents(t()?.money?.total ?? 0) }}</div>
                  <div class="sub">online {{ cents(t()?.money?.online ?? 0) }} · cassa {{ cents(t()?.money?.boxOffice ?? 0) }}@if ((t()?.money?.externalShops ?? 0) > 0) { · negozi {{ cents(t()?.money?.externalShops ?? 0) }} }</div>
                </div>
                <svg class="spark s3" viewBox="0 0 120 44" aria-hidden="true">
                  @if (sparkMoney(); as sp) {
                    <polygon class="sp-area" [attr.points]="sp.area" />
                    <polyline class="sp-line" [attr.points]="sp.line" />
                    <circle class="sp-dot" [attr.cx]="sp.x" [attr.cy]="sp.y" r="4" />
                  }
                </svg>
              </div>
              <span class="sub">Da incassare alla porta: <b>{{ cents(t()?.money?.openBalances?.amount ?? 0) }}</b> ({{ t()?.money?.openBalances?.count ?? 0 }} saldi)</span>
            </section>

            <!-- Ingressi -->
            <section class="w span-7" aria-label="Ingressi di oggi">
              <div class="w-head"><span class="w-title"><span class="ic s1" aria-hidden="true"></span>Ingressi di oggi</span><span class="w-sub">ogni 15 minuti · tutte le sale</span></div>
              <div class="chart-wrap">
                <svg class="bars" viewBox="0 0 600 250" role="img" [attr.aria-label]="barsLabel()">
                  @for (g of bars().grid; track g.v) {
                    <line class="grid-line" x1="28" x2="600" [attr.y1]="g.y" [attr.y2]="g.y" />
                    <text [attr.x]="22" [attr.y]="g.y + 3.5" text-anchor="end">{{ g.v }}</text>
                  }
                  @for (b of bars().items; track b.i) {
                    @if (b.future) {
                      <rect class="bar future" [attr.x]="b.x" y="225" [attr.width]="b.w" height="3" rx="1.5" />
                    } @else if (b.v > 0) {
                      <path class="bar" [attr.d]="b.d" />
                    }
                    <rect class="hit" [attr.x]="b.hx" y="10" [attr.width]="b.hw" height="218" (mouseenter)="tip.set(b)" (mouseleave)="tip.set(null)">
                      <title>{{ b.label }}</title>
                    </rect>
                    @if (b.tick) { <text [attr.x]="b.cx" y="244" text-anchor="middle">{{ b.tick }}</text> }
                  }
                  @if (bars().nowX; as n) {
                    <line class="now-line" [attr.x1]="n" [attr.x2]="n" y1="10" y2="228" />
                    <text class="now-text" [attr.x]="n + 4" y="19">adesso</text>
                  }
                </svg>
                @if (tip(); as b) {
                  <div class="tip" [style.left.%]="(b.cx / 600) * 100" [style.top.%]="(b.top / 250) * 100">{{ b.label }}</div>
                }
              </div>
            </section>

            <!-- Oggi -->
            <section class="w span-5" aria-label="Il programma di oggi">
              <div class="w-head"><span class="w-title">Oggi</span><a class="w-link" routerLink="/calendar">Calendario</a></div>
              @if (agenda().length) {
                <div class="agenda">
                  @for (a of agenda(); track a.key) {
                    <div class="ag" [class.past]="a.past" [class.cancelled]="a.cancelled">
                      <time class="num">{{ a.time }}</time>
                      <span [class]="'stripe ' + a.color"></span>
                      <div class="what">
                        <b>{{ a.title }}</b>
                        <span>{{ a.detail }}</span>
                      </div>
                      <span class="state" [class.live-state]="a.live">{{ a.state }}</span>
                    </div>
                  }
                </div>
              } @else {
                <p class="sub">Niente in programma oggi.</p>
              }
            </section>

            <!-- Prossimo evento -->
            @if (t()?.nextEvent; as ev) {
              <app-dashboard-next-event class="span-12" [event]="ev" [now]="now()" />
            }

            <!-- Registro -->
            <section class="w span-12" aria-label="Registro di oggi">
              <div class="w-head"><span class="w-title">Registro di oggi</span><span class="w-sub">le azioni dello staff</span></div>
              @if (store.log().length) {
                <div class="log-wrap">
                  <table class="log">
                    <tbody>
                      @for (row of store.log(); track row.id) {
                        <tr><td class="num">{{ time(row.createdAt) }}</td><td>{{ row.actorName ?? '—' }}</td><td>{{ row.text }}</td></tr>
                      }
                    </tbody>
                  </table>
                </div>
              } @else {
                <p class="sub">Nessuna azione dello staff oggi.</p>
              }
            </section>
          </div>
        </main>

        <app-dashboard-feed [rows]="store.feed()" [fresh]="fresh()" [now]="now()" />
      </div>
    </keijo-page-wrapper>
  `,
  styles: [
    `
      :host {
        display: block;
        --s1: #7a3a9e; --s2: #1baf7a; --s3: #eb6834; --s4: #2a78d6;
        --good: #1b6e3c; --good-soft: #e8f5ec; --crit: #b2261e; --crit-soft: #fdecea; --warn: #8a5a00; --warn-soft: #fff4dc;
        --soft: rgba(var(--text-rgb), 0.06); --line: var(--color-default-border);
      }
      :host-context([data-theme='dark']) {
        --s1: #a974d0; --s2: #199e70; --s3: #d95926; --s4: #3987e5;
        --good: #7fd6a0; --good-soft: rgba(127, 214, 160, 0.12); --crit: #ff8a80; --crit-soft: rgba(255, 138, 128, 0.12);
        --warn: #f2c14e; --warn-soft: rgba(242, 193, 78, 0.12);
      }
      .num { font-variant-numeric: tabular-nums; }
      .layout { display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 20px; padding-block: 12px 24px; }
      @media (max-width: 1100px) { .layout { grid-template-columns: 1fr; } }

      .greet { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 10px; margin-bottom: 14px; }
      .greet h2 { margin: 0; font-size: 26px; font-weight: 600; letter-spacing: -0.02em; }
      .greet p { margin: 2px 0 0; opacity: 0.7; font-size: 13.5px; }
      .greet p::first-letter { text-transform: uppercase; }
      .live { display: inline-flex; align-items: center; gap: 8px; background: var(--good-soft); color: var(--good); border-radius: 999px; padding: 5px 11px; font-size: 12.5px; font-weight: 600; }
      .live .pulse { width: 8px; height: 8px; border-radius: 50%; background: currentColor; }
      .live.off { background: var(--soft); color: rgba(var(--text-rgb), 0.6); }

      .grid { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: 14px; }
      .span-12 { grid-column: span 12; } .span-8 { grid-column: span 8; } .span-7 { grid-column: span 7; }
      .span-5 { grid-column: span 5; } .span-4 { grid-column: span 4; }
      @media (max-width: 860px) { .span-8, .span-7, .span-5, .span-4 { grid-column: span 12; } }

      .w {
        background: rgb(var(--foreground-color)); border: 1px solid var(--line); border-radius: 22px; padding: 18px;
        box-shadow: var(--keijo-shadow-md); display: flex; flex-direction: column; gap: 12px; min-width: 0;
      }
      .w-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
      .w-title { font-size: 12px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; opacity: 0.7; display: flex; align-items: center; gap: 8px; }
      .w-sub { font-size: 12px; opacity: 0.65; }
      .w-link { font-size: 12.5px; font-weight: 600; color: var(--color-accent); text-decoration: none; white-space: nowrap; }
      .w-link:hover { text-decoration: underline; }
      .ic { width: 10px; height: 10px; border-radius: 50%; }
      .s1 { --c: var(--s1); } .s2 { --c: var(--s2); } .s3 { --c: var(--s3); } .s4 { --c: var(--s4); }
      .ic, .dot { background: var(--c); }
      .big { font-size: clamp(30px, 3vw, 40px); font-weight: 600; letter-spacing: -0.03em; line-height: 1; white-space: nowrap; }
      .sub { font-size: 12.5px; opacity: 0.7; margin: 0; }
      .sub b { opacity: 1; }
      .kpi { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 10px; }
      .spark { width: 120px; height: 44px; flex: none; overflow: visible; }
      .sp-area { fill: var(--c); opacity: 0.14; }
      .sp-line { fill: none; stroke: var(--c); stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; }
      .sp-dot { fill: var(--c); stroke: rgb(var(--foreground-color)); stroke-width: 2; }

      .now { background: linear-gradient(135deg, #2a1638 0%, #170b1e 70%); color: #f5f1f7; border: 0; }
      :host-context([data-theme='dark']) .now { background: linear-gradient(135deg, #3a2150 0%, #22152b 75%); }
      .now .w-title, .now .w-sub { color: #c9b8d6; opacity: 1; }
      .now-main { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 18px; align-items: center; }
      @media (max-width: 560px) { .now-main { grid-template-columns: 1fr; } }
      .now h3 { margin: 0; font-size: 24px; font-weight: 600; letter-spacing: -0.02em; line-height: 1.15; }
      .now-meta { display: flex; flex-wrap: wrap; gap: 6px 14px; color: #c9b8d6; font-size: 13px; margin-top: 6px; }
      .now-hint { color: #e7dcef; font-size: 13px; margin: 12px 0 0; }
      .progress { height: 8px; border-radius: 999px; background: rgba(245, 241, 247, 0.14); overflow: hidden; margin-top: 14px; }
      .progress > span { display: block; height: 100%; border-radius: 999px; background: #c495e3; transition: width 0.6s ease; }
      .prog-legend { display: flex; justify-content: space-between; font-size: 12px; color: #c9b8d6; margin-top: 6px; }
      .roles-mini { display: flex; gap: 14px; margin-top: 12px; font-size: 12.5px; color: #e7dcef; }
      .roles-mini b { font-size: 15px; color: #fff; }
      .next-up { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 14px; padding-top: 14px; border-top: 1px solid rgba(245, 241, 247, 0.14); font-size: 13px; color: #e7dcef; }
      .next-up .chip { background: rgba(245, 241, 247, 0.12); border-radius: 999px; padding: 3px 10px; font-weight: 600; font-size: 12px; }
      .empty-now { color: #e7dcef; font-size: 14px; margin: 8px 0; }

      .gauge { position: relative; width: 128px; height: 128px; flex: none; }
      .gauge svg { width: 100%; height: 100%; transform: rotate(-90deg); }
      .ring-bg { fill: none; stroke-width: 12; stroke: rgba(245, 241, 247, 0.14); }
      .ring-fg { fill: none; stroke-width: 12; stroke-linecap: round; stroke: #c495e3; transition: stroke-dashoffset 0.7s ease; }
      .gauge-label { position: absolute; inset: 0; display: grid; place-items: center; text-align: center; line-height: 1.1; }
      .gauge-label b { font-size: 28px; font-weight: 600; letter-spacing: -0.02em; }
      .gauge-label span { font-size: 11px; opacity: 0.75; }

      .todo { display: grid; gap: 8px; }
      .todo-item { display: grid; grid-template-columns: 30px minmax(0, 1fr); gap: 10px; align-items: center; padding: 10px; border-radius: 14px; background: var(--soft); color: inherit; text-decoration: none; }
      .todo-item:hover { background: rgba(var(--text-rgb), 0.09); }
      .todo-item .badge { width: 30px; height: 30px; border-radius: 9px; display: grid; place-items: center; font-weight: 700; background: var(--warn-soft); color: var(--warn); }
      .todo-item.crit .badge { background: var(--crit-soft); color: var(--crit); }
      .todo-item b { display: block; font-size: 13px; font-weight: 600; }
      .todo-item span { font-size: 12px; opacity: 0.7; }
      .all-good { display: flex; align-items: center; gap: 10px; font-weight: 600; color: var(--good); margin: 4px 0; }
      .ok-dot { width: 30px; height: 30px; border-radius: 9px; display: grid; place-items: center; background: var(--good-soft); }

      .chart-wrap { position: relative; }
      .bars { width: 100%; height: 250px; display: block; overflow: visible; }
      .bars .grid-line { stroke: var(--line); stroke-width: 1; }
      .bars text { fill: rgba(var(--text-rgb), 0.6); font-size: 10.5px; font-family: inherit; }
      .bars .bar { fill: var(--s1); }
      .bars .bar.future { fill: var(--soft); }
      .bars .hit { fill: transparent; cursor: crosshair; }
      .bars .now-line { stroke: var(--crit); stroke-width: 2; }
      .bars .now-text { fill: var(--crit); font-weight: 600; }
      .tip {
        position: absolute; pointer-events: none; transform: translate(-50%, -115%); white-space: nowrap;
        background: rgb(var(--text-rgb)); color: rgb(var(--background-color)); border-radius: 10px; padding: 6px 10px; font-size: 12px;
      }
      :host-context([data-theme='dark']) .tip { color: #170b1e; }

      .agenda { display: grid; gap: 2px; }
      .ag { display: grid; grid-template-columns: 48px 4px minmax(0, 1fr) auto; gap: 10px; align-items: center; padding: 8px 6px; border-radius: 12px; }
      .ag:hover { background: var(--soft); }
      .ag time { font-size: 12.5px; opacity: 0.7; text-align: right; }
      .ag .stripe { height: 32px; border-radius: 4px; background: var(--c); }
      .ag time { font-size: 12px; }
      .ag .what { min-width: 0; }
      .ag .what b { display: block; font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .ag .what span { font-size: 12px; opacity: 0.7; }
      .ag .state { font-size: 11.5px; font-weight: 600; border-radius: 999px; padding: 2px 8px; background: var(--soft); white-space: nowrap; }
      .ag .state.live-state { background: var(--good-soft); color: var(--good); }
      .ag.past { opacity: 0.55; }
      .ag.cancelled .what b { text-decoration: line-through; }


      .log-wrap { overflow-x: auto; }
      .log { width: 100%; border-collapse: collapse; font-size: 12.5px; }
      .log td { padding: 8px 6px; border-bottom: 1px solid var(--line); vertical-align: top; }
      .log tr:last-child td { border-bottom: 0; }
      .log td:first-child { opacity: 0.7; white-space: nowrap; width: 1%; }
      .log td:nth-child(2) { font-weight: 600; white-space: nowrap; width: 1%; }

      @media (prefers-reduced-motion: reduce) {
        .progress > span, .ring-fg { transition: none; }
      }
    `,
  ],
})
export class DashboardTodayComponent implements OnInit {
  readonly store = inject(DashboardTodayStore);
  private readonly headerTitle = inject(HeaderTitleService);
  private readonly pageActions = inject(PageActionsService);
  private readonly auth = inject(AuthService);
  private readonly locale = inject(LocaleService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly warningIcon = warning;
  readonly ring = RING.toFixed(1);

  readonly now = signal(new Date());
  readonly tip = signal<BarItem | null>(null);
  /** Le righe arrivate dopo l'apertura: scivolano dentro una volta sola. */
  readonly fresh = signal<Set<number>>(new Set());
  readonly live = signal(false);

  readonly t = this.store.today;

  readonly sessions = computed(() =>
    [...(this.t()?.sessions ?? [])].sort((a, b) => a.startAt.localeCompare(b.startAt)),
  );
  private readonly ongoing = computed(() => this.sessions().filter((s) => s.phase === 'ONGOING' && !s.cancelled));
  /** La sessione in evidenza: la prima in corso, o la prossima di oggi. */
  readonly current = computed<TodaySession | null>(
    () => this.ongoing()[0] ?? this.sessions().find((s) => s.phase === 'UPCOMING' && !s.cancelled) ?? null,
  );
  readonly alsoNow = computed(() => this.ongoing().slice(1));

  /**
   * Il programma di oggi: lezioni, serate e impegni dello staff insieme, per
   * ora. Una lezione è viola, una serata arancio, un appuntamento blu: gli
   * stessi colori delle fonti nella colonna «In tempo reale».
   */
  readonly agenda = computed(() => {
    const now = this.now().getTime();
    const fromSessions = this.sessions().map((s) => ({
      key: `s${s.id}`,
      at: s.startAt,
      time: this.time(s.startAt),
      title: this.title(s),
      detail: this.agendaDetail(s),
      color: s.family === 'COURSE' ? 's1' : 's3',
      state: this.stateText(s),
      live: s.phase === 'ONGOING' && !s.cancelled,
      past: s.phase === 'ENDED',
      cancelled: s.cancelled,
    }));
    const fromAppointments = (this.t()?.appointments ?? []).map((a) => {
      const start = new Date(a.startAt).getTime();
      const end = new Date(a.endAt).getTime();
      const phase = now < start ? 'UPCOMING' : now < end ? 'ONGOING' : 'ENDED';
      return {
        key: `a${a.id}`,
        at: a.startAt,
        time: a.allDay ? 'tutto il giorno' : this.time(a.startAt),
        title: a.title,
        detail: [a.room, 'staff'].filter(Boolean).join(' · '),
        color: 's4',
        state: a.allDay ? 'Oggi' : phase === 'ENDED' ? 'Finita' : phase === 'ONGOING' ? 'In corso' : minutesText(start - now, 'Tra'),
        live: phase === 'ONGOING' && !a.allDay,
        past: phase === 'ENDED' && !a.allDay,
        cancelled: false,
      };
    });
    return [...fromSessions, ...fromAppointments].sort((x, y) => x.at.localeCompare(y.at));
  });
  readonly nowTitle = computed(() => (this.current()?.phase === 'ONGOING' ? 'Adesso · in corso' : 'Più tardi'));

  readonly greeting = computed(() => {
    const hour = +hourFmt.format(this.now());
    const hello = hour < 13 ? 'Buongiorno' : hour < 18 ? 'Buon pomeriggio' : 'Buonasera';
    const name = this.auth.profile()?.person?.name;
    return name ? `${hello}, ${name}` : hello;
  });

  readonly subtitle = computed(() => {
    const parts = [dayFmt.format(this.now())];
    const upcoming = this.sessions().filter((s) => s.phase !== 'ENDED' && !s.cancelled).length;
    if (upcoming) parts.push(`${upcoming} ${upcoming === 1 ? 'appuntamento ancora' : 'appuntamenti ancora'} oggi`);
    const next = this.t()?.nextEvent;
    if (next) {
      const days = Math.ceil((new Date(next.startAt).getTime() - this.now().getTime()) / 86_400_000);
      parts.push(days > 0 ? `${i18nPlain(next.title, this.locale.lang())} tra ${days} ${days === 1 ? 'giorno' : 'giorni'}` : `${i18nPlain(next.title, this.locale.lang())} è in corso`);
    }
    return parts.join(' · ');
  });

  readonly clock = computed(() => formatTime(this.now()));

  readonly todos = computed(() => {
    const todo = this.t()?.todo;
    if (!todo) return [];
    const out: { label: string; detail: string; crit: boolean; link: string }[] = [];
    if (todo.quarantinedSales) out.push({ label: `${todo.quarantinedSales} ${todo.quarantinedSales === 1 ? 'vendita esterna ferma' : 'vendite esterne ferme'}`, detail: 'Qualcuno ha pagato e non ha ancora il biglietto', crit: true, link: '/organization/sales-channels' });
    if (todo.checkInConflicts) out.push({ label: `${todo.checkInConflicts} ${todo.checkInConflicts === 1 ? 'ingresso in conflitto' : 'ingressi in conflitto'}`, detail: 'Lo stesso biglietto a due porte', crit: true, link: '/registrations' });
    if (todo.settlementConflicts) out.push({ label: `${todo.settlementConflicts} ${todo.settlementConflicts === 1 ? 'saldo incassato due volte' : 'saldi incassati due volte'}`, detail: 'Da due postazioni della cassa', crit: true, link: '/registrations' });
    if (todo.requirementsUnderReview) out.push({ label: `${todo.requirementsUnderReview} ${todo.requirementsUnderReview === 1 ? 'documento da verificare' : 'documenti da verificare'}`, detail: 'Caricati e in attesa di una verifica', crit: false, link: '/registrations' });
    const balances = this.t()?.money.openBalances;
    if (balances?.count) out.push({ label: `${balances.count} ${balances.count === 1 ? 'saldo' : 'saldi'} alla porta`, detail: `${formatCents(balances.amount)} in tutto`, crit: false, link: '/registrations' });
    return out;
  });

  readonly sparkEntries = computed(() => {
    const quarters = this.t()?.entriesByQuarter ?? [];
    const upTo = Math.floor(minuteOfDay(this.now()) / 15) + 1;
    let running = 0;
    const cumulative = quarters.slice(0, upTo).map((v) => (running += v));
    return spark(cumulative.slice(-24));
  });
  readonly sparkRegistrations = computed(() => spark(this.t()?.registrations.lastDays ?? []));
  readonly sparkMoney = computed(() => {
    const hours = this.t()?.money.cumulativeByHour ?? [];
    const hour = +hourFmt.format(this.now());
    return spark(hours.slice(0, hour + 1));
  });

  readonly lastQuarterText = computed(() => {
    const quarters = this.t()?.entriesByQuarter ?? [];
    const index = Math.floor(minuteOfDay(this.now()) / 15);
    const recent = (quarters[index] ?? 0) + (quarters[index - 1] ?? 0);
    return recent ? `${recent} ${recent === 1 ? 'ingresso' : 'ingressi'} nell'ultima mezz'ora` : "Nessun ingresso nell'ultima mezz'ora";
  });

  readonly weekCompare = computed(() => {
    const days = this.t()?.registrations.lastDays ?? [];
    if (days.length < 8) return '';
    const diff = days[7]! - days[0]!;
    if (diff === 0) return 'Come lo stesso giorno della settimana scorsa';
    return `${diff > 0 ? '▲' : '▼'} ${Math.abs(diff)} rispetto a una settimana fa`;
  });

  readonly bars = computed(() => buildBars(this.t()?.entriesByQuarter ?? [], this.sessions(), this.now()));
  readonly barsLabel = computed(() => {
    const total = (this.t()?.entriesByQuarter ?? []).reduce((a, b) => a + b, 0);
    return `Ingressi di oggi per quarto d'ora: ${total} in tutto`;
  });


  private refreshTimer: ReturnType<typeof setTimeout> | null = null;
  private activityTimer: ReturnType<typeof setTimeout> | null = null;
  private knownIds = new Set<number>();

  constructor() {
    // Ogni segnale che tocca la giornata la fa rileggere; le riletture
    // ravvicinate si fondono. L'attività ha il suo segnale e la sua lettura.
    liveOn(
      [
        REALTIME_EVENTS.checkinRegistered,
        REALTIME_EVENTS.registrationCreated,
        REALTIME_EVENTS.registrationUpdated,
        REALTIME_EVENTS.balanceSettled,
        REALTIME_EVENTS.externalSaleIngested,
        REALTIME_EVENTS.externalSaleQuarantined,
        REALTIME_EVENTS.calendarChanged,
        REALTIME_EVENTS.availabilityChanged,
      ],
      () => this.scheduleToday(),
    );
    liveOn([REALTIME_EVENTS.activityRecorded], () => this.scheduleActivity());

    const tick = setInterval(() => this.now.set(new Date()), 30_000);
    this.destroyRef.onDestroy(() => {
      clearInterval(tick);
      if (this.refreshTimer) clearTimeout(this.refreshTimer);
      if (this.activityTimer) clearTimeout(this.activityTimer);
    });
  }

  async ngOnInit(): Promise<void> {
    this.headerTitle.set('Dashboard');
    this.pageActions.set([
      {
        id: 'event',
        icon: celebration,
        label: 'Evento',
        tooltip: 'Apri la dashboard di un evento',
        run: () => void this.router.navigate(['/dashboard/event']),
      },
    ]);
    await Promise.all([this.store.loadToday(), this.store.loadActivity()]);
    this.knownIds = new Set(this.store.feed().map((row) => row.id));
    this.live.set(true);
  }

  // ── Riletture ───────────────────────────────────────────────────────────

  private scheduleToday(): void {
    if (this.refreshTimer) return;
    this.refreshTimer = setTimeout(() => {
      this.refreshTimer = null;
      void this.store.loadToday();
    }, REFRESH_COALESCE_MS);
  }

  private scheduleActivity(): void {
    if (this.activityTimer) return;
    this.activityTimer = setTimeout(async () => {
      this.activityTimer = null;
      await this.store.loadActivity();
      const arrived = this.store.feed().filter((row) => !this.knownIds.has(row.id)).map((row) => row.id);
      arrived.forEach((id) => this.knownIds.add(id));
      this.fresh.set(new Set(arrived));
    }, REFRESH_COALESCE_MS / 2);
  }

  // ── Testi ───────────────────────────────────────────────────────────────

  i18n(value: unknown): string {
    return i18nPlain(value as never, this.locale.lang());
  }

  title(s: TodaySession): string {
    const event = this.i18n(s.eventTitle);
    if (s.kind === 'OPEN_DAY') return `Open day · ${event}`;
    return s.family === 'COURSE' || s.isImplicit ? event : this.i18n(s.name);
  }

  time(value: string | Date): string {
    return formatTime(value);
  }

  cents(value: number): string {
    return formatCents(value);
  }

  progress(s: TodaySession): number {
    const start = new Date(s.startAt).getTime();
    const end = new Date(s.endAt).getTime();
    return Math.min(100, Math.max(0, ((this.now().getTime() - start) / (end - start)) * 100));
  }

  sinceStart(s: TodaySession): string {
    return minutesText(this.now().getTime() - new Date(s.startAt).getTime(), 'fa');
  }

  untilEnd(s: TodaySession): string {
    const ms = new Date(s.endAt).getTime() - this.now().getTime();
    return ms > 0 ? `finisce ${minutesText(ms, 'tra')}` : 'sta finendo';
  }

  untilStart(s: TodaySession): string {
    return minutesText(new Date(s.startAt).getTime() - this.now().getTime(), 'tra');
  }

  ringOffset(value: number, of: number): string {
    return (RING * (1 - (of > 0 ? Math.min(1, value / of) : 0))).toFixed(1);
  }

  agendaDetail(s: TodaySession): string {
    const where = [s.room, s.venue].filter(Boolean).join(' · ');
    const people = s.entries === null ? `${s.expected} iscritti` : `${s.entries} su ${s.expected}`;
    return [where, s.cancelled ? 'annullata' : people].filter(Boolean).join(' · ');
  }

  stateText(s: TodaySession): string {
    if (s.cancelled) return 'Annullata';
    if (s.phase === 'ENDED') return 'Finita';
    if (s.phase === 'ONGOING') return 'In corso';
    return minutesText(new Date(s.startAt).getTime() - this.now().getTime(), 'Tra');
  }

}

// ── Grafici ────────────────────────────────────────────────────────────────

interface BarItem {
  i: number;
  v: number;
  x: number;
  w: number;
  cx: number;
  hx: number;
  hw: number;
  top: number;
  d: string;
  future: boolean;
  tick: string | null;
  label: string;
}

/**
 * Le colonne degli ingressi: una per quarto d'ora, dall'ora prima della prima
 * sessione a quella dopo l'ultima; senza sessioni, la sera (18–24). Le colonne
 * dopo «adesso» restano un segno piatto: non sono zero, non sono ancora.
 */
function buildBars(quarters: number[], sessions: TodaySession[], now: Date) {
  const W = 600, H = 250, L = 28, B = 22, T = 10;
  const quarterOf = (iso: string) => Math.floor(minuteOfDay(iso) / 15);
  let from = 72, to = 96;
  if (sessions.length) {
    from = Math.max(0, Math.min(...sessions.map((s) => quarterOf(s.startAt))) - 4);
    const ends = sessions.map((s) => (new Date(s.endAt).getTime() - new Date(s.startAt).getTime() > 12 * 3_600_000 ? 96 : quarterOf(s.endAt) || 96));
    to = Math.min(96, Math.max(from + 16, Math.max(...ends) + 4));
  }
  const nowIndex = Math.floor(minuteOfDay(now) / 15);
  const slice = quarters.slice(from, to);
  const max = Math.max(4, ...slice);
  const step = max <= 8 ? 2 : max <= 20 ? 5 : 10;
  const n = Math.max(1, to - from);
  const bw = (W - L) / n;
  const y = (v: number) => H - B - (v / max) * (H - B - T);

  const grid = [];
  for (let v = 0; v <= max; v += step) grid.push({ v, y: y(v) });

  const items: BarItem[] = slice.map((v, k) => {
    const i = from + k;
    const x = L + k * bw + 2, w = Math.max(2, bw - 4);
    const top = y(v), hgt = Math.max(0, H - B - top);
    const r = Math.min(4, w / 2, hgt);
    const clock = `${String(Math.floor(i / 4)).padStart(2, '0')}:${String((i % 4) * 15).padStart(2, '0')}`;
    return {
      i, v, x, w, cx: x + w / 2, hx: L + k * bw, hw: bw, top,
      d: `M${x},${H - B} v${-(hgt - r)} a${r},${r} 0 0 1 ${r},${-r} h${w - 2 * r} a${r},${r} 0 0 1 ${r},${r} v${hgt - r} z`,
      future: i > nowIndex,
      tick: i % 4 === 0 ? clock : null,
      label: i > nowIndex ? `${clock} · non ancora` : `${clock} · ${v} ${v === 1 ? 'ingresso' : 'ingressi'}`,
    };
  });
  const nowX = nowIndex >= from && nowIndex < to ? L + (nowIndex - from + 0.5) * bw : null;
  return { grid, items, nowX };
}

/** Una linea con l'area sotto e il punto finale in evidenza; il colore lo dà la voce (--c). */
function spark(data: number[]): { area: string; line: string; x: number; y: number } | null {
  if (data.length < 2) return null;
  const w = 120, h = 44, p = 4;
  const max = Math.max(...data), min = Math.min(...data);
  const x = (i: number) => p + (i * (w - 2 * p)) / (data.length - 1);
  const y = (v: number) => h - p - ((v - min) / (max - min || 1)) * (h - 2 * p);
  const line = data.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const last = data.length - 1;
  return { area: `${x(0)},${h - p} ${line} ${x(last)},${h - p}`, line, x: x(last), y: y(data[last]!) };
}
