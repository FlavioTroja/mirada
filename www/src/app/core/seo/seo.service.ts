import { DOCUMENT, Injectable, REQUEST, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';

/**
 * SEO — **la ragione per cui questa applicazione esiste** (`RF-PUB-6`).
 *
 * Titolo, meta description, Open Graph con la locandina, URL stabile e dati
 * strutturati `schema.org/Event` in JSON-LD, tutti scritti **prima** che la
 * pagina venga serializzata: un crawler che non esegue JavaScript deve trovarli
 * nella sorgente, non dopo l'idratazione.
 *
 * Il servizio scrive nel `<head>` tramite `DOCUMENT`, che sul server è il
 * documento in corso di resa: non tocca mai `window`.
 */

const JSON_LD_ID = 'mirada-jsonld';

export interface SeoTags {
  title: string;
  description: string;
  /** Percorso assoluto dell'applicazione, es. `/eventi/…`: diventa URL stabile. */
  path: string;
  image?: string | null;
  type?: 'website' | 'article' | 'event';
  /** Lingua del contenuto, se diversa dall'italiano. */
  locale?: string;
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
    const image = tags.image ? this.absolute(tags.image) : null;

    this.title.setTitle(tags.title);
    this.setName('description', tags.description);

    this.setProperty('og:title', tags.title);
    this.setProperty('og:description', tags.description);
    this.setProperty('og:type', tags.type === 'event' ? 'article' : (tags.type ?? 'website'));
    this.setProperty('og:url', url);
    this.setProperty('og:site_name', 'Mirada Tango');
    this.setProperty('og:locale', tags.locale === 'en' ? 'en_GB' : 'it_IT');
    if (image) {
      this.setProperty('og:image', image);
      this.setName('twitter:card', 'summary_large_image');
      this.setName('twitter:image', image);
    } else {
      this.meta.removeTag("property='og:image'");
      this.setName('twitter:card', 'summary');
    }
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
