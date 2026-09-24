import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * I due pulsanti degli store — **disattivati**, con scritto «presto».
 *
 * ── Perché ci sono, se l'app non c'è ancora ─────────────────────────────────
 * Il sito esiste per portare chi balla all'app (decisione del committente,
 * 24 settembre 2026). Mostrare dove la si scaricherà dice qual è il prodotto;
 * **non** fingere che sia già lì è ciò che impedisce alla promessa di bruciarsi.
 *
 * ⚠️ Non sono link, e non devono diventarlo finché l'app non è pubblicata: un
 * distintivo che porta a una pagina vuota dello store è peggio di nessun
 * distintivo. Quando i link esisteranno, si passano qui e basta.
 *
 * Nessun logo ufficiale: i marchi di Apple e Google hanno regole d'uso che
 * valgono quando l'app è sugli store, e i loro distintivi si scaricano allora.
 */
@Component({
  selector: 'app-store-badges',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="badges" [class.centrati]="centrati()">
      @for (store of stores; track store.nome) {
        <span class="badge" role="img" [attr.aria-label]="store.nome + ': presto disponibile'">
          <svg viewBox="0 0 24 24" class="ico" aria-hidden="true" fill="none" stroke-width="1.6">
            <rect x="6.5" y="2.5" width="11" height="19" rx="2.5" />
            <path d="M10.5 18.5h3" stroke-linecap="round" />
          </svg>
          <span class="testo">
            <span class="presto">Presto su</span>
            <span class="nome">{{ store.nome }}</span>
          </span>
        </span>
      }
    </div>
  `,
  styles: [
    `
      .badges {
        display: flex;
        flex-wrap: wrap;
        gap: 0.75rem;
      }
      .centrati {
        justify-content: center;
      }
      .badge {
        display: inline-flex;
        align-items: center;
        gap: 0.6rem;
        padding: 0.55rem 1.1rem 0.55rem 0.8rem;
        border-radius: 0.75rem;
        border: 1px solid rgba(var(--text-rgb), 0.35);
        color: rgb(var(--text-rgb));
        background: rgba(var(--text-rgb), 0.06);
        cursor: default;
        user-select: none;
      }
      .ico {
        width: 1.6rem;
        height: 1.6rem;
        stroke: currentColor;
        flex: none;
      }
      .testo {
        display: flex;
        flex-direction: column;
        line-height: 1.15;
        text-align: left;
      }
      .presto {
        font-size: 0.7rem;
        letter-spacing: 0.04em;
        color: rgba(var(--text-rgb), 0.75);
      }
      .nome {
        font-size: 1.05rem;
        font-weight: 600;
      }
    `,
  ],
})
export class StoreBadgesComponent {
  /** Centrati nel piede, allineati a sinistra dove il testo lo è. */
  readonly centrati = input(false);

  readonly stores = [{ nome: 'App Store' }, { nome: 'Google Play' }];
}
