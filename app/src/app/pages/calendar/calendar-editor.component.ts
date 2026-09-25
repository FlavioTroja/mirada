import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  OnInit,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  ButtonComponent,
  CheckboxComponent,
  DateTimePickerComponent,
  FormRowComponent,
  FormWrapperComponent,
  IconComponent,
  InputComponent,
  SelectComponent,
  SelectOption,
  TextareaComponent,
} from '@keijo/ui';
import { check, close, meetingRoom, notes, openInNew, school, schedule } from '@keijo/ui/icons';
import { ApiClient } from '../../core/api/api.client';
import { ApiError } from '../../core/api/api-error';
import { CalendarItem, CalendarKind } from '../../core/domain/calendar';
import { formatDate, formatDayLabel } from '../../core/i18n/format';
import { LocaleService, i18nPlain } from '../../core/i18n/i18n-text';
import { DayKey, addDays, fromWallClock, minuteOfDay, weekdayOf } from '../../core/i18n/zoned';
import { CalendarStore, RecurrenceBody, SeriesScope } from '../../stores/calendar.store';
import { CALENDAR_PALETTE } from './calendar-palette';

/** Che cosa ha aperto il popup: uno spazio vuoto da riempire, o una voce da cambiare. */
export type EditorRequest =
  | { mode: 'create'; day: DayKey; startMinute: number; endMinute: number }
  | { mode: 'edit'; item: CalendarItem; scope: 'ONE' | SeriesScope };

type CreateKind = Exclude<CalendarKind, 'event'> | 'event';

/**
 * Il blocco provvisorio che la griglia disegna mentre il popup è aperto, come il
 * «(Senza titolo) 14:30 – 15:30» di Google: segue il titolo, l'orario e il tipo.
 */
export interface CalendarDraft {
  day: DayKey;
  startMinute: number;
  endMinute: number;
  allDay: boolean;
  title: string;
  kind: CalendarKind;
}

const TABS: { kind: CreateKind; label: string }[] = [
  { kind: 'lesson', label: 'Lezione' },
  { kind: 'openday', label: 'Open day' },
  { kind: 'appointment', label: 'Appuntamento' },
  { kind: 'event', label: 'Evento' },
];

const WEEKDAY_LETTERS = ['L', 'M', 'M', 'G', 'V', 'S', 'D'];
const WEEKDAY_NAMES = ['lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato', 'domenica'];
/** Lo stesso tetto del server: meglio dirlo qui che farsi rifiutare dopo. */
const MAX_OCCURRENCES = 104;

interface CourseRow {
  id: number;
  title: { it: string; en?: string };
  startAt: string;
}

/**
 * **Creare e modificare dal calendario** (`20-calendario.md` §7.2–7.3).
 *
 * In creazione, quattro schede: lezione, open day, appuntamento, e «evento»,
 * che non ha campi — un festival ha titoli, quote e cast che un popup non
 * contiene, e si apre la creazione evento con date e orari già compilati (K4).
 *
 * La ripetizione dice in chiaro che cosa succederà — «12 lezioni, dal 29
 * settembre al 15 dicembre» — prima di salvare, non dopo.
 */
