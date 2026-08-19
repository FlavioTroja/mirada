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
} from '@keijo/ui';
import { checkCircle, groups, iconDelete, mail, schedule, send } from '@keijo/ui/icons';
import { ApiClient } from '../../core/api/api.client';
import { OrganizationInvitation } from '../../core/domain/models';
import { formatDateTime } from '../../core/i18n/format';
import { OrganizationStore } from '../../stores/organization.store';
import { ToastService } from '../../services/toast.service';
import { ConfirmService } from '../../shared/confirm.service';
import { applyZodIssues, clearServerErrors, controlError } from '../../shared/form-errors';
import { OrganizationContextComponent } from './organization-context.component';

/**
 * `/organization/invitations` — invitare un altro titolare.
 *
 * ── Perché non sta dentro «Membri» ───────────────────────────────────────────
 * Quella pagina assegna ruoli a chi **ha già un'utenza**: sceglie da un elenco.
 * Qui l'invitato non esiste ancora da nessuna parte, e l'unica cosa che se ne
 * conosce è l'indirizzo email. Sono due gesti diversi con due prerequisiti
 * diversi, e mescolarli produrrebbe un modulo che a volte chiede un utente e a
 * volte un indirizzo, senza che si capisca quando.
 *
 * ── Cosa NON si può fare da qui ──────────────────────────────────────────────
 * Invitare responsabili eventi o operatori di check-in: quei ruoli si assegnano
 * dalla pagina «Membri» a chi un'utenza ce l'ha. L'invito serve a far entrare
 * **un altro titolare**, che è la sola persona che possa avere bisogno di
 * arrivare da fuori.
 */
