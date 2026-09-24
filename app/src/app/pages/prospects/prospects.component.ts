import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { debounceTime } from 'rxjs/operators';
import {
  ButtonComponent,
  CheckboxComponent,
  EntityListItemComponent,
  FormRowComponent,
  FormWrapperComponent,
  InfoBoxComponent,
  InputComponent,
  KeijoFilterChange,
  KeijoFilterTab,
  ListItemsSkeletonComponent,
  ListItemsWrapperComponent,
  PageSectionWrapperComponent,
  PageWrapperComponent,
  PillComponent,
  SearchBarComponent,
  SectionActionButton,
  SelectComponent,
  SelectOption,
  TextareaComponent,
} from '@keijo/ui';
import {
  add,
  call,
  chat,
  check,
  close,
  contactPhone,
  contentCopy,
  doneAll,
  download,
  edit,
  iconDelete,
  mail,
  markEmailRead,
  school,
} from '@keijo/ui/icons';
import { HeaderTitleService } from '../../services/header-title.service';
import { PageAction, PageActionsService } from '../../services/page-actions.service';
import { ToastService } from '../../services/toast.service';
import {
  PREFERRED_DANCE_ROLE_OPTIONS,
  PREFERRED_DANCE_ROLE_UI,
  PROSPECT_CONVERTED_UI,
  PROSPECT_STATUS_OPTIONS,
  PROSPECT_STATUS_UI,
  PreferredDanceRole,
  ProspectStatus,
} from '../../core/domain/enums';
import { Prospect } from '../../core/domain/models';
import { formatDate } from '../../core/i18n/format';
import { LocaleService, resolveI18n } from '../../core/i18n/i18n-text';
import { EventStore } from '../../stores/event.store';
import { ProspectQuery, ProspectStore } from '../../stores/prospect.store';
import { ConfirmService } from '../../shared/confirm.service';
import { StatusPillComponent } from '../../shared/status-pill.component';
import { applyZodIssues, clearServerErrors, controlError } from '../../shared/form-errors';
import { EventWorkspaceNavComponent } from '../events/event-workspace-nav.component';

/** Il filtro «Stato» della pagina: i tre stati dichiarati, più il fatto «iscritto». */
type StatusFilter = ProspectStatus | 'CONVERTED';

/**
 * **I prospect dell'open day** — `19-prospect.md`.
 *
 * Una pagina, due porte:
 *
 *  - `/courses/:id/prospects`, la scheda «Open day» del corso: si raccolgono i
 *    contatti lì dove si è, e il corso di provenienza è quello;
 *  - `/prospects`, l'elenco della scuola: all'apertura del corso successivo si
 *    filtra «da ricontattare», si copiano le email o si esporta, e si segnano
 *    tutti contattati.
 *
 * Mirada non manda messaggi: li scrive la segreteria, con i suoi mezzi. Qui si
 * tiene l'elenco, e chi si iscrive ne esce da solo — il server lo riconosce
 * dall'email.
 */