@Component({
  selector: 'app-calendar-editor',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    ButtonComponent,
    CheckboxComponent,
    DateTimePickerComponent,
    FormRowComponent,
    FormWrapperComponent,
    IconComponent,
    InputComponent,
    SelectComponent,
    TextareaComponent,
  ],
  template: `
    <div class="grip" aria-hidden="true"></div>
    <button type="button" class="close" aria-label="Chiudi" (click)="cancelled.emit()">
      <keijo-icon [icon]="closeIcon" />
    </button>

    <form [formGroup]="form" (ngSubmit)="save()" class="body">
      <!-- In cima, come in Google, la cosa che si scrive per prima: il titolo
           di un appuntamento, o il corso di una lezione, che ne è il titolo. -->
      @if (!isCreate()) {
        <p class="eyebrow">{{ editTitle() }}</p>
      }
      @if (kind() === 'appointment') {
        <input
          #titleInput
          class="title-input"
          [formControl]="form.controls.title"
          placeholder="Aggiungi titolo"
          aria-label="Titolo"
          autocomplete="off"
        />
      } @else if (needsCourse()) {
        <div class="course">
          @if (courses().length) {
            <keijo-select
              [formControl]="form.controls.courseId"
              [data]="courses()"
              label="corso"
              placeholder="Scegli il corso"
            />
          } @else {
            <p class="hint">Nessun corso aperto: crea prima il corso da «Corsi».</p>
          }
        </div>
      } @else if (editedItem(); as item) {
        <p class="title-static">{{ item.title }}</p>
      } @else {
        <p class="title-static">Nuovo evento</p>
      }

      @if (isCreate()) {
        <div class="tabs" role="tablist" aria-label="Che cosa creare">
          @for (tab of tabs(); track tab.kind) {
            <button
              type="button"
              role="tab"
              class="kind-{{ tab.kind }}"
              [attr.aria-selected]="kind() === tab.kind"
              (click)="selectKind(tab.kind)"
            >
              {{ tab.label }}
            </button>
          }
        </div>
      }

      @if (kind() === 'event') {
        <div class="row">
          <keijo-icon [icon]="scheduleIcon" [size]="20" />
          <div>
            <div>{{ summaryWhen() }}</div>
            <div class="sub">Si apre la creazione dell'evento con data e orari già compilati</div>
          </div>
        </div>
        <p class="hint">
          Un festival o una milonga hanno titoli d'ingresso, quote e cast che qui non stanno.
        </p>
      } @else {
        <!-- Quando: una riga, come in Google. Un clic la apre in campi. -->
        @if (!detailsOpen()) {
          <button type="button" class="row summary" (click)="detailsOpen.set(true)" title="Cambia giorno, orario o ripetizione">
            <keijo-icon [icon]="scheduleIcon" [size]="20" />
            <div>
              <div>{{ summaryWhen() }}</div>
              <div class="sub">{{ summaryRepeat() }}</div>
            </div>
          </button>
        } @else {
          <div class="row">
            <keijo-icon [icon]="scheduleIcon" [size]="20" />
            <keijo-form-wrapper>
              <div class="fields">
                <keijo-form-row [cols]="1">
                  <keijo-date-picker [formControl]="form.controls.date" label="giorno" id="cal-date" />
                </keijo-form-row>
                @if (kind() === 'appointment') {
                  <keijo-checkbox [checked]="allDay()" (checkedChange)="allDay.set($event)" label="Tutto il giorno" />
                }
                @if (!allDay() || kind() !== 'appointment') {
                  <keijo-form-row [cols]="2">
                    <keijo-input [formControl]="form.controls.start" type="time" label="inizio" id="cal-start" />
                    <keijo-input [formControl]="form.controls.end" type="time" label="fine" id="cal-end" />
                  </keijo-form-row>
                  @if (overnight()) {
                    <p class="hint">Finisce il giorno dopo.</p>
                  }
                }
                @if (isCreate() && kind() !== 'openday') {
                  <keijo-form-row [cols]="1">
                    <keijo-select
                      [formControl]="form.controls.repeat"
                      [data]="repeatOptions()"
                      label="ripeti"
                      placeholder="Non si ripete"
                    />
                  </keijo-form-row>
                  @if (form.controls.repeat.value === 'custom') {
                    <div class="weekdays" role="group" aria-label="Giorni della settimana">
                      @for (letter of weekdayLetters; track $index) {
                        <button
                          type="button"
                          [attr.aria-pressed]="effectiveWeekdays().has($index + 1)"
                          [attr.aria-label]="weekdayNames[$index]"
                          [disabled]="$index + 1 === dayWeekday()"
                          (click)="toggleWeekday($index + 1)"
                        >
                          {{ letter }}
                        </button>
                      }
                    </div>
                  }
                  @if (form.controls.repeat.value !== 'none') {
                    <keijo-form-row [cols]="2">
                      <keijo-select
                        [formControl]="form.controls.endMode"
                        [data]="endModeOptions"
                        label="termina"
                        placeholder="Fino al"
                      />
                      @if (form.controls.endMode.value === 'until') {
                        <keijo-date-picker [formControl]="form.controls.until" label="fino al" id="cal-until" />
                      } @else {
                        <keijo-input [formControl]="form.controls.count" type="number" label="quante volte" id="cal-count" min="1" />
                      }
                    </keijo-form-row>
                  }
                }
              </div>
            </keijo-form-wrapper>
          </div>
        }

        @if (kind() === 'lesson' && (isCreate() || editsCourseSession())) {
          <div class="row">
            <keijo-icon [icon]="lessonIcon" [size]="20" />
            <input class="inline-input" [formControl]="form.controls.name" placeholder="Nome della lezione" aria-label="Nome della lezione" />
          </div>
        }
        <div class="row">
          <keijo-icon [icon]="roomIcon" [size]="20" />
          <input class="inline-input" [formControl]="form.controls.room" placeholder="Aggiungi sala" aria-label="Sala" />
        </div>
        @if (kind() === 'appointment') {
          <div class="row">
            <keijo-icon [icon]="notesIcon" [size]="20" />
            <textarea class="inline-input" rows="1" [formControl]="form.controls.note" placeholder="Aggiungi una nota" aria-label="Note"></textarea>
          </div>
        }
        @if (isCreate() && kind() === 'openday') {
          <p class="hint">L'open day si fa una volta, e non entra in nessun titolo d'ingresso.</p>
        }

        @if (preview(); as text) {
          <p class="preview" [class.bad]="previewIsError()">{{ text }}</p>
        }
      }

      @if (error()) {
        <p class="error" role="alert">{{ error() }}</p>
      }

      <div class="actions">
        @if (kind() !== 'event' && !detailsOpen()) {
          <button type="button" class="more" (click)="detailsOpen.set(true)">Altre opzioni</button>
        }
        @if (kind() === 'event') {
          <keijo-button variant="accent" [icon]="openIcon" label="Apri" tooltip="Apri la creazione dell'evento" (action)="openEventCreation()" />
        } @else {
          <keijo-button
            variant="accent"
            [icon]="checkIcon"
            label="Salva"
            [tooltip]="saveTooltip()"
            [loading]="saving()"
            [disabled]="saving()"
            (action)="save()"
          />
        }
      </div>
      <!-- Invio nel titolo salva, come in Google. -->
      <button type="submit" hidden></button>
    </form>
  `,
  styles: [
    CALENDAR_PALETTE,
    `
      :host {
        position: relative; display: block; width: min(28rem, calc(100vw - 2rem)); max-height: calc(100vh - 2rem);
        overflow-y: auto; padding: 0.75rem 1.25rem 1rem; background: rgb(var(--foreground-color));
        color: rgb(var(--text-rgb)); border: 1px solid var(--color-default-border); border-radius: 20px;
        box-shadow: var(--keijo-shadow-2xl);
      }
      .grip { width: 2.25rem; height: 0.25rem; border-radius: 999px; background: rgba(var(--text-rgb), 0.18); margin: 0 auto 0.5rem; }
      .close {
        position: absolute; top: 0.6rem; right: 0.6rem; border: 0; background: none; color: inherit; cursor: pointer;
        border-radius: 999px; width: 2.25rem; height: 2.25rem; display: grid; place-items: center; opacity: 0.7;
      }
      .close:hover { background: rgba(var(--text-rgb), 0.08); opacity: 1; }
      .body { display: grid; gap: 0.85rem; padding-top: 1.25rem; }
      .eyebrow { margin: 0; font-size: 0.72rem; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; opacity: 0.65; }

      /* Il titolo è grande come in Google, ma il riquadro resta quello del
         tema: un campo senza un confine a 3:1 non si distingue dallo sfondo
         (shared/mirada-theme.scss, WCAG 1.4.11), e quella regola vince apposta. */
      .title-input {
        width: 100%; font: inherit; font-size: 1.3rem; font-weight: 500; color: rgb(var(--text-rgb));
        padding: 0.45rem 0.75rem; border-radius: 12px;
      }
      .title-static { margin: 0; font-size: 1.3rem; font-weight: 600; }

      .tabs { display: flex; flex-wrap: wrap; gap: 0.25rem; }
      .tabs button {
        font: inherit; font-size: 0.85rem; font-weight: 600; padding: 0.4rem 0.75rem; border-radius: 8px;
        border: 0; background: none; color: rgb(var(--text-rgb)); cursor: pointer;
      }
      .tabs button:hover { background: rgba(var(--text-rgb), 0.06); }
      .tabs button[aria-selected='true'] { background: var(--kind); color: var(--kind-ink); }

      .row {
        display: grid; grid-template-columns: 1.5rem 1fr; gap: 0.9rem; align-items: start;
        font-size: 0.92rem; text-align: left;
      }
      .row > keijo-icon { opacity: 0.7; margin-top: 0.1rem; }
      .row.summary {
        font: inherit; font-size: 0.92rem; color: inherit; background: none; border: 0; padding: 0.35rem 0.25rem;
        margin: 0 -0.25rem; border-radius: 8px; cursor: pointer;
      }
      .row.summary:hover { background: rgba(var(--text-rgb), 0.06); }
      .sub { font-size: 0.78rem; opacity: 0.7; margin-top: 0.1rem; }
      .inline-input {
        width: 100%; font: inherit; font-size: 0.92rem; color: rgb(var(--text-rgb));
        padding: 0.35rem 0.6rem; border-radius: 10px; resize: vertical;
      }

      .fields { display: grid; gap: 0.75rem; }
      .weekdays { display: flex; gap: 0.3rem; flex-wrap: wrap; }
      .weekdays button {
        width: 2rem; height: 2rem; border-radius: 50%; font: inherit; font-size: 0.78rem; font-weight: 600;
        border: 1px solid var(--mirada-control-border); background: none; color: rgb(var(--text-rgb)); cursor: pointer;
      }
      .weekdays button[aria-pressed='true'] { background: rgb(var(--keijo-accent)); color: rgb(var(--mirada-on-accent)); border-color: transparent; }
      .weekdays button:disabled { cursor: default; }
      .hint { margin: 0; font-size: 0.82rem; opacity: 0.75; }
      .preview { margin: 0; font-size: 0.86rem; padding: 0.5rem 0.75rem; border-radius: 10px; background: rgba(var(--accent-rgb), 0.1); }
      .preview.bad, .error { color: var(--color-error); background: var(--color-error-light); }
      .error { margin: 0; font-size: 0.86rem; padding: 0.5rem 0.75rem; border-radius: 10px; }
      .actions { display: flex; justify-content: flex-end; align-items: center; gap: 0.75rem; margin-top: 0.25rem; }
      .more {
        font: inherit; font-size: 0.88rem; font-weight: 600; color: var(--color-accent); background: none;
        border: 0; padding: 0.5rem 0.75rem; border-radius: 999px; cursor: pointer;
      }
      .more:hover { background: rgba(var(--accent-rgb), 0.08); }
      button:focus-visible, .title-input:focus-visible { outline: 2px solid rgb(var(--keijo-accent)); outline-offset: 2px; }
    `,
  ],
})
export class CalendarEditorComponent implements OnInit {
  readonly request = input.required<EditorRequest>();
  /** Il messaggio da mostrare in un toast, a salvataggio riuscito. */
  readonly finished = output<string>();
  readonly cancelled = output<void>();

