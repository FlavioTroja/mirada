import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { InfoBoxComponent, PillComponent } from '@keijo/ui';
import { pending, rule } from '@keijo/ui/icons';
import { UnavailableSection } from '../core/domain/dashboard';

/**
 * Una sezione **non ancora calcolabile** (`RB21`).
 *
 * Non è un errore, non è un vuoto e **non è zero**. È una grandezza che non
 * esiste perché le entità su cui si calcola non sono state ancora costruite, e
 * il backend ne dichiara il motivo: si mostra quello, testuale, insieme
 * all'elenco di ciò che manca.
 *
 * Un cruscotto che scrivesse «incasso netto: 0 €» quando gli ordini non
 * esistono mente all'organizzatore la sera dell'evento: è esattamente ciò che
 * `RB21` vieta.
 */
@Component({
  selector: 'app-unavailable-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [InfoBoxComponent, PillComponent],
  template: `
    @if (section(); as info) {
      <keijo-info-box [icon]="pendingIcon" [title]="title()" variant="warning">
        <span class="body">
          <span class="reason">{{ info.reason }}</span>
          @if (info.requires.length) {
            <span class="requires">
              <span class="mirada-label">Serve prima</span>
              @for (entity of info.requires; track entity) {
                <keijo-pill
                  variant="default"
                  [icon]="requiresIcon"
                  tooltip="Entità non ancora costruita"
                >
                  {{ entity }}
                </keijo-pill>
              }
            </span>
          }
        </span>
      </keijo-info-box>
    }
  `,
  styles: [
    `
      .body {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }
      .requires {
        display: flex;
        flex-wrap: wrap;
        gap: 0.375rem;
        align-items: center;
      }
    `,
  ],
})
export class UnavailableSectionComponent {
  readonly section = input<UnavailableSection | null>(null);
  readonly label = input<string>('');

  readonly pendingIcon = pending;
  readonly requiresIcon = rule;

  readonly title = computed(() =>
    this.label() ? `${this.label()} — non ancora calcolabile` : 'Non ancora calcolabile',
  );
}