@Component({
  selector: 'app-prospects',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    PageWrapperComponent,
    PageSectionWrapperComponent,
    SearchBarComponent,
    ListItemsWrapperComponent,
    ListItemsSkeletonComponent,
    EntityListItemComponent,
    ButtonComponent,
    PillComponent,
    InfoBoxComponent,
    FormWrapperComponent,
    FormRowComponent,
    InputComponent,
    TextareaComponent,
    SelectComponent,
    CheckboxComponent,
    StatusPillComponent,
    EventWorkspaceNavComponent,
  ],
  template: `
    <keijo-page-wrapper>
      @if (courseId()) {
        <app-event-workspace-nav [event]="eventStore.current()" current="prospects" />
      }

      @if (editing()) {
        <keijo-page-section-wrapper
          [title]="editingId() ? 'Modifica contatto' : 'Nuovo contatto dall’open day'"
          [buttons]="editButtons"
          (buttonClick)="onEditAction($event)"
        >
          @if (formErrors().length) {
            <p class="mirada-error">{{ formErrors().join(' ') }}</p>
          }

          <keijo-form-wrapper [formGroup]="form">
            <keijo-form-row [cols]="2">
              <keijo-input [formControl]="form.controls.name" label="nome" id="prospectName" type="text" />
              <keijo-input
                [formControl]="form.controls.surname"
                label="cognome"
                id="prospectSurname"
                type="text"
              />
            </keijo-form-row>
            @if (err('name'); as msg) {
              <p class="mirada-error">{{ msg }}</p>
            }

            <keijo-form-row [cols]="3">
              <keijo-input [formControl]="form.controls.email" label="email" id="prospectEmail" type="email" />
              <keijo-input [formControl]="form.controls.phone" label="telefono" id="prospectPhone" type="tel" />
              <keijo-select
                [formControl]="form.controls.preferredRole"
                [data]="roleOptions"
                label="ruolo"
                placeholder="Leader, follower, entrambi"
              />
            </keijo-form-row>
            @if (err('email'); as msg) {
              <p class="mirada-error">{{ msg }}</p>
            }
            <p class="mirada-hint">Basta un recapito: email o telefono.</p>

            @if (!courseId() && editingId() === null) {
              <keijo-form-row [cols]="1">
                <keijo-select
                  [formControl]="form.controls.sourceEventId"
                  [data]="courseOptions()"
                  label="corso dell’open day"
                  placeholder="Scegli il corso"
                />
              </keijo-form-row>
            }

            @if (editingId() !== null) {
              <keijo-form-row [cols]="1">
                <keijo-select
                  [formControl]="form.controls.status"
                  [data]="statusOptions"
                  label="stato"
                  placeholder="Stato del contatto"
                />
              </keijo-form-row>
            }

            <keijo-form-row [cols]="1">
              <keijo-textarea
                [formControl]="form.controls.note"
                label="note"
                id="prospectNote"
                [rows]="2"
              />
            </keijo-form-row>

            @if (editingId() === null) {
              <keijo-form-row [cols]="1">
                <keijo-checkbox
                  [formControl]="form.controls.consent"
                  label="Ha acconsentito a essere ricontattato per i prossimi corsi"
                />
              </keijo-form-row>
              @if (err('consent'); as msg) {
                <p class="mirada-error">{{ msg }}</p>
              }
            }
          </keijo-form-wrapper>
        </keijo-page-section-wrapper>
      }

      <keijo-page-section-wrapper mode="plain">
        <keijo-search-bar
          [search]="search"
          [filterTabs]="filterTabs()"
          filterTooltip="Filtra i contatti"
          (filterChanged)="onFilterChanged($event)"
          (removeFiltersFromTab)="onFiltersCleared($event)"
        />

        @if (store.loading()) {
          <keijo-list-items-skeleton />
        } @else {
          <keijo-list-items-wrapper>
            @for (row of store.items(); track row.id) {
              <keijo-entity-list-item [expandable]="true">
                <ng-template #primary>
                  <div class="primary">
                    <span class="title">{{ fullName(row) }}</span>
                    <span class="mirada-muted">{{ recapiti(row) }}</span>
                  </div>
                </ng-template>
                <ng-template #secondary>
                  <div class="secondary">
                    <app-status-pill [status]="statusUi(row)" />
                    @if (row.preferredRole) {
                      <app-status-pill [status]="roleUi(row.preferredRole)" />
                    }
                    @if (!courseId()) {
                      <keijo-pill variant="default" [icon]="courseIcon">{{ courseTitle(row) }}</keijo-pill>
                    }
                    @if (row.convertedRegistration?.event; as ev) {
                      <span class="mirada-muted">iscritto a {{ title(ev.title) }}</span>
                    } @else if (row.contactedAt) {
                      <span class="mirada-muted">contattato il {{ date(row.contactedAt) }}</span>
                    }
                    @if (row.note) {
                      <span class="mirada-muted">{{ row.note }}</span>
                    }
                  </div>
                </ng-template>
                <ng-template #actions>
                  @if (row.email) {
                    <keijo-button [icon]="mailIcon" tooltip="Scrivi un’email" (action)="writeEmail(row)" />
                  }
                  @if (row.phone) {
                    <keijo-button [icon]="chatIcon" tooltip="Scrivi su WhatsApp" (action)="openWhatsApp(row)" />
                    <keijo-button [icon]="callIcon" tooltip="Chiama" (action)="callPhone(row)" />
                  }
                  @if (!row.convertedRegistrationId && row.status === 'TO_CONTACT') {
                    <keijo-button
                      variant="accent"
                      [icon]="contactedIcon"
                      tooltip="Segna come contattato"
                      (action)="setStatus(row, 'CONTACTED')"
                    />
                  }
                  <keijo-button
                    variant="error"
                    [icon]="deleteIcon"
                    tooltip="Elimina il contatto"
                    (action)="remove(row)"
                  />
                  <keijo-button
                    variant="warning"
                    [icon]="editIcon"
                    tooltip="Modifica il contatto"
                    (action)="startEdit(row)"
                  />
                </ng-template>
              </keijo-entity-list-item>
            } @empty {
              <keijo-info-box [icon]="prospectIcon" [title]="emptyTitle()" variant="info">
                <span>
                  Chi viene all’open day e non si iscrive è un contatto da non perdere: si raccoglie
                  qui, con il suo consenso, e si ricontatta all’apertura del prossimo corso. Chi poi
                  si iscrive esce da solo dall’elenco da chiamare.
                </span>
              </keijo-info-box>
            }
          </keijo-list-items-wrapper>
        }
      </keijo-page-section-wrapper>
    </keijo-page-wrapper>
  `,
  styles: [
    `
      .primary {
        display: flex;
        flex-direction: column;
        min-width: 0;
      }
      .title {
        font-weight: 600;
      }
      .secondary {
        display: flex;
        flex-wrap: wrap;
        gap: 0.375rem;
        align-items: center;
      }
    `,
  ],
})
export class ProspectsComponent implements OnInit {
  private readonly headerTitle = inject(HeaderTitleService);
  private readonly pageActions = inject(PageActionsService);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly locale = inject(LocaleService);