  private readonly titleInput = viewChild<ElementRef<HTMLInputElement>>('titleInput');
  private readonly injector = inject(Injector);
  private readonly store = inject(CalendarStore);
  private readonly api = inject(ApiClient);
  private readonly router = inject(Router);
  private readonly locale = inject(LocaleService);
  private readonly destroyRef = inject(DestroyRef);

  readonly closeIcon = close;
  readonly checkIcon = check;
  readonly openIcon = openInNew;
  readonly scheduleIcon = schedule;
  readonly roomIcon = meetingRoom;
  readonly notesIcon = notes;
  readonly lessonIcon = school;

  /** La riga «quando» aperta in campi. In creazione parte chiusa, come in Google. */
  readonly detailsOpen = signal(false);

  /** Ciò che la griglia disegna al posto del blocco «(Senza titolo)», mentre si scrive. */
  readonly draft = output<CalendarDraft>();
  readonly weekdayLetters = WEEKDAY_LETTERS;
  readonly weekdayNames = WEEKDAY_NAMES;

  readonly kind = signal<CreateKind>('lesson');
  readonly allDay = signal(false);
  readonly weekdays = signal<Set<number>>(new Set());
  readonly courses = signal<SelectOption[]>([]);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  /** Cambia a ogni modifica del form: i `computed` che leggono i controlli lo seguono. */
  private readonly revision = signal(0);

