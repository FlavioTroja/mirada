import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  CheckboxComponent,
  FormRowComponent,
  FormWrapperComponent,
  InfoBoxComponent,
  InputComponent,
  MultiSelectComponent,
  PageSectionWrapperComponent,
  PageWrapperComponent,
  SectionActionButton,
  SelectComponent,
  SelectOption,
  TextareaComponent,
  DateTimePickerComponent,
} from '@keijo/ui';
import {
  cancel as cancelIcon,
  check,
  close,
  copyAll,
  image,
  lock,
  lockOpen,
  publish,
  save,
  warning,
} from '@keijo/ui/icons';
import { HeaderTitleService } from '../../services/header-title.service';
import { PageAction, PageActionsService } from '../../services/page-actions.service';
import { ToastService } from '../../services/toast.service';
import { AuthService } from '../../core/auth/auth.service';
import { SALES_CLOSE_CRITERION_OPTIONS, SalesCloseCriterion } from '../../core/domain/enums';
import { MiradaEvent, StoredFile } from '../../core/domain/models';
import { toIso } from '../../core/i18n/format';
import { LocaleService, buildI18n, i18nPlain } from '../../core/i18n/i18n-text';
import { EventStore } from '../../stores/event.store';
import { EventTypeStore } from '../../stores/event-type.store';
import { OrganizationStore } from '../../stores/organization.store';
import { RefundPolicyStore } from '../../stores/refund-policy.store';
import { VenueStore } from '../../stores/venue.store';
import { ConfirmService } from '../../shared/confirm.service';
import { DomainErrorComponent } from '../../shared/domain-error.component';
import {
  ASPECT_HORIZONTAL,
  ASPECT_SQUARE,
  ASPECT_VERTICAL,
  ImageUploadComponent,
} from '../../shared/image-upload.component';
import { applyZodIssues, clearServerErrors, controlError } from '../../shared/form-errors';
import { EventWorkspaceNavComponent } from './event-workspace-nav.component';

/**
 * `/events/:id` — dati base dell'evento, ingresso del workspace (§4.2).
 *
 * Il **ciclo di vita non passa da un `PATCH`**: pubblicazione, chiusura e
 * riapertura vendite, annullamento e duplicazione usano gli endpoint dedicati
 * del §3.7. La pubblicazione è rifiutata se l'organizzazione non è approvata
 * **e** abilitata all'incasso (`RB13`): il messaggio dice quale dei due manca.
 */
