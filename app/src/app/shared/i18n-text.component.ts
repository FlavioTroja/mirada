import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { I18nText, LocaleService, resolveI18n } from '../core/i18n/i18n-text';

/**
 * Mostra un campo `I18nText` nella lingua dell'interfaccia.
 *
 * In **assenza della traduzione** mostra il testo originale **con l'indicazione
 * della lingua**, mai una stringa vuota (`RF-PUB-10`, §5). Il marcatore di
 * lingua non è decorativo: dice all'organizzatore cosa gli manca di tradurre.
 */
@Component({
  selector: 'app-i18n-text',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (resolved(); as value) {
      <span class="i18n-value">{{ value.text }}</span>
      @if (value.fallback) {
        <span
          class="i18n-lang"
          [title]="'Traduzione mancante: testo mostrato in ' + langName()"
          >{{ value.lang.toUpperCase() }}</span
        >
      }
    } @else {
      <span class="i18n-missing">{{ empty() }}</span>
    }
  `,
  styles: [
    `
      :host {
        display: inline-flex;
        align-items: baseline;
        gap: 0.35rem;
        min-width: 0;
      }
      .i18n-value {
        min-width: 0;
        overflow-wrap: anywhere;
      }
      .i18n-lang {
        flex: none;
        font-size: 0.625rem;
        font-weight: 700;
        letter-spacing: 0.04em;
        line-height: 1.4;
        padding: 0 0.3rem;
        border-radius: 0.25rem;
        border: 1px solid currentColor;
        opacity: 0.75;
      }
      .i18n-missing {
        opacity: 0.6;
        font-style: italic;
      }
    `,
  ],
})
export class I18nTextComponent {
  private readonly locale = inject(LocaleService);

  readonly value = input<I18nText | null | undefined>(null);
  /** Testo mostrato quando nessuna lingua è valorizzata. */
  readonly empty = input('Testo non ancora inserito');

  readonly resolved = computed(() => resolveI18n(this.value(), this.locale.lang()));
  readonly langName = computed(() =>
    this.resolved()?.lang === 'en' ? 'inglese' : 'italiano',
  );
}
