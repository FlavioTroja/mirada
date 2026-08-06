import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { I18nText } from '../core/domain/models';
import { resolveText } from '../core/format/format';

/**
 * Rende un `I18nText` (§3.5).
 *
 * In assenza della traduzione si mostra **l'originale con l'indicazione della
 * lingua**, mai una stringa vuota (`RF-PUB-10`): un titolo scomparso perché
 * l'organizzatore non ha tradotto è un difetto, non una scelta editoriale.
 */
@Component({
  selector: 'app-i18n-text',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (resolved().text) {
      <span>{{ resolved().text }}</span>
      @if (resolved().fallback && showLanguage()) {
        <span class="www-lang-note" [title]="'Traduzione non disponibile: testo in ' + resolved().langLabel">
          in {{ resolved().langLabel }}
        </span>
      }
    } @else if (emptyLabel()) {
      <span class="www-muted">{{ emptyLabel() }}</span>
    }
  `,
})
export class I18nTextComponent {
  readonly value = input<I18nText | null | undefined>(null);
  /** Lingua desiderata: l'interfaccia è italiana, l'inglese è la seconda. */
  readonly lang = input<string>('it');
  readonly showLanguage = input<boolean>(true);
  readonly emptyLabel = input<string>('');

  protected readonly resolved = computed(() => resolveText(this.value(), this.lang()));
}
