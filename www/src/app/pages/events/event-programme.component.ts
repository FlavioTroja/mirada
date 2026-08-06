import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { PublicSession } from '../../core/domain/models';
import { dayKey, time, weekdayDay } from '../../core/format/format';
import { I18nTextComponent } from '../../shared/i18n-text.component';

interface ProgrammeDay {
  key: string;
  label: string;
  sessions: PublicSession[];
}

/** Il programma, **per giorno**: è così che un ballerino legge un festival. */
@Component({
  selector: 'app-event-programme',
  imports: [I18nTextComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="www-section" id="programma">
      <h2 class="www-h2">Programma</h2>
      <p class="www-muted">
        {{ sessions().length }} sessioni — workshop, milonghe e spettacoli. Orari nel fuso di
        Roma.
      </p>

      <div class="days">
        @for (day of days(); track day.key) {
          <div class="day">
            <h3 class="day-label">{{ day.label }}</h3>
            <ul class="slots">
              @for (s of day.sessions; track s.id) {
                <li class="slot" [class.cancelled]="s.cancelledAt">
                  <span class="hour">{{ hours(s) }}</span>
                  <span class="what">
                    <app-i18n-text [value]="s.name" />
                    @if (s.cancelledAt) {
                      <span class="www-chip www-chip-off">Annullata</span>
                    }
                    @if (s.room || s.level) {
                      <span class="meta">
                        @if (s.room) {
                          <span>{{ s.room }}</span>
                        }
                        @if (s.level) {
                          <span>{{ s.room ? ' · ' : '' }}livello {{ s.level }}</span>
                        }
                      </span>
                    }
                  </span>
                </li>
              }
            </ul>
          </div>
        }
      </div>
    </section>
  `,
  styles: [
    `
      .days {
        display: grid;
        gap: 1rem;
        margin-top: 1rem;
      }
      .day {
        background: rgb(var(--foreground-color));
        border: 1px solid rgba(var(--text-rgb), 0.14);
        border-radius: var(--www-radius);
        padding: 1rem 1.15rem;
      }
      .day-label {
        margin: 0 0 0.6rem;
        font-size: 0.95rem;
        text-transform: capitalize;
        color: rgb(var(--accent-rgb));
        letter-spacing: 0.02em;
      }
      .slots {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        gap: 0.4rem;
      }
      .slot {
        display: grid;
        grid-template-columns: 7.5rem 1fr;
        gap: 0.75rem;
        padding: 0.35rem 0;
        border-top: 1px solid rgba(var(--text-rgb), 0.08);
      }
      .slot:first-child {
        border-top: 0;
      }
      .slot.cancelled .what {
        text-decoration: line-through;
        opacity: 0.7;
      }
      .hour {
        color: rgba(var(--text-rgb), 0.72);
        font-variant-numeric: tabular-nums;
        font-size: 0.9rem;
      }
      .what {
        color: rgb(var(--text-rgb));
      }
      .meta {
        display: block;
        color: rgba(var(--text-rgb), 0.6);
        font-size: 0.8rem;
      }
      @media (max-width: 520px) {
        .slot {
          grid-template-columns: 1fr;
          gap: 0.1rem;
        }
      }
    `,
  ],
})
export class EventProgrammeComponent {
  readonly sessions = input.required<PublicSession[]>();

  protected readonly days = computed<ProgrammeDay[]>(() => {
    const map = new Map<string, ProgrammeDay>();
    const ordered = [...this.sessions()].sort(
      (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
    );
    for (const s of ordered) {
      const key = dayKey(s.startAt);
      if (!map.has(key)) map.set(key, { key, label: weekdayDay(s.startAt), sessions: [] });
      map.get(key)!.sessions.push(s);
    }
    return [...map.values()];
  });

  protected hours(s: PublicSession): string {
    const from = time(s.startAt);
    const to = time(s.endAt);
    return to && to !== from ? `${from} – ${to}` : from;
  }
}