  readonly form = new FormGroup({
    courseId: new FormControl<number | null>(null),
    name: new FormControl('Lezione', { nonNullable: true }),
    title: new FormControl('', { nonNullable: true }),
    date: new FormControl<Date | null>(null),
    start: new FormControl('20:30', { nonNullable: true }),
    end: new FormControl('22:00', { nonNullable: true }),
    room: new FormControl('', { nonNullable: true }),
    note: new FormControl('', { nonNullable: true }),
    repeat: new FormControl<'none' | 'weekly' | 'custom'>('none', { nonNullable: true }),
    endMode: new FormControl<'until' | 'count'>('until', { nonNullable: true }),
    until: new FormControl<Date | null>(null),
    count: new FormControl(12, { nonNullable: true }),
  });

  readonly endModeOptions: SelectOption[] = [
    { label: 'Fino al', value: 'until' },
    { label: 'Per un numero di volte', value: 'count' },
  ];

  readonly isCreate = computed(() => this.request().mode === 'create');
  readonly tabs = computed(() => TABS);

  readonly editedItem = computed(() => {
    const request = this.request();
    return request.mode === 'edit' ? request.item : null;
  });

  readonly editsCourseSession = computed(() => {
    const item = this.editedItem();
    return item?.ref.type === 'session' && item.ref.course;
  });