@Component({
  selector: 'app-organization-invitations',
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
    OrganizationContextComponent,
  ],
  template: `
    <keijo-page-wrapper>
      <app-organization-context current="invitations" />

      <keijo-page-section-wrapper title="Invita un altro titolare">
        <p class="mirada-hint">
          Arriva un’email con un link personale, valido sette giorni e spendibile una sola volta.
          Chi lo riceve accede — creandosi un account se non ce l’ha — ed entra in questa
          organizzazione come titolare: potrà creare eventi, seguire le iscrizioni e vedere gli
          incassi.
        </p>

        @if (formErrors().length) {
          <p class="mirada-error">{{ formErrors().join(' ') }}</p>
        }

        <keijo-form-wrapper [formGroup]="form">
          <keijo-form-row [cols]="1">
            <keijo-input
              [formControl]="form.controls.email"
              label="email della persona da invitare"
              id="email"
              type="email"
            />
          </keijo-form-row>
          @if (err(form.controls.email); as msg) {
            <p class="mirada-error">{{ msg }}</p>
          }
          <div class="submit-row">
            <keijo-button
              [icon]="sendIcon"
              label="Manda l’invito"
              variant="accent"
              [loading]="sending()"
              [disabled]="form.invalid || !organizationId()"
              (action)="invia()"
            />
          </div>
        </keijo-form-wrapper>
      </keijo-page-section-wrapper>

      <keijo-page-section-wrapper mode="plain">
        @if (loading()) {
          <keijo-list-items-skeleton />
        } @else {
          <keijo-list-items-wrapper>
            @for (invito of items(); track invito.id) {
              <keijo-entity-list-item [expandable]="true">
                <ng-template #primary>
                  <div class="primary">
                    <span class="title">{{ invito.email }}</span>
                    <span class="mirada-muted">titolare</span>
                  </div>
                </ng-template>
                <ng-template #secondary>
                  <div class="secondary">
                    @if (invito.acceptedAt) {
                      <keijo-pill variant="success" [icon]="acceptedIcon">
                        accettato il {{ when(invito.acceptedAt) }}
                      </keijo-pill>
                    } @else if (invito.revokedAt) {
                      <keijo-pill variant="default" [icon]="deleteIcon">
                        revocato il {{ when(invito.revokedAt) }}
                      </keijo-pill>
                    } @else if (scaduto(invito)) {
                      <keijo-pill variant="default" [icon]="scheduleIcon">
                        scaduto il {{ when(invito.expiresAt) }}
                      </keijo-pill>
                    } @else {
                      <keijo-pill variant="warning" [icon]="scheduleIcon">
                        in attesa — scade il {{ when(invito.expiresAt) }}
                      </keijo-pill>
                    }
                  </div>
                </ng-template>
                <ng-template #actions>
                  @if (revocabile(invito)) {
                    <keijo-button
                      variant="error"
                      [icon]="deleteIcon"
                      tooltip="Revoca l’invito"
                      (action)="revoca(invito)"
                    />
                  }
                </ng-template>
              </keijo-entity-list-item>
            } @empty {
              <keijo-info-box [icon]="membersIcon" title="Nessun invito" variant="info">
                <span>
                  Quando inviti qualcuno, l’invito resta qui finché non viene accettato — così sai
                  sempre chi stai aspettando, e puoi revocarlo se cambi idea.
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
      }
      .submit-row {
        display: flex;
        justify-content: flex-end;
        margin-top: 0.5rem;
      }
    `,
  ],
})
export class OrganizationInvitationsComponent implements OnInit {
  private readonly api = inject(ApiClient);
  private readonly orgStore = inject(OrganizationStore);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);

  readonly sendIcon = send;
  readonly deleteIcon = iconDelete;
  readonly membersIcon = groups;
  readonly acceptedIcon = checkCircle;
  readonly scheduleIcon = schedule;
  readonly mailIcon = mail;

  readonly items = signal<OrganizationInvitation[]>([]);
  readonly loading = signal(false);
  readonly sending = signal(false);
  readonly formErrors = signal<string[]>([]);

  readonly organizationId = computed(() => this.orgStore.current()?.id ?? null);

  readonly form = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
  });

  async ngOnInit(): Promise<void> {
    await this.orgStore.replaceQuery({});
    // Si conserva la selezione già attiva: ricaricare incondizionatamente il
    // primo elemento la sovrascriverebbe a ogni passaggio fra le schede
    // dell'organizzazione, come già capitato in «Membri».
    const target = this.orgStore.current()?.id ?? this.orgStore.items()[0]?.id;
    if (target) await this.orgStore.loadOne(target);
    await this.ricarica();
  }

  err(control: FormControl<string>): string | null {
    return controlError(control);
  }

  when(value?: string | null): string {
    return value ? formatDateTime(value) : '—';
  }

  scaduto(invito: OrganizationInvitation): boolean {
    return !invito.acceptedAt && !invito.revokedAt && new Date(invito.expiresAt) <= new Date();
  }

  revocabile(invito: OrganizationInvitation): boolean {
    return !invito.acceptedAt && !invito.revokedAt;
  }

  async invia(): Promise<void> {
    this.form.markAllAsTouched();
    clearServerErrors(this.form);
    this.formErrors.set([]);
    const organizationId = this.organizationId();
    if (this.form.invalid || !organizationId) return;

    this.sending.set(true);
    try {
      await this.api.post('/organization-invitations/create', {
        organizationId,
        email: this.form.controls.email.value.trim(),
      });
      this.toast.show('SUCCESS', 'Invito mandato.');
      this.form.reset();
      await this.ricarica();
    } catch (err) {
      const unmatched = applyZodIssues(this.form, err);
      if (unmatched.length) this.formErrors.set(unmatched);
    } finally {
      this.sending.set(false);
    }
  }

  async revoca(invito: OrganizationInvitation): Promise<void> {
    const ok = await this.confirm.ask({
      title: 'Revocare l’invito?',
      message: `Il link mandato a ${invito.email} smetterà di funzionare. Potrai sempre invitarlo di nuovo.`,
      confirmLabel: 'Revoca',
    });
    if (!ok) return;

    await this.api.remove('organization-invitations', invito.id);
    this.toast.show('SUCCESS', 'Invito revocato.');
    await this.ricarica();
  }

  private async ricarica(): Promise<void> {
    const organizationId = this.organizationId();
    if (!organizationId) return;
    this.loading.set(true);
    try {
      const res = await this.api.list<OrganizationInvitation>(
        'organization-invitations',
        { organizationId },
        { page: 1, limit: 50, sort: { createdAt: 'desc' } },
      );
      this.items.set(res.docs ?? []);
    } finally {
      this.loading.set(false);
    }
  }
}