  readonly store = inject(ProspectStore);
  readonly eventStore = inject(EventStore);

  readonly prospectIcon = contactPhone;
  readonly courseIcon = school;
  readonly mailIcon = mail;
  readonly chatIcon = chat;
  readonly callIcon = call;
  readonly contactedIcon = markEmailRead;
  readonly editIcon = edit;
  readonly deleteIcon = iconDelete;

  /** Il corso della scheda «Open day»; `null` sull'elenco della scuola. */
  readonly courseId = signal<number | null>(null);
  readonly courseOptions = signal<SelectOption[]>([]);

  readonly search = new FormControl('', { nonNullable: true });
  readonly editing = signal(false);
  readonly editingId = signal<number | null>(null);
  readonly formErrors = signal<string[]>([]);

  readonly roleOptions: SelectOption[] = PREFERRED_DANCE_ROLE_OPTIONS;
  readonly statusOptions: SelectOption[] = PROSPECT_STATUS_OPTIONS;

  /**
   * L'elenco della scuola si apre su **«Da ricontattare»**: è la domanda per
   * cui ci si arriva. La scheda del corso li mostra tutti, perché lì si sta
   * guardando chi è venuto, non chi chiamare.
   */
  private readonly defaultStatus = computed<StatusFilter | null>(() =>
    this.courseId() ? null : 'TO_CONTACT',
  );

  readonly filterTabs = computed<KeijoFilterTab[]>(() => {
    const tabs: KeijoFilterTab[] = [
      {
        field: 'status',
        name: 'Stato',
        kind: 'single',
        selectIds: this.defaultStatus() ? [this.defaultStatus()!] : [],
        options: [
          ...PROSPECT_STATUS_OPTIONS.map((o) => ({
            id: o.value,
            name: o.label,
            checked: o.value === this.defaultStatus(),
          })),
          { id: 'CONVERTED', name: PROSPECT_CONVERTED_UI.label, checked: false },
        ],
      },
    ];
    if (!this.courseId()) {
      tabs.push({
        field: 'sourceEventId',
        name: 'Corso',
        kind: 'single',
        selectIds: [],
        options: this.courseOptions().map((o) => ({
          id: o.value as number,
          name: o.label,
          checked: false,
        })),
      });
    }
    return tabs;
  });