  readonly needsCourse = computed(() => this.isCreate() && (this.kind() === 'lesson' || this.kind() === 'openday'));

  readonly editTitle = computed(() => {
    const request = this.request();
    if (request.mode !== 'edit') return '';
    const what = request.item.kind === 'appointment' ? 'appuntamento' : request.item.kind === 'openday' ? 'open day' : request.item.ref.type === 'session' && request.item.ref.course ? 'lezione' : 'sessione';
    const scope = request.scope === 'ALL' ? ' · tutta la serie' : request.scope === 'FOLLOWING' ? ' · questa e le successive' : '';
    return `Modifica ${what}${scope}`;
  });

  readonly day = computed<DayKey | null>(() => {
    this.revision();
    const date = this.form.controls.date.value;
    return date ? dayKeyOfPicked(date) : null;
  });

  readonly dayWeekday = computed(() => {
    const day = this.day();
    return day ? weekdayOf(day) : 0;
  });

  /**
   * I giorni scelti **più quello della prima occorrenza**: il server rifiuta una
   * serie che non comincia in uno dei suoi giorni, e il giorno su cui si è
   * cliccato non può non esserci. Il suo pulsante è acceso e bloccato.
   */
  readonly effectiveWeekdays = computed(() => {
    const weekday = this.dayWeekday();
    return weekday ? new Set([...this.weekdays(), weekday]) : this.weekdays();
  });

  readonly repeatOptions = computed<SelectOption[]>(() => {
    const weekday = this.dayWeekday();
    return [
      { label: 'Non si ripete', value: 'none' },
      { label: weekday ? `Ogni settimana di ${WEEKDAY_NAMES[weekday - 1]}` : 'Ogni settimana', value: 'weekly' },
      { label: 'Personalizza…', value: 'custom' },
    ];
  });

  readonly overnight = computed(() => {
    this.revision();
    const start = parseClock(this.form.controls.start.value);
    const end = parseClock(this.form.controls.end.value);
    return start !== null && end !== null && end <= start;
  });

  /** Le date che la ripetizione produrrà, calcolate qui come le calcolerà il server. */
  private readonly occurrences = computed<DayKey[] | null>(() => {
    this.revision();
    const day = this.day();
    const repeat = this.form.controls.repeat.value;
    if (!day || !this.isCreate() || this.kind() === 'openday' || this.kind() === 'event' || repeat === 'none') return null;
    const selected = repeat === 'weekly' ? new Set([weekdayOf(day)]) : this.effectiveWeekdays();
    const until = this.form.controls.endMode.value === 'until' && this.form.controls.until.value
      ? dayKeyOfPicked(this.form.controls.until.value)
      : null;
    const count = this.form.controls.endMode.value === 'count' ? Number(this.form.controls.count.value) : null;
    if (!until && !count) return [];
    const out: DayKey[] = [];
    for (let d = day; out.length <= MAX_OCCURRENCES; d = addDays(d, 1)) {
      if (until && d > until) break;
      if (count && out.length >= count) break;
      if (selected.has(weekdayOf(d))) out.push(d);
    }
    return out;
  });

  readonly previewIsError = computed(() => {
    const dates = this.occurrences();
    return !!dates && (dates.length === 0 || dates.length > MAX_OCCURRENCES);
  });

