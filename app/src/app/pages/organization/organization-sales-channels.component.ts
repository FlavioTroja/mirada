import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  ButtonComponent,
  EntityListItemComponent,
  FormRowComponent,
  FormWrapperComponent,
  InfoBoxComponent,
  InputComponent,
  ListItemsSkeletonComponent,
  ListItemsWrapperComponent,
  PageSectionWrapperComponent,
  PageWrapperComponent,
  PillComponent,
  SectionActionButton,
  SelectComponent,
  SelectOption,
} from '@keijo/ui';
import { add, check, close, edit, iconDelete, payments, schedule, storefront } from '@keijo/ui/icons';
import { HeaderTitleService } from '../../services/header-title.service';
import { PageAction, PageActionsService } from '../../services/page-actions.service';
import { ToastService } from '../../services/toast.service';
import { ApiClient } from '../../core/api/api.client';
import { SalesChannel, SalesChannelStatus, TicketType } from '../../core/domain/models';
import { formatDateTime } from '../../core/i18n/format';
import { asI18n, i18nPlain } from '../../core/i18n/i18n-text';
import { OrganizationStore } from '../../stores/organization.store';
import { SalesChannelStore } from '../../stores/sales-channel.store';
import { ConfirmService } from '../../shared/confirm.service';
import { applyZodIssues, clearServerErrors, controlError } from '../../shared/form-errors';
import { OrganizationContextComponent } from './organization-context.component';
import {
  DEPOSIT_CODES_PLACEHOLDER,
  MAPPINGS_PLACEHOLDER,
  depositCodesToText,
  mappingsToText,
  parseDepositCodes,
  parseMappings,
} from './sales-channel-rows';

/** Etichette degli stati del canale — l'ordine è quello del ciclo di vita. */
const STATUS_LABEL: Record<SalesChannelStatus, string> = {
  ACTIVE: 'Attivo',
  PAUSED: 'In pausa',
  DISABLED: 'Disconnesso',
};

/**
 * `/organization/sales-channels` — i negozi esterni collegati, la traduzione
 * dei loro prodotti e i **codici di acconto** (fase E e `14-acconto-e-saldo.md`).
 *
 * ── Tre cose che questa pagina configura, e che senza di essa non esistono ───
 *
 * 1. **Il collegamento**: dominio del negozio, segreto della firma, token di
 *    amministrazione. L'indirizzo del webhook lo genera il server ed è ciò che
 *    si incolla nel pannello del negozio.
 * 2. **La traduzione prodotto → titolo d'ingresso.** Senza, ogni ordine finisce
 *    in quarantena e qualcuno resta senza biglietto.
 * 3. **Quali codici sconto significano «acconto»** (`RF-SAL-1`). È l'unico
 *    segnale disponibile: per il negozio quell'ordine è pagato per intero a un
 *    prezzo ridotto, e il residuo esiste solo dentro Mirada.
 *
 * ⚠️ **I segreti non tornano indietro.** Sono cifrati in colonna e nessuna
 * lettura li restituisce: i campi restano vuoti in modifica, e si compilano solo
 * quando si vuole davvero sostituirli.
 */
