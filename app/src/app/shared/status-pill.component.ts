import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { PillComponent } from '@keijo/ui';
import { StatusUi } from '../core/domain/enums';

/**
 * Pill di stato con **icona semantica**: la coppia variante + icona arriva
 * sempre dalla mappa `*_UI` dell'enumerazione, mai da un'icona fissa riusata
 * per ogni stato (`KEIJO-PILL-ICON-SEMANTIC`, `KEIJO-PILL-ICON-REQUIRED`).
 */
@Component({
  selector: 'app-status-pill',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PillComponent],
  template: `
    @if (status(); as ui) {
      <keijo-pill [variant]="ui.variant" [icon]="ui.icon" [tooltip]="ui.hint ?? ui.label">
        {{ ui.label }}
      </keijo-pill>
    }
  `,
})
export class StatusPillComponent {
  readonly status = input<StatusUi | null>(null);
}