  readonly preview = computed<string | null>(() => {
    const dates = this.occurrences();
    if (!dates) return null;
    if (!dates.length) return 'Nessuna data: controlla la fine della ripetizione.';
    if (dates.length > MAX_OCCURRENCES) return `Oltre ${MAX_OCCURRENCES} volte: accorcia la ripetizione.`;
    const noun = this.kind() === 'lesson'
      ? dates.length === 1 ? 'lezione' : 'lezioni'
      : dates.length === 1 ? 'appuntamento' : 'appuntamenti';
    const first = longDay(dates[0]!);
    const last = longDay(dates[dates.length - 1]!);
    const from = /^(1|8|11)\b/.test(first) ? `dall'${first}` : `dal ${first}`;
    return dates.length === 1 ? `1 ${noun}, il ${first}.` : `${dates.length} ${noun}, ${from} al ${last}.`;
  });

  readonly slotLabel = computed(() => {
    this.revision();
    const day = this.day();
    return day ? `${formatDate(fromWallClock(day, 12))}, ${this.form.controls.start.value}–${this.form.controls.end.value}` : 'date e orari';
  });

  readonly summaryWhen = computed(() => {
    this.revision();
    const day = this.day();
    if (!day) return 'Scegli il giorno';
    const label = formatDayLabel(fromWallClock(day, 12));
    const dayText = label.charAt(0).toUpperCase() + label.slice(1);
    if (this.kind() === 'appointment' && this.allDay()) return `${dayText} · tutto il giorno`;
    return `${dayText}   ${this.form.controls.start.value} – ${this.form.controls.end.value}${this.overnight() ? ' (il giorno dopo)' : ''}`;
  });

  readonly summaryRepeat = computed(() => {
    this.revision();
    if (!this.isCreate()) return this.editedItem()?.seriesId ? 'Fa parte di una serie' : 'Non si ripete';
    if (this.kind() === 'openday') return 'Una volta sola';
    const repeat = this.form.controls.repeat.value;
    if (repeat === 'none') return 'Non si ripete';
    return this.preview() ?? 'Si ripete';
  });

  readonly saveTooltip = computed(() => (this.isCreate() ? 'Crea sul calendario' : 'Salva le modifiche'));

  ngOnInit(): void {
    const sub = this.form.valueChanges.subscribe(() => {
      this.revision.update((n) => n + 1);
      this.error.set(null);
    });
    this.destroyRef.onDestroy(() => sub.unsubscribe());

    // Il blocco provvisorio sulla griglia segue il popup.
    effect(
      () => {
        this.revision();
        const day = this.day();
        const start = parseClock(this.form.controls.start.value);
        const end = parseClock(this.form.controls.end.value);
        if (!day || start === null || end === null) return;
        const kind = this.kind();
        this.draft.emit({
          day,
          startMinute: start,
          endMinute: end > start ? end : 24 * 60,
          allDay: kind === 'appointment' && this.allDay(),
          title: this.draftTitle(),
          kind: kind === 'event' ? 'event' : kind,
        });
      },
      { injector: this.injector },
    );

    const request = this.request();
    if (request.mode === 'edit') this.detailsOpen.set(true);
    if (request.mode === 'create') {
      this.form.patchValue({
        date: pickedOf(request.day),
        start: clockOf(request.startMinute),
        end: clockOf(Math.min(request.endMinute, 24 * 60 - 1)),
        until: pickedOf(addDays(request.day, 7 * 11)),
      });
      this.weekdays.set(new Set([weekdayOf(request.day)]));
      void this.loadCourses();
    } else {
      this.prefill(request.item);
    }
  }

  selectKind(kind: CreateKind): void {
    this.kind.set(kind);
    this.error.set(null);
    if (kind === 'appointment') this.focusTitle();
  }

  private focusTitle(): void {
    afterNextRender(() => this.titleInput()?.nativeElement.focus(), { injector: this.injector });
  }

  /** Il nome che il blocco provvisorio porta: quello che si sta scrivendo, o «(Senza titolo)». */
  private draftTitle(): string {
    const value = this.form.getRawValue();
    const edited = this.editedItem();
    if (edited) return edited.kind === 'appointment' ? value.title.trim() || edited.title : edited.title;
    switch (this.kind()) {
      case 'appointment':
        return value.title.trim() || '(Senza titolo)';
      case 'lesson':
      case 'openday': {
        const course = this.courses().find((c) => c.value === value.courseId);
        const prefix = this.kind() === 'openday' ? 'Open day · ' : '';
        return course ? `${prefix}${course.label}` : `${prefix}(Scegli il corso)`;
      }
      default:
        return 'Nuovo evento';
    }
  }

  toggleWeekday(weekday: number): void {
    const next = new Set(this.weekdays());
    if (next.has(weekday)) next.delete(weekday);
    else next.add(weekday);
    this.weekdays.set(next);
  }