@Component({
  selector: 'app-organization-sales-channels',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    PageWrapperComponent,
    PageSectionWrapperComponent,
    ListItemsWrapperComponent,
    ListItemsSkeletonComponent,
    EntityListItemComponent,
    ButtonComponent,
    PillComponent,
    InfoBoxComponent,
    FormWrapperComponent,
    FormRowComponent,
    InputComponent,
    SelectComponent,
    OrganizationContextComponent,
  ],
  template: `
    <keijo-page-wrapper>
      <app-organization-context current="sales-channels" />

      @if (editing()) {
        <keijo-page-section-wrapper
          [title]="editingId() ? 'Modifica il negozio collegato' : 'Collega un negozio'"
          [buttons]="editButtons"
          (buttonClick)="onEditAction($event)"
        >
          @if (formErrors().length) {
            <p class="mirada-error">{{ formErrors().join(' ') }}</p>
          }

          <keijo-form-wrapper [formGroup]="form">
            <keijo-form-row [cols]="2">
              <keijo-input
                [formControl]="form.controls.label"
                label="nome del negozio"
                id="channelLabel"
                type="text"
                placeholder="Il negozio di Trani"
              />
              <keijo-input
                [formControl]="form.controls.externalShopId"
                label="dominio del negozio"
                id="channelShop"
                type="text"
                placeholder="trani-tango.myshopify.com"
              />
            </keijo-form-row>
            @if (err('label'); as msg) {
              <p class="mirada-error">{{ msg }}</p>
            }
            @if (err('externalShopId'); as msg) {
              <p class="mirada-error">{{ msg }}</p>
            }

            <keijo-form-row [cols]="2">
              <keijo-input
                [formControl]="form.controls.webhookSecret"
                label="segreto della firma"
                id="channelSecret"
                type="text"
                [placeholder]="editingId() ? 'Lascia vuoto per non cambiarlo' : 'Il segreto del webhook'"
              />
              <keijo-input
                [formControl]="form.controls.credentials"
                label="token di amministrazione"
                id="channelToken"
                type="text"
                [placeholder]="editingId() ? 'Lascia vuoto per non cambiarlo' : 'shpat_…'"
              />
            </keijo-form-row>
            <p class="mirada-hint">
              Il segreto è ciò con cui il negozio firma le notifiche: senza, nessuna vendita entra.
              Il token serve alla riconciliazione — è come Mirada chiede al negozio cosa si è perso
              mentre era irraggiungibile. Nessuno dei due torna più indietro in lettura: qui restano
              vuoti, e si riscrivono solo per sostituirli.
            </p>

            <keijo-form-row [cols]="2">
              <keijo-input
                [formControl]="form.controls.roleAttributeName"
                label="campo del ruolo di ballo"
                id="channelRoleField"
                type="text"
                placeholder="Ruolo"
              />
              <keijo-input
                [formControl]="form.controls.attendeeNameAttributeName"
                label="campo del nominativo"
                id="channelAttendeeField"
                type="text"
                placeholder="Nome partecipante"
              />
            </keijo-form-row>
            <p class="mirada-hint">
              Un negozio non sa cos'è un leader e non sa chi occuperà il secondo pass di un ordine:
              lo sa solo se lo <strong>chiede al checkout</strong>. Se Trani raccoglie quei due
              campi — come attributi del carrello o proprietà del prodotto — scrivi qui come li ha
              chiamati, e le iscrizioni nasceranno con il ruolo giusto e il nome giusto. Lasciandoli
              vuoti nasceranno flessibili e intestate a chi ha comprato, che è ciò che succede oggi.
            </p>

            <keijo-form-row [cols]="1">
              <keijo-select
                [formControl]="form.controls.status"
                [data]="statusOptions"
                label="stato"
                placeholder="Attivo, in pausa, disconnesso"
              />
            </keijo-form-row>
            <p class="mirada-hint">
              In pausa il canale <strong>registra</strong> le notifiche senza ingerirle: fermare
              l'ingestione non deve significare perdere le vendite che arrivano nel frattempo.
            </p>
          </keijo-form-wrapper>
        </keijo-page-section-wrapper>
      }

      @if (configuring(); as channel) {
        <keijo-page-section-wrapper
          [title]="'Prodotti e acconti · ' + channel.label"
          [buttons]="editButtons"
          (buttonClick)="onConfigAction($event)"
        >
          @if (configErrors().length) {
            <p class="mirada-error">{{ configErrors().join(' ') }}</p>
          }

          <keijo-form-wrapper [formGroup]="configForm">
            <keijo-form-row [cols]="1">
              <keijo-input
                [formControl]="configForm.controls.mappings"
                label="prodotti del negozio (prodotto[/variante] : titolo [x posti])"
                id="channelMappings"
                type="text"
                [placeholder]="mappingsPlaceholder"
              />
            </keijo-form-row>
            <p class="mirada-hint">
              Il titolo è il numero fra parentesi nell'elenco qui sotto. Scrivi
              <strong>0</strong> per dire «questo articolo non è un biglietto, ignoralo»: è ciò che
              tiene fuori dalla quarantena l'ordine misto — pass più maglietta — che è il caso
              normale. Un articolo <em>senza</em> riga finisce invece in quarantena, ed è giusto
              così: non si sa cosa sia.
            </p>
            @if (ticketTypeOptions().length) {
              <p class="mirada-muted catalogue">
                @for (option of ticketTypeOptions(); track option.value) {
                  <span class="chip">{{ option.label }}</span>
                }
              </p>
            }

            <keijo-form-row [cols]="1">
              <keijo-input
                [formControl]="configForm.controls.depositCodes"
                label="codici di acconto (codice = etichetta)"
                id="channelDepositCodes"
                type="text"
                [placeholder]="depositCodesPlaceholder"
              />
            </keijo-form-row>
            <p class="mirada-hint">
              Sono i codici sconto che, sul negozio, significano «acconto»: chi li usa paga una
              parte adesso e <strong>salda alla porta</strong>. La percentuale nel nome non serve al
              calcolo — a dire quanto manca è l'importo che il codice ha scontato, che il negozio
              consegna esatto. Maiuscole e spazi non contano.
            </p>
            <p class="mirada-hint">
              Togliere un codice non riscrive il passato: i saldi già aperti restano da incassare.
            </p>
          </keijo-form-wrapper>
        </keijo-page-section-wrapper>
      }

      <keijo-page-section-wrapper mode="plain">
        @if (store.loading()) {
          <keijo-list-items-skeleton />
        } @else {
          <keijo-list-items-wrapper>
            @for (channel of store.items(); track channel.id) {
              <keijo-entity-list-item [expandable]="true">
                <ng-template #primary>
                  <div class="primary">
                    <span class="title">{{ channel.label }}</span>
                    <span class="mirada-muted">{{ channel.externalShopId }}</span>
                  </div>
                </ng-template>
                <ng-template #secondary>
                  <div class="secondary">
                    <keijo-pill [variant]="statusVariant(channel.status)" [icon]="shopIcon">
                      {{ statusLabel(channel.status) }}
                    </keijo-pill>
                    <keijo-pill variant="default" [icon]="shopIcon">
                      {{ channel.mappings?.length ?? 0 }} prodotti associati
                    </keijo-pill>
                    <keijo-pill
                      [variant]="(channel.depositCodes?.length ?? 0) ? 'warning' : 'default'"
                      [icon]="depositIcon"
                    >
                      {{ channel.depositCodes?.length ?? 0 }} codici di acconto
                    </keijo-pill>
                    @if (channel.lastReconciledAt) {
                      <keijo-pill variant="default" [icon]="clockIcon">
                        riconciliato il {{ when(channel.lastReconciledAt) }}
                      </keijo-pill>
                    }
                  </div>
                  <p class="mirada-muted webhook">
                    Indirizzo per il negozio: <code>{{ webhookUrl(channel) }}</code>
                  </p>
                  @if (channel.depositCodes?.length) {
                    <p class="mirada-muted">
                      Acconti:
                      @for (code of channel.depositCodes; track code.id) {
                        <code class="code">{{ code.code }}</code>
                      }
                    </p>
                  }
                </ng-template>
                <ng-template #actions>
                  <keijo-button
                    variant="error"
                    [icon]="deleteIcon"
                    tooltip="Scollega il negozio"
                    (action)="disconnect(channel)"
                  />
                  <keijo-button
                    variant="accent"
                    [icon]="depositIcon"
                    tooltip="Prodotti e codici di acconto"
                    (action)="startConfig(channel)"
                  />
                  <keijo-button
                    variant="warning"
                    [icon]="editIcon"
                    tooltip="Modifica il collegamento"
                    (action)="startEdit(channel)"
                  />
                </ng-template>
              </keijo-entity-list-item>
            } @empty {
              <keijo-info-box [icon]="shopIcon" title="Nessun negozio collegato" variant="info">
                <span>
                  Un organizzatore che vende già sul proprio negozio non lo smonta il giorno in cui
                  arriva su Mirada: collegandolo, quelle vendite si dichiarano da sé — iscritti,
                  biglietti ed email compresi — invece di essere digitate a mano.
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
        gap: 0.125rem;
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
      .webhook {
        margin: 0.5rem 0 0;
        word-break: break-all;
      }
      .catalogue {
        display: flex;
        flex-wrap: wrap;
        gap: 0.375rem;
      }
      .chip {
        border: 1px solid rgba(var(--text-rgb), 0.35);
        border-radius: 0.5rem;
        padding: 0.125rem 0.375rem;
      }
      .code {
        margin-right: 0.375rem;
      }
    `,
  ],
})
export class OrganizationSalesChannelsComponent implements OnInit {
  private readonly headerTitle = inject(HeaderTitleService);
  private readonly pageActions = inject(PageActionsService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly api = inject(ApiClient);
  private readonly organizations = inject(OrganizationStore);

  readonly store = inject(SalesChannelStore);

  readonly shopIcon = storefront;
  readonly depositIcon = payments;
  readonly clockIcon = schedule;
  readonly editIcon = edit;
  readonly deleteIcon = iconDelete;

  readonly mappingsPlaceholder = MAPPINGS_PLACEHOLDER;
  readonly depositCodesPlaceholder = DEPOSIT_CODES_PLACEHOLDER;

  readonly editing = signal(false);
  readonly editingId = signal<number | null>(null);
  readonly configuring = signal<SalesChannel | null>(null);
  readonly formErrors = signal<string[]>([]);
  readonly configErrors = signal<string[]>([]);
  readonly ticketTypeOptions = signal<SelectOption[]>([]);

  readonly statusOptions: SelectOption[] = (Object.keys(STATUS_LABEL) as SalesChannelStatus[]).map(
    (status) => ({ label: STATUS_LABEL[status], value: status }),
  );

  readonly editButtons: SectionActionButton[] = [
    { id: 'save', icon: check, label: 'Salva', variant: 'accent' },
    { id: 'cancel', icon: close, label: 'Annulla', variant: 'default' },
  ];

  readonly form = new FormGroup({
    label: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    externalShopId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    webhookSecret: new FormControl('', { nonNullable: true }),
    credentials: new FormControl('', { nonNullable: true }),
    roleAttributeName: new FormControl('', { nonNullable: true }),
    attendeeNameAttributeName: new FormControl('', { nonNullable: true }),
    status: new FormControl<SalesChannelStatus>('ACTIVE', { nonNullable: true }),
  });

  readonly configForm = new FormGroup({
    mappings: new FormControl('', { nonNullable: true }),
    depositCodes: new FormControl('', { nonNullable: true }),
  });

  readonly organizationId = computed(() => this.organizations.current()?.id ?? null);

  async ngOnInit(): Promise<void> {
    this.headerTitle.set('Canale di vendita');
    await this.organizations.replaceQuery({});
    const target = this.organizations.current()?.id ?? this.organizations.items()[0]?.id;
    if (target) await this.organizations.loadOne(target);

    const orgId = this.organizationId();
    await Promise.all([
      this.store.replaceQuery(orgId ? { organizationId: orgId } : {}),
      this.loadTicketTypes(),
    ]);
    this.registerActions();
  }

  private registerActions(): void {
    const actions: PageAction[] = [];
    if (this.organizationId()) {
      actions.push({
        id: 'connect',
        icon: add,
        label: 'Collega',
        tooltip: 'Collega un negozio esterno',
        run: () => this.startCreate(),
      });
    }
    this.pageActions.set(actions);
  }

  /**
   * Il catalogo dei titoli con il loro **numero**: è ciò che rende scrivibile la
   * riga di traduzione. Senza, mappare un prodotto significherebbe indovinare un
   * id — e un id sbagliato vende i posti dell'evento di un altro.
   */
  private async loadTicketTypes(): Promise<void> {
    const page = await this.api.list<TicketType>('ticket-types', {}, { limit: 200, populate: 'event' });
    this.ticketTypeOptions.set(
      (page.docs ?? []).map((ticketType) => ({
        label: `${i18nPlain(asI18n(ticketType.name))} (${ticketType.id})`,
        value: ticketType.id,
      })),
    );
  }

  err(control: keyof typeof this.form.controls): string | null {
    return controlError(this.form.controls[control]);
  }

  when(value: string | null | undefined): string {
    return formatDateTime(value);
  }

  statusLabel(status: SalesChannelStatus): string {
    return STATUS_LABEL[status];
  }

  statusVariant(status: SalesChannelStatus): 'success' | 'warning' | 'error' {
    if (status === 'ACTIVE') return 'success';
    return status === 'PAUSED' ? 'warning' : 'error';
  }

  /** L'indirizzo da incollare nel pannello del negozio. */
  webhookUrl(channel: SalesChannel): string {
    return `${window.location.origin.replace('app.', '')}/api/sales-channels/webhook/${channel.publicId}`;
  }

  startCreate(): void {
    this.editingId.set(null);
    this.configuring.set(null);
    this.form.reset({
      label: '',
      externalShopId: '',
      webhookSecret: '',
      credentials: '',
      roleAttributeName: '',
      attendeeNameAttributeName: '',
      status: 'ACTIVE',
    });
    this.formErrors.set([]);
    this.editing.set(true);
  }

  startEdit(channel: SalesChannel): void {
    this.editingId.set(channel.id);
    this.configuring.set(null);
    this.form.reset({
      label: channel.label,
      externalShopId: channel.externalShopId,
      // Vuoti di proposito: i segreti non tornano indietro, e ripresentarli
      // come campi da riempire spingerebbe a riscriverli — sbagliati.
      webhookSecret: '',
      credentials: '',
      roleAttributeName: channel.roleAttributeName ?? '',
      attendeeNameAttributeName: channel.attendeeNameAttributeName ?? '',
      status: channel.status,
    });
    this.formErrors.set([]);
    this.editing.set(true);
  }

  startConfig(channel: SalesChannel): void {
    this.editing.set(false);
    this.configErrors.set([]);
    this.configForm.reset({
      mappings: mappingsToText(channel.mappings),
      depositCodes: depositCodesToText(channel.depositCodes),
    });
    this.configuring.set(channel);
  }

  async onEditAction(button: SectionActionButton): Promise<void> {
    if (button.id === 'cancel') {
      this.editing.set(false);
      return;
    }

    const orgId = this.organizationId();
    this.form.markAllAsTouched();
    clearServerErrors(this.form);
    this.formErrors.set([]);
    if (!orgId || this.form.invalid) {
      this.formErrors.set(['Servono il nome e il dominio del negozio.']);
      return;
    }

    const value = this.form.getRawValue();
    const id = this.editingId();

    if (id === null && !value.webhookSecret) {
      // Alla creazione il segreto è obbligatorio: un canale senza firma non
      // potrebbe verificare nulla, e ogni notifica sarebbe rifiutata.
      this.formErrors.set(['Il segreto della firma serve per collegare il negozio.']);
      return;
    }

    try {
      if (id === null) {
        await this.store.create({
          organizationId: orgId,
          provider: 'SHOPIFY',
          label: value.label,
          externalShopId: value.externalShopId,
          webhookSecret: value.webhookSecret,
          ...(value.credentials ? { credentials: value.credentials } : {}),
          roleAttributeName: value.roleAttributeName || null,
          attendeeNameAttributeName: value.attendeeNameAttributeName || null,
          status: value.status,
        });
        this.toast.show('SUCCESS', 'Negozio collegato. Incolla l’indirizzo del webhook nel suo pannello.');
      } else {
        await this.store.update(id, {
          label: value.label,
          externalShopId: value.externalShopId,
          // Stringa vuota = «il negozio non lo chiede»: si manda `null`, che è
          // ciò che quel campo significa in colonna.
          roleAttributeName: value.roleAttributeName || null,
          attendeeNameAttributeName: value.attendeeNameAttributeName || null,
          status: value.status,
          // Si mandano **solo se compilati**: una stringa vuota sostituirebbe il
          // segreto con il nulla, e il canale smetterebbe di ricevere vendite.
          ...(value.webhookSecret ? { webhookSecret: value.webhookSecret } : {}),
          ...(value.credentials ? { credentials: value.credentials } : {}),
        });
        this.toast.show('SUCCESS', 'Collegamento aggiornato.');
      }
      this.editing.set(false);
      await this.store.load();
    } catch (err) {
      const unmatched = applyZodIssues(this.form, err);
      this.formErrors.set(unmatched.length ? unmatched : ['Controlla i campi evidenziati.']);
    }
  }

  async onConfigAction(button: SectionActionButton): Promise<void> {
    const channel = this.configuring();
    if (button.id === 'cancel' || !channel) {
      this.configuring.set(null);
      return;
    }

    this.configErrors.set([]);
    const value = this.configForm.getRawValue();

    try {
      const mappings = parseMappings(value.mappings, channel.mappings);
      const depositCodes = parseDepositCodes(value.depositCodes, channel.depositCodes);

      await this.store.saveMappings(channel.id, mappings);
      await this.store.saveDepositCodes(channel.id, depositCodes);

      this.toast.show('SUCCESS', 'Configurazione del negozio aggiornata.');
      this.configuring.set(null);
      await this.store.load();
    } catch (err) {
      this.configErrors.set([(err as Error).message]);
    }
  }

  async disconnect(channel: SalesChannel): Promise<void> {
    const ok = await this.confirm.ask({
      title: 'Scollegare il negozio?',
      message:
        `Le notifiche di ${channel.label} verranno rifiutate. Le vendite già entrate restano dove ` +
        'sono, con i loro iscritti e i loro biglietti: scollegare non disfa nulla di ciò che è ' +
        'già stato venduto.',
      confirmLabel: 'Scollega',
      destructive: true,
    });
    if (!ok) return;
    await this.store.remove(channel.id);
    this.toast.show('SUCCESS', 'Negozio scollegato.');
  }
}
