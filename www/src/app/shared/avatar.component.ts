import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';

/**
 * **Il ritratto della persona**, in testata e nel proprio profilo.
 *
 * Mostra la fotografia quando c'è e le iniziali quando non c'è. Le iniziali non
 * sono un ripiego: finché il sito non avrà chiesto a nessuno di caricare una
 * foto — e non ha ragione di insistere — sono ciò che quasi tutti vedranno, e
 * devono avere l'aria di una scelta.
 *
 * Sono testo, non un'immagine generata: si ridimensionano con la pagina e non
 * costano una richiesta di rete. L'`aria-hidden` c'è perché il nome per esteso
 * sta già accanto, e annunciarlo due volte — una da persona e una da sigla —
 * sarebbe rumore per chi ascolta.
 */
@Component({
  selector: 'app-avatar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (photo(); as url) {
      <img class="avatar" [style.--size]="size()" [src]="url" alt="" (error)="onBrokenImage(url)" />
    } @else {
      <span class="avatar avatar--initials" [style.--size]="size()" aria-hidden="true">{{
        initials()
      }}</span>
    }
  `,
  styles: [
    `
      :host {
        display: inline-flex;
        flex: none;
      }
      .avatar {
        width: var(--size, 2rem);
        height: var(--size, 2rem);
        border-radius: 50%;
        object-fit: cover;
        flex: none;
        border: 1px solid rgba(var(--text-rgb), 0.18);
        background: rgb(var(--background-color));
      }
      .avatar--initials {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        /* Stessa velatura del cast: l'accento è il colore che il tema
           garantisce leggibile su entrambi i fondi, e al 10% il fondo non si
           schiarisce abbastanza da avvicinare i due valori. */
        background: rgba(var(--accent-rgb), 0.1);
        color: rgb(var(--accent-rgb));
        font-size: calc(var(--size, 2rem) * 0.38);
        font-weight: 600;
        letter-spacing: 0.02em;
      }
    `,
  ],
})
export class AvatarComponent {
  readonly src = input<string | null>(null);
  /** Le iniziali già pronte: chi chiama sa se ha nome e cognome o solo un nickname. */
  readonly initials = input<string>('?');
  /** Qualsiasi lunghezza CSS: la testata usa 2rem, la pagina del profilo 5rem. */
  readonly size = input<string>('2rem');

  /**
   * L'ultimo URL che il browser non ha caricato. È tenuto come valore e non
   * come interruttore: quando `src` cambia il confronto smette di corrispondere
   * e il tentativo riparte da solo, senza nessun azzeramento da ricordare.
   */
  private readonly brokenSrc = signal<string | null>(null);

  protected readonly photo = computed(() => {
    const url = this.src()?.trim();
    if (!url || url === this.brokenSrc()) return null;
    return url;
  });

  protected onBrokenImage(url: string): void {
    this.brokenSrc.set(url);
  }
}
