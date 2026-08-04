import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { InfoBoxComponent, PageSectionWrapperComponent, SectionActionButton } from '@keijo/ui';
import { close } from '@keijo/ui/icons';
import { DomainErrorBus } from '../core/api/domain-error';

/**
 * Presenta gli **errori di dominio** del §3.3 in pagina, mai in un toast
 * generico (§5). Va montato nelle pagine che possono provocarli.
 *
 * `SOLD_OUT` e `ROLE_ON_HOLD` non condividono né colore né formulazione: il
 * primo è definitivo, il secondo è temporaneo e sbloccabile (`RF-PAY-17`).
 */
@Component({
  selector: 'app-domain-error',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [InfoBoxComponent, PageSectionWrapperComponent],
  template: `
    @if (bus.view(); as view) {
      <keijo-page-section-wrapper mode="plain">
        <keijo-info-box
          [icon]="view.icon"
          [title]="view.title"
          [variant]="view.variant"
          [actions]="dismissActions"
          (actionClick)="bus.clear()"
        >
          <span>{{ view.detail }}</span>
        </keijo-info-box>
      </keijo-page-section-wrapper>
    }
  `,
})
export class DomainErrorComponent {
  readonly bus = inject(DomainErrorBus);

  readonly dismissActions: SectionActionButton[] = [
    { id: 'dismiss', icon: close, label: 'Chiudi', variant: 'default' },
  ];
}
