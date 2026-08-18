import { DOCUMENT, Injectable, REQUEST, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';

/**
 * SEO e anteprime di condivisione — **la ragione per cui questa applicazione
 * esiste** (`RF-PUB-6`).
 *
 * Titolo, descrizione, Open Graph con la locandina, Twitter Card, URL stabile e
 * dati strutturati `schema.org/Event` in JSON-LD, tutti scritti **prima** che la
 * pagina venga serializzata: un crawler che non esegue JavaScript deve trovarli
 * nella sorgente, non dopo l'idratazione.
 *
 * ⚠️ Perché la resa lato server è la precondizione di tutto questo:
 * **nessuno dei crawler che conta esegue JavaScript.** WhatsApp, Telegram,
 * Facebook, LinkedIn e X leggono l'HTML come arriva. Se l'SSR non avviene,
 * questi tag esistono solo nel browser di chi visita — cioè per gli unici
 * lettori a cui non servono. È già successo: vedi la nota su
 * `trustProxyHeaders` in `src/server.ts`.
 *
 * Il servizio scrive nel `<head>` tramite `DOCUMENT`, che sul server è il
 * documento in corso di resa: non tocca mai `window`.
 *
 * ## Cosa legge chi
 *
 * | rete | legge | note |
 * |---|---|---|
 * | WhatsApp | `og:title` `og:description` `og:image` | l'immagine deve stare **sotto ~300 KB** o l'anteprima non compare |
 * | Telegram | `og:*`, ripiega su `twitter:*` | rispetta `og:image:width/height` per riservare lo spazio |
 * | Facebook · LinkedIn | `og:*` | vogliono 1200×630; sotto i 200×200 saltano l'immagine |
 * | X | `twitter:card` `twitter:title` `twitter:description` `twitter:image` | senza `twitter:card` niente anteprima grande |
 * | Google | `<title>` `description` `link[canonical]` + JSON-LD | l'unico che guarda anche i dati strutturati |
 *
 * Le proprietà si scrivono **tutte**: sono poche righe e ogni rete ne ignora in
 * silenzio quel che non conosce. La regola opposta — «scrivo solo Open Graph,
 * tanto lo capiscono tutti» — costa l'anteprima grande su X.
 */

const JSON_LD_ID = 'mirada-jsonld';

/**
 * L'immagine di condivisione predefinita del sito, in `www/public/`.
 *
 * ⚠️ Serve **una predefinita**, e non è una comodità: una pagina senza
 * `og:image` viene condivisa su WhatsApp come un rettangolo grigio col solo
 * dominio. Prima di questa, l'intero sito tranne le schede evento si
 * presentava così.
 *
 * 1200×630 (1.91:1) è il formato che le reti ritagliano senza perdere niente.
 */
const IMMAGINE_PREDEFINITA: SeoImage = {
  url: '/social-card.jpg',
  mimeType: 'image/jpeg',
  width: 1200,
  height: 630,
  alt: 'Mirada Tango — eventi di tango argentino',
};

export interface SeoImage {
  url: string;
  /** `image/jpeg`, `image/png`… Alimenta `og:image:type`. */
  mimeType?: string | null;
  /**
   * Dimensioni in pixel, **se note**.
   *
   * Non si inventano: Telegram e Facebook riservano lo spazio dell'anteprima
   * leggendo questi due valori, e sbagliarli produce un riquadro della forma
   * sbagliata che poi si assesta — peggio che non dichiararli affatto. Le
   * locandine caricate dagli organizzatori non hanno dimensioni in banca dati,
   * quindi per loro restano assenti.
   */
  width?: number | null;
  height?: number | null;
  alt?: string | null;
}

export interface SeoTags {
  title: string;
  description: string;
  /** Percorso assoluto dell'applicazione, es. `/eventi/…`: diventa URL stabile. */
  path: string;
  /**
   * L'immagine dell'anteprima. Una stringa vale come sola URL; `null` **non**
   * significa «nessuna immagine» ma «usa quella del sito», perché una pagina
   * senza anteprima è una pagina che si condivide male.
   */
  image?: SeoImage | string | null;
  type?: 'website' | 'article' | 'event';
  /** Lingua del contenuto, se diversa dall'italiano. */
  locale?: string;
  /** Altre lingue in cui il contenuto esiste: alimenta `og:locale:alternate`. */
  altLocales?: readonly string[];
  /**
   * Tiene la pagina fuori dai motori di ricerca.
   *
   * Serve alle pagine che esistono solo per un gettone monouso — la conferma
   * dell'indirizzo — dove l'indicizzazione significherebbe pubblicare l'URL
   * **gettone compreso**.
   */
  noIndex?: boolean;
}

@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly doc = inject(DOCUMENT);
  private readonly request = inject(REQUEST, { optional: true });

  /**
   * Origine assoluta della pagina corrente. Sul server si legge dalla richiesta
   * in corso; nel browser da `location`. Serve per `og:url` e per il link
   * canonico, che devono essere **assoluti** o non valgono nulla.
   *
   * ⚠️ Dietro il proxy questo vale `https://mirada.dance` **solo** perché
   * `src/server.ts` dichiara `x-forwarded-proto` fra le intestazioni fidate.
   * Senza, l'URL si formerebbe su `http`, e un `og:url` in chiaro su un sito in
   * HTTPS è la differenza fra un'anteprima e un avviso di sicurezza.
   */
  origin(): string {
    if (this.request?.url) {
      try {
        return new URL(this.request.url).origin;
      } catch {
        /* URL non parsabile: si ricade sul default */
      }
    }
    const loc = this.doc.defaultView?.location;
    if (loc?.origin) return loc.origin;
    return (typeof process !== 'undefined' && process.env?.['PUBLIC_ORIGIN']) || 'http://localhost:4000';
  }

  absolute(path: string): string {
    if (!path) return this.origin();
    if (/^https?:\/\//i.test(path)) return path;
    return `${this.origin()}${path.startsWith('/') ? path : `/${path}`}`;
  }

  apply(tags: SeoTags): void {
    const url = this.absolute(tags.path);
    const img = this.normalizzaImmagine(tags.image);

    this.title.setTitle(tags.title);
    this.setName('description', tags.description);

    // ── Open Graph: la base che leggono tutti ────────────────────────────────
    this.setProperty('og:title', tags.title);
    this.setProperty('og:description', tags.description);
    // `event` non è un tipo Open Graph riconosciuto: le reti che non lo capiscono
    // saltano l'anteprima. Un evento si dichiara `article` qui, e resta un
    // `schema.org/Event` nel JSON-LD, che è il posto dove quel dato conta.
    this.setProperty('og:type', tags.type === 'event' ? 'article' : (tags.type ?? 'website'));
    this.setProperty('og:url', url);
    this.setProperty('og:site_name', 'Mirada Tango');
    this.setProperty('og:locale', this.ogLocale(tags.locale));

    // Le lingue alternative si RIMUOVONO prima di riscriverle: `updateTag` ne
    // aggiorna una sola, e passando da un evento bilingue a uno monolingue la
    // seconda resterebbe attaccata alla pagina nuova.
    this.meta.removeTag("property='og:locale:alternate'");
    for (const alt of tags.altLocales ?? []) {
      if (alt && alt !== tags.locale) {
        this.meta.addTag({ property: 'og:locale:alternate', content: this.ogLocale(alt) });
      }
    }

    this.applicaImmagine(img);

    // ── Twitter Card ─────────────────────────────────────────────────────────
    // Senza `twitter:card` X mostra un collegamento nudo. `summary_large_image`
    // vale la pena solo con un'immagine: senza, la card grande resta vuota.
    this.setName('twitter:card', img ? 'summary_large_image' : 'summary');
    this.setName('twitter:title', tags.title);
    this.setName('twitter:description', tags.description);

    // Si **rimuove** quando non serve, non solo si aggiunge quando serve: le
    // rotte cambiano senza ricaricare il documento, e un `robots: noindex`
    // lasciato dalla pagina precedente toglierebbe dai motori di ricerca la
    // scheda dell'evento su cui l'utente è appena arrivato.
    if (tags.noIndex) this.setName('robots', 'noindex, nofollow');
    else this.meta.removeTag("name='robots'");

    this.setCanonical(url);
  }

  /** Dati strutturati: un solo blocco per pagina, sostituito a ogni rotta. */
  setJsonLd(data: unknown | null): void {
    const head = this.doc.head;
    if (!head) return;

    const existing = this.doc.getElementById(JSON_LD_ID);
    if (existing?.parentNode) existing.parentNode.removeChild(existing);
    if (!data) return;

    const script = this.doc.createElement('script');
    script.id = JSON_LD_ID;
    script.setAttribute('type', 'application/ld+json');
    // `textContent` e non `innerHTML`: nessun markup, nessuna interpolazione.
    script.textContent = JSON.stringify(data);
    head.appendChild(script);
  }

  // ───────────────────────────────────────────────────────────────────────────

  private normalizzaImmagine(image: SeoTags['image']): SeoImage {
    if (!image) return IMMAGINE_PREDEFINITA;
    if (typeof image === 'string') return image ? { url: image } : IMMAGINE_PREDEFINITA;
    return image.url ? image : IMMAGINE_PREDEFINITA;
  }

  private applicaImmagine(img: SeoImage): void {
    const url = this.absolute(img.url);

    this.setProperty('og:image', url);
    // `og:image:secure_url` è il campo che alcuni crawler preferiscono quando
    // la pagina è servita in HTTPS. Si scrive solo se l'URL è davvero https:
    // dichiarare come sicuro un indirizzo in chiaro farebbe saltare l'anteprima.
    if (url.startsWith('https://')) this.setProperty('og:image:secure_url', url);
    else this.meta.removeTag("property='og:image:secure_url'");

    if (img.mimeType) this.setProperty('og:image:type', img.mimeType);
    else this.meta.removeTag("property='og:image:type'");

    if (img.width && img.height) {
      this.setProperty('og:image:width', String(img.width));
      this.setProperty('og:image:height', String(img.height));
    } else {
      // Meglio assenti che sbagliate: vedi la nota su `SeoImage.width`.
      this.meta.removeTag("property='og:image:width'");
      this.meta.removeTag("property='og:image:height'");
    }

    const alt = img.alt?.trim();
    if (alt) {
      this.setProperty('og:image:alt', alt);
      this.setName('twitter:image:alt', alt);
    } else {
      this.meta.removeTag("property='og:image:alt'");
      this.meta.removeTag("name='twitter:image:alt'");
    }

    this.setName('twitter:image', url);
  }

  /** `it` → `it_IT`. Open Graph vuole la forma con il territorio. */
  private ogLocale(code: string | null | undefined): string {
    const mappa: Record<string, string> = {
      it: 'it_IT',
      en: 'en_GB',
      es: 'es_ES',
      fr: 'fr_FR',
      de: 'de_DE',
      pt: 'pt_PT',
    };
    return mappa[code ?? 'it'] ?? 'it_IT';
  }

  private setCanonical(url: string): void {
    const head = this.doc.head;
    if (!head) return;
    let link = head.querySelector("link[rel='canonical']") as HTMLLinkElement | null;
    if (!link) {
      link = this.doc.createElement('link');
      link.setAttribute('rel', 'canonical');
      head.appendChild(link);
    }
    link.setAttribute('href', url);
  }

  private setName(name: string, content: string): void {
    this.meta.updateTag({ name, content });
  }

  private setProperty(property: string, content: string): void {
    this.meta.updateTag({ property, content }, `property='${property}'`);
  }
}
