import { ChangeDetectionStrategy, Component, OnInit, computed, inject } from '@angular/core';
import {
  InfoBoxComponent,
  ListItemsWrapperComponent,
  ListItemWrapperComponent,
  PageSectionWrapperComponent,
  PageWrapperComponent,
  PillComponent,
} from '@keijo/ui';
import { checkCircle, payments, rule, schedule, sync, warning } from '@keijo/ui/icons';
import { HeaderTitleService } from '../../services/header-title.service';
import { PageAction, PageActionsService } from '../../services/page-actions.service';
import { ToastService } from '../../services/toast.service';
import { PAYOUT_STATUS_UI } from '../../core/domain/enums';
import { formatCents, formatDateTime } from '../../core/i18n/format';
import { OrganizationStore } from '../../stores/organization.store';
import { StatusPillComponent } from '../../shared/status-pill.component';
import { OrganizationContextComponent } from './organization-context.component';

/**
 * `/organization/payout` — lo **stato di abilitazione all'incasso** (§4.9).
 *
 * È in evidenza perché la decadenza dell'abilitazione **sospende la vendita**
 * (`RF-ORG-11`), e l'Owner deve capire in un colpo d'occhio quale adempimento
 * manca. La pagina dice esplicitamente che **i biglietti già emessi restano
 * validi e i rimborsi restano eseguibili**: senza quella riga il messaggio
 * spaventa più del dovuto.
 */
@Component({
  selector: 'app-organization-payout',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    PageWrapperComponent,
    PageSectionWrapperComponent,
    ListItemsWrapperComponent,
    ListItemWrapperComponent,
    PillComponent,
    InfoBoxComponent,
    StatusPillComponent,
    OrganizationContextComponent,
  ],
  template: `
    <keijo-page-wrapper>
      <app-organization-context current="payout" />

      @if (store.current()) {
        <keijo-page-section-wrapper title="Stato dell’incasso">
          <div class="head">
            <app-status-pill [status]="payoutUi()" />
            <keijo-pill variant="default" [icon]="clockIcon">
              ultima verifica {{ lastCheck() }}
            </keijo-pill>
            @if (pendingBalance() !== null) {
              <keijo-pill
                variant="info"
                [icon]="payoutIcon"
                tooltip="Fondi in attesa presso il prestatore di pagamento"
              >
                {{ pendingLabel() }} in attesa
              </keijo-pill>
            }
          </div>

          <keijo-info-box
            [icon]="okIcon"
            title="Cosa resta valido anche senza abilitazione"
            variant="info"
          >
            <span>
              La sospensione dell’abilitazione blocca <strong>solo la vendita online</strong>. I
              biglietti già emessi restano validi, gli iscritti entrano regolarmente e i rimborsi
              restano eseguibili.
            </span>
          </keijo-info-box>
        </keijo-page-section-wrapper>

        <keijo-page-section-wrapper title="Adempimenti richiesti">
          @if (requirements().length) {
            <p class="mirada-hint">
              Finché questi punti restano aperti, il prestatore di pagamento non abilita
              l’incasso e la pubblicazione di nuovi eventi viene rifiutata.
            </p>
            <keijo-list-items-wrapper>
              @for (item of requirements(); track item) {
                <keijo-list-item-wrapper direction="row" variant="warning">
                  <div class="requirement">
                    <keijo-pill variant="warning" [icon]="ruleIcon">da completare</keijo-pill>
                    <span class="mirada-value">{{ item }}</span>
                  </div>
                </keijo-list-item-wrapper>
              }
            </keijo-list-items-wrapper>
          } @else {
            <keijo-info-box
              [icon]="okIcon"
              title="Nessun adempimento aperto"
              variant="success"
            >
              <span>
                Il prestatore di pagamento non segnala richieste pendenti per questa
                organizzazione.
              </span>
            </keijo-info-box>
          }
          @if (disabledReason(); as reason) {
            <p class="mirada-error">Motivo della sospensione: {{ reason }}</p>
          }
        </keijo-page-section-wrapper>
      }
    </keijo-page-wrapper>
  `,
  styles: [
    `
      .head {
        display: flex;
        flex-wrap: wrap;
        gap: 0.375rem;
        align-items: center;
      }
      .requirement {
        display: flex;
        align-items: center;
        gap: 0.625rem;
      }
    `,
  ],
})
export class OrganizationPayoutComponent implements OnInit {
  private readonly headerTitle = inject(HeaderTitleService);
  private readonly pageActions = inject(PageActionsService);
  private readonly toast = inject(ToastService);

  readonly store = inject(OrganizationStore);

  readonly payoutIcon = payments;
  readonly clockIcon = schedule;
  readonly ruleIcon = rule;
  readonly okIcon = checkCircle;
  readonly warningIcon = warning;

  readonly payoutUi = computed(() => {
    const report = this.store.payout();
    const org = this.store.current();
    const status = report?.payoutStatus ?? org?.payoutStatus;
    return status ? PAYOUT_STATUS_UI[status] : null;
  });

  readonly lastCheck = computed(() =>
    formatDateTime(this.store.payout()?.payoutCheckedAt ?? this.store.current()?.payoutCheckedAt),
  );

  readonly pendingBalance = computed(() => this.store.payout()?.pendingBalance ?? null);
  readonly pendingLabel = computed(() => formatCents(this.pendingBalance()));

  readonly disabledReason = computed(() => this.store.payout()?.disabledReason ?? null);

  /** Gli adempimenti mancanti, così come li riporta il prestatore di pagamento. */
  readonly requirements = computed(() => {
    const report = this.store.payout();
    if (!report) return [];
    return [
      ...(report.pastDue ?? []),
      ...(report.currentlyDue ?? []),
      ...(report.requirements ?? []),
    ].filter((value, index, all) => all.indexOf(value) === index);
  });

  async ngOnInit(): Promise<void> {
    this.headerTitle.set('Incasso');
    await this.store.replaceQuery({});
    const first = this.store.items()[0];
    if (first) {
      await this.store.loadOne(first.id);
      await this.refresh(false);
    }
    this.registerActions();
  }

  private registerActions(): void {
    const actions: PageAction[] = [];
    if (this.store.current()) {
      actions.push({
        id: 'verify',
        icon: sync,
        label: 'Verifica',
        tooltip: 'Verifica ora lo stato presso il prestatore di pagamento',
        run: () => void this.refresh(true),
      });
    }
    this.pageActions.set(actions);
  }

  /** `GET /organizations/:id/payout-status` — cruscotto dell'incasso (`RF-ORG-12`). */
  private async refresh(notify: boolean): Promise<void> {
    const org = this.store.current();
    if (!org) return;
    try {
      await this.store.loadPayoutStatus(org.id);
      if (notify) this.toast.show('SUCCESS', 'Stato dell’incasso aggiornato.');
    } catch {
      if (notify) {
        this.toast.show('WARNING', 'Lo stato dell’incasso non è al momento verificabile.');
      }
    }
  }
}
