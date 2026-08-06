import { ChangeDetectionStrategy, Component, OnDestroy, computed, effect, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { EventStore } from '../../stores/event.store';
import { SeoService } from '../../core/seo/seo.service';
import { buildEventJsonLd } from '../../core/seo/event-jsonld';
import { dateRange, resolveText, text } from '../../core/format/format';
import { I18nTextComponent } from '../../shared/i18n-text.component';
import { EventProgrammeComponent } from './event-programme.component';
import { EventCastComponent } from './event-cast.component';
import { EventTicketsComponent } from './event-tickets.component';
import { EventInfoComponent } from './event-info.component';

/**
 * `/eventi/:slug` — la scheda.
 *
 * Consuma `GET /api/public/events/:slug` (nel resolver, quindi **prima** della
 * serializzazione lato server) e `POST /api/public/events/:id/availability` con
 * **polling a 12 s** per i numeri vivi: il WebSocket richiede il `wsCode` del
 * profilo e il visitatore anonimo non ce l'ha (§3.9).
 *
 * SEO: titolo, meta description, Open Graph con la locandina, URL stabile e
 * `schema.org/Event` in JSON-LD, tutti resi dal server (`RF-PUB-6`).
 */
@Component({
  selector: 'app-event-detail',
  imports: [
    RouterLink,
    I18nTextComponent,
    EventProgrammeComponent,
    EventCastComponent,
    EventTicketsComponent,
    EventInfoComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (event(); as e) {
      <article>
        <header class="hero">
          @if (poster(); as src) {
            <div class="hero-bg" [style.background-image]="'url(' + src + ')'" aria-hidden="true"></div>
          }
          <div class="hero-inner www-wrap">
            @if (poster(); as src) {
              <img class="poster" [src]="src" [alt]="'Locandina di ' + title()" />
            }
            <div class="hero-text">
              <p class="kind"><app-i18n-text [value]="e.eventType.name" [showLanguage]="false" /></p>
              <h1 class="www-h1"><app-i18n-text [value]="e.title" /></h1>
              <p class="when">{{ when() }}</p>
              <p class="where">{{ where() }}</p>

              <div class="hero-chips">
                @if (soldOut()) {
                  <span class="www-chip www-chip-off">Iscrizioni esaurite</span>
                } @else {
                  <span class="www-chip www-chip-ok">Iscrizioni aperte</span>
                }
                @if (rolesNote(); as note) {
                  <span class="www-chip www-chip-accent">{{ note }}</span>
                }
                @if (e.secondLanguage) {
                  <span class="www-chip">contenuti in {{ langName(e.contentLanguage) }} e {{ langName(e.secondLanguage) }}</span>
                }
              </div>

              <p class="descr"><app-i18n-text [value]="e.description" /></p>

              <div class="hero-actions">
                <a class="www-btn" [routerLink]="['/eventi', e.slug, 'iscrizione']">Iscriviti</a>
                <a class="www-btn www-btn-secondary" href="#programma">Vedi il programma</a>
              </div>
            </div>
          </div>
        </header>

        <div class="www-wrap">
          <app-event-tickets
            [ticketTypes]="e.ticketTypes"
            [availability]="store.availability()"
            (choose)="goToCheckout(e.slug, $event)"
          />

          @if (e.sessions.length) {
            <app-event-programme [sessions]="e.sessions" />
          }

          @if (e.casts.length) {
            <app-event-cast [casts]="e.casts" />
          }

          <app-event-info [event]="e" />
        </div>
      </article>
    } @else {
      <div class="www-narrow">
        <h1 class="www-h1">Evento non trovato</h1>
        <p class="www-lead">
          Questo indirizzo non corrisponde a nessun evento pubblicato. Può essere stato ritirato
          dall’organizzatore, oppure il link è incompleto.
        </p>
        <p><a class="www-btn" routerLink="/eventi">Torna alla ricerca</a></p>
      </div>
    }
  `,
  styles: [
    `
      .hero {
        position: relative;
        overflow: hidden;
        border-bottom: 1px solid rgba(var(--text-rgb), 0.12);
      }
      .hero-bg {
        position: absolute;
        inset: 0;
        background-size: cover;
        background-position: center;
        filter: blur(28px) saturate(1.1);
        opacity: 0.28;
        transform: scale(1.15);
      }
      .hero-inner {
        position: relative;
        display: flex;
        gap: 2rem;
        align-items: flex-start;
        padding-top: 2.5rem;
        padding-bottom: 2.5rem;
      }
      .poster {
        width: 15rem;
        flex: none;
        border-radius: var(--www-radius);
        border: 1px solid rgba(var(--text-rgb), 0.18);
        box-shadow: var(--keijo-shadow-lg);
      }
      .hero-text {
        flex: 1;
        min-width: 0;
      }
      .kind {
        margin: 0;
        font-size: 0.8rem;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: rgb(var(--accent-rgb));
      }
      .when,
      .where {
        margin: 0.15rem 0 0;
        color: rgba(var(--text-rgb), 0.82);
      }
      .hero-chips {
        margin-top: 0.9rem;
        display: flex;
        flex-wrap: wrap;
        gap: 0.4rem;
      }
      .descr {
        margin-top: 1rem;
        color: rgba(var(--text-rgb), 0.82);
        line-height: 1.7;
        max-width: 46rem;
      }
      .hero-actions {
        margin-top: 1.25rem;
        display: flex;
        gap: 0.6rem;
        flex-wrap: wrap;
      }
      @media (max-width: 720px) {
        .hero-inner {
          flex-direction: column;
          gap: 1.25rem;
        }
        .poster {
          width: 11rem;
        }
      }
    `,
  ],
})
export class EventDetailPage implements OnDestroy {
  protected readonly store = inject(EventStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly seo = inject(SeoService);

  protected readonly event = this.store.current;

  protected readonly title = computed(() => text(this.event()?.title));

  protected readonly when = computed(() => {
    const e = this.event();
    return e ? dateRange(e.startAt, e.endAt) : '';
  });

  protected readonly where = computed(() => {
    const e = this.event();
    if (!e) return '';
    const a = e.venue.address;
    const place = [a?.city, a?.region].filter(Boolean).join(' · ');
    return [e.venue.name, place].filter(Boolean).join(' — ');
  });

  protected readonly poster = computed(
    () =>
      this.event()?.posterVerticalFile?.url ??
      this.event()?.posterHorizontalFile?.url ??
      this.event()?.posterSquareFile?.url ??
      null,
  );

  /** Esaurito solo se **ogni** titolo pubblico lo è: un titolo vivo basta. */
  protected readonly soldOut = computed(() => {
    const avail = this.store.availability();
    const publicTts = this.event()?.ticketTypes.filter((t) => t.visibility === 'PUBLIC') ?? [];
    if (!avail || publicTts.length === 0) return false;
    return publicTts.every((tt) => avail.ticketTypes.find((a) => a.id === tt.id)?.soldOut);
  });

  protected readonly rolesNote = computed(() => {
    const roles = this.store.availability()?.roles;
    if (!roles) return '';
    const bits: string[] = [];
    if (roles.leader !== null && roles.leader !== undefined) bits.push(`${roles.leader} posti leader`);
    if (roles.follower !== null && roles.follower !== undefined) {
      bits.push(`${roles.follower} posti follower`);
    }
    return bits.join(' · ');
  });

  constructor() {
    // Il resolver ha già caricato scheda e disponibilità: qui si scrivono i meta
    // **prima** che il server serializzi, e si avvia il polling nel solo browser.
    effect(() => {
      const e = this.event();
      if (!e) {
        this.seo.apply({
          title: 'Evento non trovato — Mirada Tango',
          description: 'Questo indirizzo non corrisponde a nessun evento pubblicato.',
          path: this.router.url,
        });
        this.seo.setJsonLd(null);
        return;
      }

      const path = `/eventi/${e.slug}`;
      const url = this.seo.absolute(path);
      const descr = resolveText(e.description);
      const where = [e.venue.address?.city, e.venue.address?.region].filter(Boolean).join(', ');

      this.seo.apply({
        title: `${text(e.title)} — ${where || e.venue.name} | Mirada Tango`,
        description: (descr.text || `${text(e.title)} a ${where}.`).replace(/\s+/g, ' ').slice(0, 300),
        path,
        image: e.posterSquareFile?.url ?? e.posterHorizontalFile?.url ?? e.posterVerticalFile?.url,
        type: 'event',
        locale: e.contentLanguage,
      });
      this.seo.setJsonLd(buildEventJsonLd(e, this.store.availability(), url));
    });

    const id = this.event()?.id;
    if (id) this.store.startPolling(id);
  }

  ngOnDestroy(): void {
    this.store.stopPolling();
  }

  protected goToCheckout(slug: string, ticketTypeId: number): void {
    void this.router.navigate(['/eventi', slug, 'iscrizione'], {
      queryParams: { titolo: ticketTypeId },
    });
  }

  protected langName(code: string | null | undefined): string {
    const map: Record<string, string> = { it: 'italiano', en: 'inglese', es: 'spagnolo' };
    return code ? (map[code] ?? code) : '';
  }
}