  openEventCreation(): void {
    const times = this.times();
    if (!times) return;
    void this.router.navigate(['/events/new'], {
      queryParams: { startAt: times.startAt, endAt: times.endAt },
    });
    this.cancelled.emit();
  }

  async save(): Promise<void> {
    if (this.saving()) return;
    const problem = this.validate();
    if (problem) {
      this.error.set(problem);
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    try {
      const request = this.request();
      const message = request.mode === 'create' ? await this.create() : await this.update(request.item, request.scope);
      this.finished.emit(message);
    } catch (err) {
      this.error.set(err instanceof ApiError ? err.message : 'Non è stato possibile salvare. Riprova.');
    } finally {
      this.saving.set(false);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────

  private async create(): Promise<string> {
    const times = this.times()!;
    const recurrence = this.recurrence();
    const value = this.form.getRawValue();

    if (this.kind() === 'appointment') {
      const created = await this.store.scheduleAppointments({
        title: value.title.trim(),
        note: value.note.trim() || null,
        room: value.room.trim() || null,
        allDay: this.allDay(),
        ...times,
        ...(recurrence && { recurrence }),
      });
      return created.length === 1 ? 'Appuntamento aggiunto.' : `Aggiunti ${created.length} appuntamenti.`;
    }

    const openDay = this.kind() === 'openday';
    const result = await this.store.scheduleSessions({
      eventId: value.courseId!,
      name: { it: openDay ? 'Open day' : value.name.trim() || 'Lezione' },
      kind: openDay ? 'OPEN_DAY' : 'REGULAR',
      room: value.room.trim() || null,
      ...times,
      ...(recurrence && !openDay && { recurrence }),
    });
    if (openDay) return 'Open day aggiunto. Non entra in nessun titolo d’ingresso.';

    const n = result.sessions.length;
    const added = n === 1 ? 'Aggiunta 1 lezione.' : `Aggiunte ${n} lezioni.`;
    const titles = result.extendedTicketTypes.map((t) => `«${i18nPlain(t.name, this.locale.lang())}»`);
    if (!titles.length) return added;
    const them = n === 1 ? 'la comprende' : 'le comprende';
    return titles.length === 1
      ? `${added} Il titolo ${titles[0]} ora ${them}.`
      : `${added} I titoli ${titles.join(', ')} ora ${n === 1 ? 'la comprendono' : 'le comprendono'}.`;
  }

  private async update(item: CalendarItem, scope: 'ONE' | SeriesScope): Promise<string> {
    const times = this.times()!;
    const value = this.form.getRawValue();
    const ref = item.ref;
    if (ref.type === 'event') return '';

    const base = ref.type === 'session' ? 'sessions' : 'appointments';
    const fields: Record<string, unknown> = { room: value.room.trim() || null };
    if (ref.type === 'session' && ref.course && item.kind === 'lesson') {
      fields['name'] = { ...ref.name, it: value.name.trim() || 'Lezione' };
    }
    if (ref.type === 'appointment') {
      fields['title'] = value.title.trim();
      fields['note'] = value.note.trim() || null;
    }

    if (scope === 'ONE') {
      await this.store.updateOne(base, ref.id, {
        ...fields,
        ...times,
        ...(ref.type === 'appointment' && { allDay: this.allDay() }),
        // «Solo questo» fa uscire la riga dalla serie: cambiata da sola, non è
        // più «ogni martedì alle 20:30» come le altre.
        ...(item.seriesId && { seriesId: null }),
      });
      return 'Modifica salvata.';
    }
    const changed = await this.store.updateSeries(base, ref.id, { scope, ...fields, ...times });
    const n = Array.isArray(changed) ? changed.length : 0;
    return n === 1 ? 'Modificata 1 voce della serie.' : `Modificate ${n} voci della serie.`;
  }

  private prefill(item: CalendarItem): void {
    this.kind.set(item.kind === 'event' ? 'event' : item.kind);
    this.allDay.set(item.ref.type === 'appointment' && item.ref.allDay);
    this.form.patchValue({
      name: item.ref.type === 'session' ? i18nPlain(item.ref.name, this.locale.lang()) : '',
      title: item.ref.type === 'appointment' ? item.title : '',
      date: pickedOf(item.firstDay),
      start: clockOf(minuteOfDay(item.startAt)),
      end: clockOf(minuteOfDay(item.endAt)),
      room: item.room ?? '',
      note: item.note ?? '',
    });
  }

  private async loadCourses(): Promise<void> {
    try {
      const page = await this.api.list<CourseRow>(
        'events',
        { eventTypeFamily: 'COURSE', status: ['DRAFT', 'PUBLISHED', 'SALES_CLOSED', 'RUNNING'] },
        { limit: 100, sort: { startAt: 'desc' } },
      );
      const options = page.docs.map((course) => ({ label: i18nPlain(course.title, this.locale.lang()), value: course.id }));
      this.courses.set(options);
      if (options.length === 1) this.form.controls.courseId.setValue(options[0]!.value as number);
      // Senza corsi non si crea una lezione: si parte dall'appuntamento, col
      // cursore sul titolo, come in Google.
      if (!options.length && this.kind() === 'lesson') this.selectKind('appointment');
      this.revision.update((n) => n + 1);
    } catch {
      this.courses.set([]);
      if (this.kind() === 'lesson') this.selectKind('appointment');
    }
  }

  /** Gli istanti di inizio e fine, in ora di Roma; una fine che non segue l'inizio è il giorno dopo. */
  private times(): { startAt: string; endAt: string } | null {
    const day = this.day();
    if (!day) return null;
    if (this.kind() === 'appointment' && this.allDay()) {
      return { startAt: fromWallClock(day).toISOString(), endAt: fromWallClock(addDays(day, 1)).toISOString() };
    }
    const start = parseClock(this.form.controls.start.value);
    const end = parseClock(this.form.controls.end.value);
    if (start === null || end === null) return null;
    const endDay = end <= start ? addDays(day, 1) : day;
    return {
      startAt: fromWallClock(day, Math.floor(start / 60), start % 60).toISOString(),
      endAt: fromWallClock(endDay, Math.floor(end / 60), end % 60).toISOString(),
    };
  }

  private recurrence(): RecurrenceBody | undefined {
    const day = this.day();
    const repeat = this.form.controls.repeat.value;
    if (!day || repeat === 'none') return undefined;
    const weekdays = repeat === 'weekly' ? [weekdayOf(day)] : [...this.effectiveWeekdays()].sort();
    return this.form.controls.endMode.value === 'until'
      ? { weekdays, until: dayKeyOfPicked(this.form.controls.until.value!) }
      : { weekdays, count: Number(this.form.controls.count.value) };
  }

  private validate(): string | null {
    const problem = this.firstProblem();
    // Un errore su un campo che non si vede non si corregge: si apre la riga.
    if (problem && !/corso|titolo/.test(problem)) this.detailsOpen.set(true);
    return problem;
  }

  private firstProblem(): string | null {
    const value = this.form.getRawValue();
    if (!this.day()) return 'Scegli il giorno.';
    if (this.needsCourse() && !value.courseId) return 'Scegli il corso.';
    if (this.kind() === 'appointment' && !value.title.trim()) return 'Scrivi un titolo.';
    if (!(this.kind() === 'appointment' && this.allDay())) {
      const start = parseClock(value.start);
      const end = parseClock(value.end);
      if (start === null || end === null) return 'Indica l’ora di inizio e di fine.';
      if (start === end) return 'La fine deve essere diversa dall’inizio.';
    }
    if (this.isCreate() && value.repeat !== 'none' && this.kind() !== 'openday') {
      if (value.endMode === 'until' && !value.until) return 'Indica fino a quando si ripete.';
      if (value.endMode === 'count' && !(Number(value.count) >= 1)) return 'Indica quante volte si ripete.';
      if (this.previewIsError()) return this.preview();
    }
    return null;
  }
}

/**
 * Il selettore restituisce la mezzanotte **del browser** del giorno scelto: il
 * giorno è quello che l'utente ha visto, e si legge con i campi locali.
 */
function dayKeyOfPicked(date: Date): DayKey {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function pickedOf(day: DayKey): Date {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d);
}

const longDayFmt = new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', day: 'numeric', month: 'long' });

/** «29 settembre»: come lo si dice, non come lo si scrive in un modulo. */
function longDay(day: DayKey): string {
  return longDayFmt.format(fromWallClock(day, 12));
}

function clockOf(minute: number): string {
  return `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
}

function parseClock(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})/.exec(value ?? '');
  if (!match) return null;
  const minute = +match[1]! * 60 + +match[2]!;
  return minute < 24 * 60 ? minute : null;
}
