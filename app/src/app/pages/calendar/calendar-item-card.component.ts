import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { PillComponent } from '@keijo/ui';
import { celebration, close, eventRepeat, locationOn, meetingRoom, notes, school, schedule } from '@keijo/ui/icons';
import { IconComponent } from '@keijo/ui';
import { CalendarItem } from '../../core/domain/calendar';
import { formatDayLabel, formatTime } from '../../core/i18n/format';
import { CALENDAR_PALETTE } from './calendar-palette';

const KIND_LABEL: Record<CalendarItem['kind'], string> = {
  lesson: 'Lezione',
  openday: 'Open day',
  event: 'Evento',
  appointment: 'Appuntamento',
};

/**
 * **La scheda compatta** di una voce, come quella di Google (`20-calendario.md`
 * §7.3): titolo, quando, ripetizione, sala. Il corso o l'evento è una pill
 * `filled` che porta alla sua scheda sessioni.
 *
 * In questa consegna è in sola lettura: modifica ed eliminazione arrivano con
 * la scrittura dal calendario.
 */
@Component({
  selector: 'app-calendar-item-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PillComponent, IconComponent],
  template: `
    @let it = item();
    <header>
      <span class="swatch kind-{{ it.kind }}" [class.draft]="it.draft"></span>
      <div class="heading">
        <span class="eyebrow">
          {{ kindLabel() }}
          @if (it.draft) { · bozza }
          @if (it.cancelled) { · annullata }
        </span>
        <h3 [class.struck]="it.cancelled">{{ it.title }}</h3>
        @if (it.parentTitle) {
          <span class="parent">{{ it.parentTitle }}</span>
        }
      </div>
      <button type="button" class="close" aria-label="Chiudi" (click)="closed.emit()">
        <keijo-icon [icon]="closeIcon" />
      </button>
    </header>

    <dl>
      <div class="row">
        <dt><keijo-icon [icon]="scheduleIcon" [size]="18" /><span class="sr">Quando</span></dt>
        <dd>{{ when() }}</dd>
      </div>
      @if (it.seriesId) {
        <div class="row">
          <dt><keijo-icon [icon]="repeatIcon" [size]="18" /><span class="sr">Ripetizione</span></dt>
          <dd>Si ripete ogni settimana</dd>
        </div>
      }
      @if (it.room || it.venue) {
        <div class="row">
          <dt><keijo-icon [icon]="it.room ? roomIcon : placeIcon" [size]="18" /><span class="sr">Dove</span></dt>
          <dd>{{ where() }}</dd>
        </div>
      }
      @if (it.note) {
        <div class="row">
          <dt><keijo-icon [icon]="notesIcon" [size]="18" /><span class="sr">Note</span></dt>
          <dd class="note">{{ it.note }}</dd>
        </div>
      }
      @if (it.cancelled && it.cancellationReason) {
        <div class="row">
          <dt><span class="sr">Motivo</span></dt>
          <dd class="reason">Annullata: {{ it.cancellationReason }}</dd>
        </div>
      }
    </dl>

    @if (it.link; as link) {
      <div class="link">
        <keijo-pill
          variant="filled"
          [icon]="it.kind === 'event' ? eventIcon : courseIcon"
          [clickable]="true"
          [cursorPointer]="true"
          [tooltip]="'Apri ' + link.label"
          (action)="navigate.emit(link.path)"
        >
          {{ link.label }}
        </keijo-pill>
      </div>
    }
  `,
  styles: [
    CALENDAR_PALETTE,
    `
      :host {
        display: grid; gap: 0.75rem; width: min(22rem, calc(100vw - 2rem)); padding: 1rem;
        background: rgb(var(--foreground-color)); color: rgb(var(--text-rgb));
        border: 1px solid var(--color-default-border); border-radius: 16px; box-shadow: var(--keijo-shadow-2xl);
      }
      header { display: grid; grid-template-columns: auto 1fr auto; gap: 0.75rem; align-items: start; }
      .swatch { width: 0.9rem; height: 0.9rem; border-radius: 4px; margin-top: 0.3rem; background: var(--kind); }
      .swatch.draft { background: transparent; box-shadow: inset 0 0 0 2px var(--kind); }
      .heading { display: grid; gap: 0.1rem; min-width: 0; }
      .eyebrow { font-size: 0.7rem; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; opacity: 0.65; }
      h3 { margin: 0; font-size: 1.05rem; font-weight: 600; line-height: 1.3; overflow-wrap: anywhere; }
      h3.struck { text-decoration: line-through; }
      .parent { font-size: 0.85rem; opacity: 0.75; }
      .close {
        border: 0; background: none; color: inherit; cursor: pointer; border-radius: 999px;
        width: 2rem; height: 2rem; display: grid; place-items: center; opacity: 0.7;
      }
      .close:hover { background: rgba(var(--text-rgb), 0.08); opacity: 1; }
      dl { margin: 0; display: grid; gap: 0.5rem; }
      .row { display: grid; grid-template-columns: 1.5rem 1fr; gap: 0.5rem; align-items: start; }
      dt { opacity: 0.65; display: flex; }
      dd { margin: 0; font-size: 0.88rem; }
      .note { white-space: pre-line; }
      .reason { color: var(--color-error); }
      .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
      .link { display: flex; }
    `,
  ],
})
export class CalendarItemCardComponent {
  readonly item = input.required<CalendarItem>();
  readonly closed = output<void>();
  readonly navigate = output<string>();

  readonly closeIcon = close;
  readonly scheduleIcon = schedule;
  readonly repeatIcon = eventRepeat;
  readonly roomIcon = meetingRoom;
  readonly placeIcon = locationOn;
  readonly notesIcon = notes;
  readonly courseIcon = school;
  readonly eventIcon = celebration;

  readonly kindLabel = computed(() => KIND_LABEL[this.item().kind]);

  readonly when = computed(() => {
    const it = this.item();
    const sameDay = it.firstDay === it.lastDay;
    if (it.band) {
      return sameDay
        ? `${formatDayLabel(it.startAt)} · tutto il giorno`
        : `${formatDayLabel(it.startAt)} – ${formatDayLabel(it.lastDay)}`;
    }
    return sameDay
      ? `${formatDayLabel(it.startAt)} · ${formatTime(it.startAt)} – ${formatTime(it.endAt)}`
      : `${formatDayLabel(it.startAt)} ${formatTime(it.startAt)} – ${formatDayLabel(it.endAt)} ${formatTime(it.endAt)}`;
  });

  readonly where = computed(() => [this.item().room, this.item().venue].filter(Boolean).join(' · '));
}