@Component({
  selector: 'app-event-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    PageWrapperComponent,
    PageSectionWrapperComponent,
    FormWrapperComponent,
    FormRowComponent,
    InputComponent,
    TextareaComponent,
    SelectComponent,
    MultiSelectComponent,
    CheckboxComponent,
    DateTimePickerComponent,
    InfoBoxComponent,
    EventWorkspaceNavComponent,
    DomainErrorComponent,
    ImageUploadComponent,
  ],
  template: `
    <keijo-page-wrapper>
      <app-domain-error />

      @if (!isNew()) {
        <app-event-workspace-nav [event]="store.current()" current="detail" />
      }

      @if (blockers().length && !isNew()) {
        <keijo-page-section-wrapper mode="plain">
        <keijo-info-box
          [icon]="warningIcon"
          title="Questo evento non è ancora pubblicabile"
          variant="warning"
        >
          <span>
            @for (blocker of blockers(); track blocker) {
              {{ blocker }}
            }
            I biglietti già emessi restano validi e i rimborsi restano eseguibili: manca solo
            l’abilitazione a vendere online.
          </span>
        </keijo-info-box>
        </keijo-page-section-wrapper>
      }

      <keijo-page-section-wrapper [title]="isNew() ? 'Nuovo evento' : 'Dati base'">
        @if (formErrors().length) {
          <p class="mirada-error">{{ formErrors().join(' ') }}</p>
        }

        <keijo-form-wrapper [formGroup]="form">
          <keijo-form-row [cols]="2">
            <keijo-input
              [formControl]="form.controls.titleIt"
              label="titolo (italiano)"
              id="titleIt"
              type="text"
            />
            <keijo-input
              [formControl]="form.controls.titleEn"
              label="titolo (inglese)"
              id="titleEn"
              type="text"
              placeholder="Opzionale — se manca, il pubblico vede l’italiano"
            />
          </keijo-form-row>
          @if (err('titleIt'); as msg) {
            <p class="mirada-error">{{ msg }}</p>
          }

          <keijo-form-row [cols]="2">
            <keijo-input
              [formControl]="form.controls.slug"
              label="slug pubblico"
              id="slug"
              type="text"
              placeholder="derivato dal titolo se lasciato vuoto"
            />
            <keijo-select
              [formControl]="form.controls.eventTypeId"
              [data]="eventTypeOptions()"
              label="tipo evento"
              placeholder="Scegli il tipo"
            />
          </keijo-form-row>
          @if (err('slug'); as msg) {
            <p class="mirada-error">{{ msg }}</p>
          }
          @if (err('eventTypeId'); as msg) {
            <p class="mirada-error">{{ msg }}</p>
          }
          <p class="mirada-hint">
            Il tipo evento decide quali schede del workspace compaiono: sessioni, cast, quote per
            ruolo, livelli e iscrizione a coppia sono attivate dalle sue cinque capacità.
          </p>

          <keijo-form-row [cols]="2">
            <keijo-select
              [formControl]="form.controls.venueId"
              [data]="venueOptions()"
              label="location"
              placeholder="Scegli la location"
            />
            @if (showOrganizationPicker()) {
              <keijo-select
                [formControl]="form.controls.organizationId"
                [data]="organizationOptions()"
                label="organizzazione"
                placeholder="Scegli l’organizzazione"
              />
            }
          </keijo-form-row>
          @if (err('venueId'); as msg) {
            <p class="mirada-error">{{ msg }}</p>
          }

          <keijo-form-row [cols]="1">
            <keijo-textarea
              [formControl]="form.controls.descriptionIt"
              label="descrizione (italiano)"
              id="descriptionIt"
              [rows]="4"
            />
          </keijo-form-row>
          @if (err('descriptionIt'); as msg) {
            <p class="mirada-error">{{ msg }}</p>
          }
          <keijo-form-row [cols]="1">
            <keijo-textarea
              [formControl]="form.controls.descriptionEn"
              label="descrizione (inglese)"
              id="descriptionEn"
              [rows]="4"
            />
          </keijo-form-row>

          <keijo-form-row [cols]="2">
            <keijo-datetime-picker
              [formControl]="form.controls.startAt"
              label="inizio"
              id="startAt"
            />
            <keijo-datetime-picker [formControl]="form.controls.endAt" label="fine" id="endAt" />
          </keijo-form-row>
          <p class="mirada-hint">Date e orari sono sul fuso Europe/Rome.</p>

          <keijo-form-row [cols]="2">
            <keijo-select
              [formControl]="form.controls.contentLanguage"
              [data]="languageOptions"
              label="lingua dei contenuti"
              placeholder="Lingua principale"
            />
            <keijo-select
              [formControl]="form.controls.secondLanguage"
              [data]="secondLanguageOptions"
              label="seconda lingua"
              placeholder="Nessuna"
            />
          </keijo-form-row>

          <keijo-form-row [cols]="1">
            <keijo-input
              [formControl]="form.controls.tags"
              label="tag"
              id="tags"
              type="text"
              placeholder="separati da virgola — es. marathon, tango salon"
            />
          </keijo-form-row>

          <keijo-form-row [cols]="2">
            <keijo-datetime-picker
              [formControl]="form.controls.salesCloseAt"
              label="chiusura vendite"
              id="salesCloseAt"
            />
            <keijo-multi-select
              [formControl]="form.controls.salesCloseCriteria"
              label="criteri di chiusura vendita"
              id="salesCloseCriteria"
              [items]="salesCloseOptions"
              placeholder="Scegli i criteri"
            />
          </keijo-form-row>
          <p class="mirada-hint">
            L’inizio dell’evento chiude comunque le vendite, anche senza criteri configurati.
          </p>

          <keijo-form-row [cols]="2">
            <keijo-select
              [formControl]="form.controls.refundPolicyId"
              [data]="refundPolicyOptions()"
              label="policy di rimborso"
              placeholder="Nessuna policy collegata"
            />
            <keijo-input
              [formControl]="form.controls.refundPolicyTextIt"
              label="testo della policy (italiano)"
              id="refundPolicyTextIt"
              type="text"
            />
          </keijo-form-row>
          @if (err('refundPolicyTextIt'); as msg) {
            <p class="mirada-error">{{ msg }}</p>
          }

          <keijo-form-row [cols]="2">
            <keijo-checkbox
              [formControl]="form.controls.minorsAdmitted"
              label="Ammessi i minorenni"
            />
            <keijo-checkbox
              [formControl]="form.controls.manageExternalChannels"
              label="Gestisco anche canali di vendita esterni"
            />
          </keijo-form-row>
          <p class="mirada-hint">
            Senza la gestione dei canali esterni i conteggi dell’evento riguardano le sole
            vendite online, e questo viene dichiarato ovunque compaiano.
          </p>

          @if (form.controls.minorsAdmitted.value) {
            <keijo-form-row [cols]="1">
              <keijo-textarea
                [formControl]="form.controls.minorsConditionsIt"
                label="condizioni per i minorenni (italiano)"
                id="minorsConditionsIt"
                [rows]="3"
              />
            </keijo-form-row>
          }
        </keijo-form-wrapper>
      </keijo-page-section-wrapper>

      @if (!isNew()) {
        <keijo-page-section-wrapper title="Locandina">
          <p class="mirada-hint">
            Tre ritagli, tre usi distinti: il <strong>verticale</strong> è la scheda dell’evento,
            l’<strong>orizzontale</strong> è la copertina, il <strong>quadrato</strong> è
            l’immagine di condivisione. Caricare un solo file per tutti e tre lo farebbe apparire
            tagliato in almeno due dei tre posti. Ogni caricamento sostituisce il riferimento
            sull’evento: il file precedente non viene modificato.
          </p>

          <div class="posters">
            <app-image-upload
              label="Ritaglio verticale — scheda dell’evento"
              hint="Il formato che il pubblico vede aprendo l’evento."
              [aspect]="verticalAspect"
              [fileId]="posterVerticalFileId()"
              [currentUrl]="posterVerticalUrl()"
              [readonly]="!canWrite()"
              (uploaded)="onPosterUploaded('posterVerticalFileId', $event)"
              (cleared)="onPosterCleared('posterVerticalFileId')"
            />
            <app-image-upload
              label="Ritaglio orizzontale — copertina"
              hint="La fascia in testa alla scheda e negli elenchi."
              [aspect]="horizontalAspect"
              [fileId]="posterHorizontalFileId()"
              [currentUrl]="posterHorizontalUrl()"
              [readonly]="!canWrite()"
              (uploaded)="onPosterUploaded('posterHorizontalFileId', $event)"
              (cleared)="onPosterCleared('posterHorizontalFileId')"
            />
            <app-image-upload
              label="Ritaglio quadrato — condivisione"
              hint="L’anteprima nei messaggi e sui social."
              [aspect]="squareAspect"
              [fileId]="posterSquareFileId()"
              [currentUrl]="posterSquareUrl()"
              [readonly]="!canWrite()"
              (uploaded)="onPosterUploaded('posterSquareFileId', $event)"
              (cleared)="onPosterCleared('posterSquareFileId')"
            />
          </div>

          <keijo-info-box [icon]="imageIcon" title="Ritaglio guidato" variant="info">
            <span>
              I tre file si caricano già ritagliati: la proporzione attesa è dichiarata su ogni
              riquadro e verificata dopo la scelta, con un avviso quando non corrisponde.
              <strong>@keijo/ui non spedisce un componente di ritaglio</strong>, e inventarne uno
              significherebbe inventare un’API della libreria: il punto è stato riportato al
              committente.
            </span>
          </keijo-info-box>
        </keijo-page-section-wrapper>

        @if (cancelling()) {
          <keijo-page-section-wrapper
            title="Annullamento dell’evento"
            [buttons]="cancelButtons"
            (buttonClick)="onCancelAction($event)"
          >
            <p class="mirada-hint">
              L’annullamento chiude le vendite e segna l’evento come annullato per tutti gli
              iscritti. La motivazione è obbligatoria e viene registrata: comparirà nelle
              comunicazioni agli iscritti.
            </p>
            <keijo-form-wrapper [formGroup]="cancelForm">
              <keijo-form-row [cols]="1">
                <keijo-textarea
                  [formControl]="cancelForm.controls.reason"
                  label="motivazione dell’annullamento"
                  id="cancelReason"
                  [rows]="3"
                />
              </keijo-form-row>
            </keijo-form-wrapper>
          </keijo-page-section-wrapper>
        }
      }
    </keijo-page-wrapper>
  `,
  styles: [
    `
      .posters {
        display: grid;
        gap: 1rem;
        grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr));
      }
    `,
  ],
})
export class EventDetailComponent implements OnInit {
  private readonly headerTitle = inject(HeaderTitleService);
  private readonly pageActions = inject(PageActionsService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly auth = inject(AuthService);
  private readonly locale = inject(LocaleService);
  private readonly eventTypes = inject(EventTypeStore);
  private readonly venues = inject(VenueStore);
  private readonly organizations = inject(OrganizationStore);
  private readonly refundPolicies = inject(RefundPolicyStore);

  readonly store = inject(EventStore);

  readonly warningIcon = warning;
  readonly imageIcon = image;

  private readonly eventId = signal<number | null>(null);
  readonly formErrors = signal<string[]>([]);
  readonly cancelling = signal(false);

  readonly eventTypeOptions = signal<SelectOption[]>([]);
  readonly venueOptions = signal<SelectOption[]>([]);
  readonly organizationOptions = signal<SelectOption[]>([]);
  readonly refundPolicyOptions = signal<SelectOption[]>([]);

  readonly languageOptions: SelectOption[] = [
    { label: 'Italiano', value: 'it' },
    { label: 'English', value: 'en' },
    { label: 'Español', value: 'es' },
  ];
  readonly secondLanguageOptions: SelectOption[] = [
    { label: 'Nessuna', value: '' },
    ...this.languageOptions,
  ];
  readonly salesCloseOptions = SALES_CLOSE_CRITERION_OPTIONS.map((o) => ({
    label: o.label,
    value: o.value,
  }));

  readonly isNew = computed(() => this.eventId() === null);
  readonly blockers = computed(() => this.organizations.publishBlockers());

  readonly cancelButtons: SectionActionButton[] = [
    { id: 'confirm-cancel', icon: cancelIcon, label: 'Annulla evento', variant: 'error' },
    { id: 'abort-cancel', icon: close, label: 'Non annullare', variant: 'default' },
  ];

  readonly form = new FormGroup({
    titleIt: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    titleEn: new FormControl('', { nonNullable: true }),
    slug: new FormControl('', { nonNullable: true }),
    eventTypeId: new FormControl<number | null>(null, { validators: [Validators.required] }),
    venueId: new FormControl<number | null>(null, { validators: [Validators.required] }),
    organizationId: new FormControl<number | null>(null, { validators: [Validators.required] }),
    descriptionIt: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    descriptionEn: new FormControl('', { nonNullable: true }),
    startAt: new FormControl<Date | null>(null, { validators: [Validators.required] }),
    endAt: new FormControl<Date | null>(null, { validators: [Validators.required] }),
    contentLanguage: new FormControl<string>('it', { nonNullable: true }),
    secondLanguage: new FormControl<string>('', { nonNullable: true }),
    tags: new FormControl('', { nonNullable: true }),
    salesCloseAt: new FormControl<Date | null>(null),
    salesCloseCriteria: new FormControl<SalesCloseCriterion[]>([], { nonNullable: true }),
    refundPolicyId: new FormControl<number | null>(null),
    refundPolicyTextIt: new FormControl('Rimborso secondo la policy indicata in scheda evento.', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    minorsAdmitted: new FormControl(false, { nonNullable: true }),
    minorsConditionsIt: new FormControl('', { nonNullable: true }),
    manageExternalChannels: new FormControl(false, { nonNullable: true }),
  });

  readonly cancelForm = new FormGroup({
    reason: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  readonly showOrganizationPicker = computed(() => this.organizationOptions().length > 1);

  async ngOnInit(): Promise<void> {
    const raw = this.route.snapshot.paramMap.get('id');
    const id = raw && raw !== 'new' ? Number(raw) : null;
    this.eventId.set(id);
    // Su una rotta di dettaglio il titolo dell'header è il **nome dell'entità**,
    // mai l'id né il nome dell'istanza (`KEIJO-DETAIL-HEADER-TITLE-NEVER-ID`).
    this.headerTitle.set('Evento');

    await Promise.all([this.loadCatalogues(), id ? this.loadEvent(id) : this.prepareNew()]);
    this.registerActions();
  }

  private async loadCatalogues(): Promise<void> {
    const [types, venues, orgs, policies] = await Promise.all([
      this.eventTypes.loadAll({ active: true }, 100, ''),
      this.venues.loadAll({}, 200, ''),
      this.organizations.loadAll({}, 100, ''),
      this.refundPolicies.loadAll({}, 100, ''),
    ]);
    const lang = this.locale.lang();
    this.eventTypeOptions.set(types.map((t) => ({ label: i18nPlain(t.name, lang), value: t.id })));
    this.venueOptions.set(venues.map((v) => ({ label: v.name, value: v.id })));
    this.organizationOptions.set(orgs.map((o) => ({ label: o.name, value: o.id })));
    this.refundPolicyOptions.set([
      { label: 'Nessuna policy collegata', value: null },
      ...policies.map((p) => ({ label: i18nPlain(p.name, lang), value: p.id })),
    ]);
    if (orgs.length === 1 && !this.form.controls.organizationId.value) {
      this.form.controls.organizationId.setValue(orgs[0].id);
    }
  }

  private async prepareNew(): Promise<void> {
    this.store.clearCurrent();
  }

  private async loadEvent(id: number): Promise<void> {
    const ev = await this.store.loadOne(id);
    this.patchForm(ev);
    if (ev.organizationId) {
      try {
        await this.organizations.loadOne(ev.organizationId);
      } catch {
        /* il gating lato server può negare la lettura: i blocker restano vuoti */
      }
    }
  }

  private patchForm(ev: MiradaEvent): void {
    this.form.patchValue({
      titleIt: ev.title?.it ?? '',
      titleEn: ev.title?.en ?? '',
      slug: ev.slug,
      eventTypeId: ev.eventTypeId,
      venueId: ev.venueId,
      organizationId: ev.organizationId,
      descriptionIt: ev.description?.it ?? '',
      descriptionEn: ev.description?.en ?? '',
      startAt: ev.startAt ? new Date(ev.startAt) : null,
      endAt: ev.endAt ? new Date(ev.endAt) : null,
      contentLanguage: ev.contentLanguage ?? 'it',
      secondLanguage: ev.secondLanguage ?? '',
      tags: (ev.tags ?? []).join(', '),
      salesCloseAt: ev.salesCloseAt ? new Date(ev.salesCloseAt) : null,
      salesCloseCriteria: ev.salesCloseCriteria ?? [],
      refundPolicyId: ev.refundPolicyId ?? null,
      refundPolicyTextIt: ev.refundPolicyText?.it ?? '',
      minorsAdmitted: ev.minorsAdmitted,
      minorsConditionsIt: ev.minorsConditions?.it ?? '',
      manageExternalChannels: ev.manageExternalChannels,
    });
  }

  // -- locandina: i tre ritagli di `RF-EVT-3` -------------------------------

  readonly verticalAspect = ASPECT_VERTICAL;
  readonly horizontalAspect = ASPECT_HORIZONTAL;
  readonly squareAspect = ASPECT_SQUARE;

  readonly canWrite = computed(() => this.auth.can().eventsWrite);

  readonly posterVerticalFileId = computed(() => this.store.current()?.posterVerticalFileId ?? null);
  readonly posterHorizontalFileId = computed(
    () => this.store.current()?.posterHorizontalFileId ?? null,
  );
  readonly posterSquareFileId = computed(() => this.store.current()?.posterSquareFileId ?? null);

  readonly posterVerticalUrl = computed(
    () => this.store.current()?.posterVerticalFile?.url ?? null,
  );
  readonly posterHorizontalUrl = computed(
    () => this.store.current()?.posterHorizontalFile?.url ?? null,
  );
  readonly posterSquareUrl = computed(() => this.store.current()?.posterSquareFile?.url ?? null);

  /**
   * Il file è già caricato con `POST /files/upload-image`: qui si scrive il
   * **riferimento** sull'evento con il suo `PATCH`. Il file precedente non
   * viene né modificato né cancellato — non esiste alcun verbo per farlo (§3.4).
   */
  async onPosterUploaded(
    field: 'posterVerticalFileId' | 'posterHorizontalFileId' | 'posterSquareFileId',
    file: StoredFile,
  ): Promise<void> {
    const id = this.eventId();
    if (id === null) return;
    await this.store.update(id, { [field]: file.id });
    await this.store.loadOne(id);
    this.toast.show('SUCCESS', 'Ritaglio collegato all’evento.');
  }

  async onPosterCleared(
    field: 'posterVerticalFileId' | 'posterHorizontalFileId' | 'posterSquareFileId',
  ): Promise<void> {
    const id = this.eventId();
    if (id === null) return;
    await this.store.update(id, { [field]: null });
    await this.store.loadOne(id);
    this.toast.show('SUCCESS', 'Ritaglio scollegato.');
  }

  err(control: keyof typeof this.form.controls): string | null {
    return controlError(this.form.controls[control]);
  }

  // -- azioni di testata ----------------------------------------------------

  private registerActions(): void {
    const canWrite = this.auth.can().eventsWrite;
    const ev = this.store.current();
    const actions: PageAction[] = [];

    if (canWrite) {
      actions.push({
        id: 'save',
        icon: save,
        label: 'Salva',
        tooltip: this.isNew() ? 'Crea l’evento' : 'Salva i dati base dell’evento',
        run: () => void this.save(),
      });
    }

    if (ev && this.auth.can().publishEvent) {
      if (ev.status === 'DRAFT') {
        actions.push({
          id: 'publish',
          icon: publish,
          label: 'Pubblica',
          tooltip: 'Pubblica l’evento e apri le prenotazioni',
          run: () => void this.publish(),
        });
      } else if (ev.status === 'PUBLISHED') {
        actions.push({
          id: 'close-sales',
          icon: lock,
          label: 'Chiudi',
          tooltip: 'Chiudi le vendite online',
          run: () => void this.closeSales(),
        });
      } else if (ev.status === 'SALES_CLOSED') {
        actions.push({
          id: 'reopen-sales',
          icon: lockOpen,
          label: 'Riapri',
          tooltip: 'Riapri le vendite online',
          run: () => void this.reopenSales(),
        });
      }
    }

    if (ev && canWrite) {
      actions.push({
        id: 'duplicate',
        icon: copyAll,
        label: 'Duplica',
        tooltip: 'Duplica come nuova edizione',
        run: () => void this.duplicate(),
      });
      if (ev.status !== 'CANCELLED') {
        actions.push({
          id: 'cancel-event',
          icon: cancelIcon,
          label: 'Annulla',
          tooltip: 'Annulla l’evento indicando la motivazione',
          run: () => this.cancelling.set(true),
        });
      }
    }

    this.pageActions.set(actions);
  }

  // -- salvataggio ----------------------------------------------------------

  async save(): Promise<void> {
    this.form.markAllAsTouched();
    clearServerErrors(this.form);
    this.formErrors.set([]);
    if (this.form.invalid) {
      this.formErrors.set(['Alcuni campi obbligatori non sono compilati.']);
      return;
    }

    const value = this.form.getRawValue();
    const payload = {
      organizationId: value.organizationId,
      eventTypeId: value.eventTypeId,
      venueId: value.venueId,
      title: buildI18n(value.titleIt, value.titleEn),
      slug: value.slug.trim() || slugify(value.titleIt),
      description: buildI18n(value.descriptionIt, value.descriptionEn),
      startAt: toIso(value.startAt),
      endAt: toIso(value.endAt),
      contentLanguage: value.contentLanguage || 'it',
      secondLanguage: value.secondLanguage || null,
      tags: value.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      salesCloseAt: toIso(value.salesCloseAt),
      salesCloseCriteria: value.salesCloseCriteria ?? [],
      refundPolicyId: value.refundPolicyId ?? null,
      refundPolicyText: buildI18n(value.refundPolicyTextIt),
      minorsAdmitted: value.minorsAdmitted,
      minorsConditions: value.minorsAdmitted && value.minorsConditionsIt.trim()
        ? buildI18n(value.minorsConditionsIt)
        : null,
      manageExternalChannels: value.manageExternalChannels,
    };

    try {
      const id = this.eventId();
      if (id === null) {
        const created = await this.store.create(payload);
        this.toast.show('SUCCESS', 'Evento creato in bozza.');
        await this.router.navigateByUrl(`/events/${created.id}`);
        this.eventId.set(created.id);
        this.registerActions();
      } else {
        await this.store.update(id, payload);
        this.toast.show('SUCCESS', 'Dati base salvati.');
        this.registerActions();
      }
    } catch (err) {
      const unmatched = applyZodIssues(this.form, err);
      this.formErrors.set(
        unmatched.length ? unmatched : ['Controlla i campi evidenziati e riprova.'],
      );
    }
  }

  // -- ciclo di vita --------------------------------------------------------

  private async publish(): Promise<void> {
    const id = this.eventId();
    if (id === null) return;
    try {
      await this.store.publish(id);
      this.toast.show('SUCCESS', 'Evento pubblicato: le prenotazioni sono aperte.');
      this.registerActions();
    } catch {
      // `PAYOUT_NOT_ENABLED` e gli altri codici di dominio sono presentati da
      // <app-domain-error>, che spiega quale adempimento manca.
    }
  }

  private async closeSales(): Promise<void> {
    const id = this.eventId();
    if (id === null) return;
    const ok = await this.confirm.ask({
      title: 'Chiudere le vendite online?',
      message:
        'L’evento si svolge regolarmente e i biglietti già emessi restano validi: si chiude solo ' +
        'la vendita online. Potrai riaprirla in qualsiasi momento.',
      confirmLabel: 'Chiudi vendite',
    });
    if (!ok) return;
    await this.store.closeSales(id);
    this.toast.show('SUCCESS', 'Vendite online chiuse.');
    this.registerActions();
  }

  private async reopenSales(): Promise<void> {
    const id = this.eventId();
    if (id === null) return;
    await this.store.reopenSales(id);
    this.toast.show('SUCCESS', 'Vendite online riaperte.');
    this.registerActions();
  }

  private async duplicate(): Promise<void> {
    const id = this.eventId();
    if (id === null) return;
    const ok = await this.confirm.ask({
      title: 'Duplicare l’evento?',
      message:
        'Viene creata una nuova edizione in bozza con sessioni, titoli d’ingresso, requisiti e ' +
        'servizi copiati. Vendite e iscrizioni della nuova edizione partono azzerate.',
      confirmLabel: 'Duplica',
    });
    if (!ok) return;
    const created = await this.store.duplicate(id);
    this.toast.show('SUCCESS', 'Nuova edizione creata in bozza.');
    void this.router.navigateByUrl(`/events/${created.id}`);
  }

  async onCancelAction(button: SectionActionButton): Promise<void> {
    if (button.id === 'abort-cancel') {
      this.cancelling.set(false);
      this.cancelForm.reset();
      return;
    }
    const id = this.eventId();
    this.cancelForm.markAllAsTouched();
    if (id === null || this.cancelForm.invalid) return;

    const ok = await this.confirm.ask({
      title: 'Confermi l’annullamento?',
      message:
        'L’evento risulterà annullato per tutti gli iscritti e la vendita si chiude. ' +
        'La motivazione indicata viene registrata e comunicata. L’operazione non si annulla.',
      confirmLabel: 'Annulla evento',
      cancelLabel: 'Torna indietro',
      destructive: true,
    });
    if (!ok) return;

    await this.store.cancel(id, this.cancelForm.controls.reason.value.trim());
    this.cancelling.set(false);
    this.cancelForm.reset();
    this.toast.show('SUCCESS', 'Evento annullato.');
    this.registerActions();
  }
}

/** Slug pubblico derivato dal titolo italiano quando non è indicato a mano. */
function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}
