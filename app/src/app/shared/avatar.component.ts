import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';

/**
 * Parole che non contano per le iniziali.
 *
 * L'anagrafica del cast è piena di coppie — «Lucila Cionci y Joe Corbata»,
 * «Punto y Branca» — e prendendo alla lettera le prime due parole si otterrebbe
 * `LY` e `PY`: la `y` non è un'iniziale di nessuno. Saltandola vengono `LC` e
 * `PB`, che è quello che chiunque scriverebbe a mano.
 */
const CONNECTORS = new Set(['y', 'e', 'and', 'con', 'di', 'de', 'del', 'della', 'da', 'du', 'van', 'von']);

/** La prima lettera utile di una parola, maiuscola. */
function firstLetter(word: string): string {
  return word.trim().charAt(0).toUpperCase();
}

/**
 * **Il ritratto accanto a un nome**, negli elenchi del pannello.
 *
 * Mostra la fotografia quando c'è e le **iniziali** quando non c'è: per Flavio
 * Troia, `FT`. Non è un ripiego grafico — un elenco di venti righe tutte uguali
 * si legge scorrendo il testo, mentre due lettere colorate danno un appiglio
 * all'occhio anche quando la fotografia manca, che è il caso normale.
 *
 * ── Perché le iniziali non sono un'immagine ─────────────────────────────────
 * Sono testo: si ridimensionano con la pagina, si leggono da uno screen reader
 * se serve, e non costano una richiesta di rete a riga. L'`aria-hidden` c'è
 * perché il nome per esteso sta già nella riga accanto: annunciarlo due volte,
 * una da persona e una da sigla, sarebbe rumore.
 *
 * ── L'immagine che non arriva ───────────────────────────────────────────────
 * Se l'URL è rotto — file rimosso a mano, dominio del backend cambiato — il
 * componente ricade sulle iniziali invece di lasciare il rettangolo spezzato
 * del browser. La memoria di quale URL ha fallito è tenuta come valore, non
 * come interruttore: quando `src` cambia il confronto smette di corrispondere e
 * il tentativo riparte da solo, senza nessun azzeramento da ricordare.
 */
@Component({
  selector: 'app-avatar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (photo(); as url) {
      <img
        class="avatar"
        [class.avatar--portrait]="shape() === 'portrait'"
        [class.avatar--square]="shape() === 'square'"
        [src]="url"
        alt=""
        loading="lazy"
        (error)="onBrokenImage(url)"
      />
    } @else {
      <span
        class="avatar avatar--initials"
        [class.avatar--portrait]="shape() === 'portrait'"
        [class.avatar--square]="shape() === 'square'"
        aria-hidden="true"
        >{{ initials() }}</span
      >
    }
  `,
  styles: [
    `
      :host {
        display: inline-flex;
        flex: none;
      }
      .avatar {
        width: 2rem;
        height: 2rem;
        border-radius: 50%;
        flex: none;
        object-fit: cover;
        border: 1px solid rgba(var(--text-rgb), 0.14);
      }
      /* Il ritaglio verticale della locandina è 2:3: mostrarlo dentro un
         cerchio significherebbe buttare via i lati e metà del titolo. Qui
         conserva le sue proporzioni, in piccolo. */
      .avatar--portrait {
        width: 2rem;
        height: 3rem;
        border-radius: 0.3rem;
      }
      /* Un logo è quadrato e ha spesso il nome scritto dentro: nel cerchio ne
         perderebbe gli angoli, cioè le lettere ai bordi. Qui resta intero, e la
         forma diversa distingue a colpo d'occhio una cosa da una persona. */
      .avatar--square {
        border-radius: 0.3rem;
      }
      .avatar--initials {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        /* L'accento è già il colore che il tema garantisce leggibile su
           entrambi i fondi; la velatura al 10% resta abbastanza scura da non
           avvicinare i due valori. */
        background: rgba(var(--accent-rgb), 0.1);
        color: rgb(var(--accent-rgb));
        font-size: 0.75rem;
        font-weight: 600;
        letter-spacing: 0.02em;
      }
    `,
  ],
})
export class AvatarComponent {
  /** L'URL della fotografia, quando la persona ne ha una. */
  readonly src = input<string | null>(null);
  /** Nome di battesimo, oppure il nome intero di un artista. */
  readonly name = input<string>('');
  /**
   * Il cognome, quando esiste come campo suo. Gli artisti non ce l'hanno — il
   * loro nome è una stringa sola, spesso una coppia — e allora le iniziali si
   * ricavano dalle parole del nome.
   */
  readonly surname = input<string | null>(null);

  /**
   * `circle` per le persone, `portrait` per la locandina di un evento,
   * `square` per il logo di un'organizzazione e per i luoghi.
   *
   * Non è una preferenza estetica: il ritaglio verticale è 2:3 e nel cerchio
   * perderebbe i lati — quasi sempre il titolo stampato sopra —; un logo
   * quadrato perderebbe gli angoli, dove di solito sta il nome. La forma dice
   * anche di che cosa si parla: tondo una persona, squadrato una cosa.
   */
  readonly shape = input<'circle' | 'portrait' | 'square'>('circle');

  /** L'ultimo URL che il browser non è riuscito a caricare. */
  private readonly brokenSrc = signal<string | null>(null);

  protected readonly photo = computed(() => {
    const url = this.src()?.trim();
    if (!url || url === this.brokenSrc()) return null;
    return url;
  });

  protected readonly initials = computed(() => {
    const name = this.name().trim();
    const surname = (this.surname() ?? '').trim();

    if (surname) return `${firstLetter(name)}${firstLetter(surname)}` || '?';

    const words = name
      .split(/\s+/)
      // I titoli degli eventi sono pieni di trattini lunghi e virgolette
      // — «International Trani Tango — XIV edizione» — e un `—` non è
      // l'iniziale di niente.
      .map((w) => w.replace(/^[^\p{L}\p{N}]+/u, ''))
      .filter((w) => w && !CONNECTORS.has(w.toLowerCase()));
    return words.slice(0, 2).map(firstLetter).join('') || '?';
  });

  protected onBrokenImage(url: string): void {
    this.brokenSrc.set(url);
  }
}