  readonly emptyTitle = computed(() =>
    this.courseId() ? 'Nessun contatto da questo open day' : 'Nessun contatto con questi filtri',
  );

  readonly editButtons: SectionActionButton[] = [
    { id: 'save', icon: check, label: 'Salva', variant: 'accent' },
    { id: 'cancel', icon: close, label: 'Annulla', variant: 'default' },
  ];

  readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    surname: new FormControl('', { nonNullable: true }),
    email: new FormControl('', { nonNullable: true }),
    phone: new FormControl('', { nonNullable: true }),
    preferredRole: new FormControl<PreferredDanceRole | null>(null),
    sourceEventId: new FormControl<number | null>(null),
    status: new FormControl<ProspectStatus>('TO_CONTACT', { nonNullable: true }),
    note: new FormControl('', { nonNullable: true }),
    consent: new FormControl(false, { nonNullable: true }),
  });

  constructor() {
    this.search.valueChanges
      .pipe(debounceTime(300), takeUntilDestroyed())
      .subscribe((value) => void this.store.setQuery({ value: value || undefined }));
  }

  async ngOnInit(): Promise<void> {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.courseId.set(id || null);
    this.headerTitle.set(id ? 'Open day' : 'Prospect');
    this.registerActions();

    const query: ProspectQuery = id
      ? { sourceEventId: id }
      : { ...this.statusQuery(this.defaultStatus()) };
    await Promise.all([
      id ? this.eventStore.loadOne(id) : this.loadCourses(),
      this.store.replaceQuery(query),
    ]);
  }

  private registerActions(): void {
    const actions: PageAction[] = [
      {
        id: 'create',
        icon: add,
        label: 'Aggiungi',
        tooltip: 'Aggiungi un contatto dall’open day',
        run: () => this.startCreate(),
      },
      {
        id: 'copy-emails',
        icon: contentCopy,
        tooltip: 'Copia le email dei contatti in elenco',
        run: () => void this.copyEmails(),
      },
      {
        id: 'export',
        icon: download,
        tooltip: 'Esporta l’elenco in CSV',
        run: () => this.exportCsv(),
      },
      {
        id: 'mark-contacted',
        icon: doneAll,
        tooltip: 'Segna come contattati tutti quelli da ricontattare in elenco',
        run: () => void this.markAllContacted(),
      },
    ];
    this.pageActions.set(actions);
  }

  private async loadCourses(): Promise<void> {
    const courses = await this.eventStore.loadAll({ eventTypeFamily: 'COURSE' }, 200, '');
    this.courseOptions.set(
      courses.map((c) => ({ label: `${this.title(c.title)} · ${formatDate(c.startAt)}`, value: c.id })),
    );
  }

  // ── Filtri ──────────────────────────────────────────────────────────────

  /** «Iscritto» è un fatto, gli altri sono stati: e chi è iscritto non va chiamato. */
  private statusQuery(filter: StatusFilter | null): Pick<ProspectQuery, 'status' | 'converted'> {
    if (!filter) return { status: undefined, converted: undefined };
    if (filter === 'CONVERTED') return { status: undefined, converted: true };
    return { status: filter, converted: false };
  }

  onFilterChanged(change: KeijoFilterChange): void {
    const ids = Array.isArray(change.value) ? change.value : [];
    if (change.field === 'status') {
      void this.store.setQuery(this.statusQuery(ids.length ? (ids[0] as StatusFilter) : null));
    }
    if (change.field === 'sourceEventId') {
      void this.store.setQuery({ sourceEventId: ids.length ? Number(ids[0]) : undefined });
    }
  }

  onFiltersCleared(field: string): void {
    if (field === 'status') void this.store.setQuery(this.statusQuery(null));
    if (field === 'sourceEventId') void this.store.setQuery({ sourceEventId: undefined });
  }

  // ── Presentazione ───────────────────────────────────────────────────────

  fullName(row: Prospect): string {
    return [row.name, row.surname].filter(Boolean).join(' ');
  }

  recapiti(row: Prospect): string {
    return [row.email, row.phone].filter(Boolean).join(' · ');
  }

  statusUi(row: Prospect) {
    return row.convertedRegistrationId ? PROSPECT_CONVERTED_UI : PROSPECT_STATUS_UI[row.status];
  }

  roleUi(role: PreferredDanceRole) {
    return PREFERRED_DANCE_ROLE_UI[role];
  }

  courseTitle(row: Prospect): string {
    return row.sourceEvent ? this.title(row.sourceEvent.title) : `Corso #${row.sourceEventId}`;
  }

  title(value: Parameters<typeof resolveI18n>[0]): string {
    return resolveI18n(value, this.locale.lang())?.text ?? '';
  }

  date(value: string): string {
    return formatDate(value);
  }

  err(control: keyof typeof this.form.controls): string | null {
    return controlError(this.form.controls[control]);
  }

  // ── Contattare ──────────────────────────────────────────────────────────

  writeEmail(row: Prospect): void {
    window.location.href = `mailto:${row.email}`;
  }

  callPhone(row: Prospect): void {
    window.location.href = `tel:${row.phone!.replace(/[^\d+]/g, '')}`;
  }

  /**
   * `wa.me` vuole il numero internazionale senza `+` né spazi. Un numero
   * italiano digitato senza prefisso — «333 123 4567» — è la regola, non
   * l'eccezione, e senza il 39 WhatsApp apre una chat con nessuno.
   */
  openWhatsApp(row: Prospect): void {
    let digits = row.phone!.replace(/[^\d+]/g, '');
    if (digits.startsWith('+')) digits = digits.slice(1);
    else if (digits.startsWith('00')) digits = digits.slice(2);
    else if (digits.startsWith('3')) digits = `39${digits}`;
    window.open(`https://wa.me/${digits}`, '_blank', 'noopener');
  }

  /** Chi va chiamato, fra quelli in elenco: né iscritti né già sentiti. */
  private toContact(): Prospect[] {
    return this.store.items().filter((p) => !p.convertedRegistrationId && p.status === 'TO_CONTACT');
  }

  /**
   * Le email **dei contatti in elenco**, cioè di ciò che i filtri mostrano —
   * senza gli iscritti, che non vanno invitati a un corso che già frequentano.
   * Separate da virgola: è ciò che il campo «Ccn» di ogni client accetta.
   */
  async copyEmails(): Promise<void> {
    const emails = [
      ...new Set(
        this.store
          .items()
          .filter((p) => !p.convertedRegistrationId && p.email)
          .map((p) => p.email!),
      ),
    ];
    if (!emails.length) {
      this.toast.show('WARNING', 'Nessuna email fra i contatti in elenco.');
      return;
    }
    try {
      await navigator.clipboard.writeText(emails.join(', '));
      this.toast.show(
        'SUCCESS',
        `${emails.length} email copiate. Incollale in Ccn, così nessuno vede gli indirizzi degli altri.`,
      );
    } catch {
      this.toast.show('ERROR', 'Il browser non ha permesso di copiare negli appunti.');
    }
  }

  exportCsv(): void {
    const rows = this.store.items();
    if (!rows.length) {
      this.toast.show('WARNING', 'Nessun contatto da esportare.');
      return;
    }
    const header = ['Nome', 'Cognome', 'Email', 'Telefono', 'Ruolo', 'Corso open day', 'Stato', 'Contattato il', 'Note'];
    const lines = rows.map((p) => [
      p.name,
      p.surname ?? '',
      p.email ?? '',
      p.phone ?? '',
      p.preferredRole ? PREFERRED_DANCE_ROLE_UI[p.preferredRole].label : '',
      this.courseTitle(p),
      this.statusUi(p).label,
      p.contactedAt ? formatDate(p.contactedAt) : '',
      p.note ?? '',
    ]);
    // Punto e virgola e BOM: è il CSV che Excel in italiano apre in colonne
    // senza chiedere nulla. Con la virgola, finisce tutto nella colonna A.
    const csv = [header, ...lines]
      .map((cells) => cells.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';'))
      .join('\r\n');
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `prospect-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async markAllContacted(): Promise<void> {
    const targets = this.toContact();
    if (!targets.length) {
      this.toast.show('WARNING', 'Nessun contatto da ricontattare in elenco.');
      return;
    }
    const ok = await this.confirm.ask({
      title: 'Segnare tutti come contattati?',
      message:
        `${targets.length} contatti passano a «Contattato», con la data di oggi. ` +
        'Fallo dopo aver scritto a tutti: è ciò che evita di scrivere due volte alla stessa persona.',
      confirmLabel: 'Segna contattati',
    });
    if (!ok) return;
    const updated = await this.store.markContacted(targets.map((p) => p.id));
    this.toast.show('SUCCESS', `${updated} contatti segnati come contattati.`);
  }

  async setStatus(row: Prospect, status: ProspectStatus): Promise<void> {
    await this.store.update(row.id, { status });
    await this.store.load();
    this.toast.show('SUCCESS', `${this.fullName(row)}: ${PROSPECT_STATUS_UI[status].label.toLowerCase()}.`);
  }

  // ── Modulo ──────────────────────────────────────────────────────────────

  startCreate(): void {
    this.editingId.set(null);
    this.form.reset({
      name: '',
      surname: '',
      email: '',
      phone: '',
      preferredRole: null,
      sourceEventId: this.courseId(),
      status: 'TO_CONTACT',
      note: '',
      consent: false,
    });
    this.formErrors.set([]);
    this.editing.set(true);
  }

  startEdit(row: Prospect): void {
    this.editingId.set(row.id);
    this.form.reset({
      name: row.name,
      surname: row.surname ?? '',
      email: row.email ?? '',
      phone: row.phone ?? '',
      preferredRole: row.preferredRole ?? null,
      sourceEventId: row.sourceEventId,
      status: row.status,
      note: row.note ?? '',
      consent: true,
    });
    this.formErrors.set([]);
    this.editing.set(true);
  }

  async onEditAction(button: SectionActionButton): Promise<void> {
    if (button.id === 'cancel') {
      this.editing.set(false);
      return;
    }
    this.form.markAllAsTouched();
    clearServerErrors(this.form);
    this.formErrors.set([]);

    const value = this.form.getRawValue();
    const problems: string[] = [];
    if (!value.name.trim()) problems.push('Il nome è obbligatorio.');
    if (!value.email.trim() && !value.phone.trim()) problems.push('Serve almeno un recapito: email o telefono.');
    const id = this.editingId();
    if (id === null && !value.sourceEventId) problems.push('Scegli il corso dell’open day.');
    if (id === null && !value.consent) problems.push('Serve il consenso a essere ricontattati.');
    if (problems.length) {
      this.formErrors.set(problems);
      return;
    }

    const contact = {
      name: value.name.trim(),
      surname: value.surname.trim() || null,
      email: value.email.trim() || null,
      phone: value.phone.trim() || null,
      preferredRole: value.preferredRole,
      note: value.note.trim() || null,
    };

    try {
      if (id === null) {
        await this.store.create({ ...contact, sourceEventId: Number(value.sourceEventId), consent: true });
        this.toast.show('SUCCESS', 'Contatto aggiunto.');
      } else {
        await this.store.update(id, { ...contact, status: value.status });
        this.toast.show('SUCCESS', 'Contatto aggiornato.');
      }
      this.editing.set(false);
      await this.store.load();
    } catch (err) {
      const unmatched = applyZodIssues(this.form, err);
      this.formErrors.set(unmatched.length ? unmatched : ['Controlla i campi evidenziati.']);
    }
  }

  async remove(row: Prospect): Promise<void> {
    const ok = await this.confirm.ask({
      title: 'Eliminare il contatto?',
      message:
        `${this.fullName(row)} viene cancellato davvero, non archiviato: è ciò che si fa ` +
        'quando qualcuno chiede di non essere più contattato.',
      confirmLabel: 'Elimina',
      destructive: true,
    });
    if (!ok) return;
    await this.store.remove(row.id);
    this.toast.show('SUCCESS', 'Contatto eliminato.');
  }
}
