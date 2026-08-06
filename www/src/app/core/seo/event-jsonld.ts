import { EventAvailability, PublicEvent } from '../domain/models';
import { text } from '../format/format';

/**
 * Dati strutturati `schema.org/Event` (`RF-PUB-6`).
 *
 * Sono **resi lato server**: un motore di ricerca che non esegue JavaScript
 * deve trovarli nella sorgente. Gli importi, che nei dati sono centesimi interi
 * (§3.1), qui diventano il decimale che lo schema richiede.
 *
 * `offers` porta un'offerta per **titolo d'ingresso pubblico**, con la
 * disponibilità reale: `SoldOut` quando il motore di capienza lo dichiara
 * esaurito, `LimitedAvailability` quando un ruolo è in pausa — che non è
 * «esaurito» e non va dichiarato tale nemmeno a una macchina.
 */
export function buildEventJsonLd(
  event: PublicEvent,
  availability: EventAvailability | null,
  url: string,
): Record<string, unknown> {
  const images = [
    event.posterSquareFile?.url,
    event.posterHorizontalFile?.url,
    event.posterVerticalFile?.url,
  ].filter((u): u is string => !!u);

  const address = event.venue.address;

  const offers = event.ticketTypes
    .filter((tt) => tt.visibility === 'PUBLIC')
    .map((tt) => {
      const live = availability?.ticketTypes?.find((a) => a.id === tt.id) ?? null;
      const cents = live?.activeTier?.price ?? tt.basePrice;
      return {
        '@type': 'Offer',
        name: text(tt.name),
        url,
        price: (cents / 100).toFixed(2),
        priceCurrency: 'EUR',
        availability: live?.soldOut
          ? 'https://schema.org/SoldOut'
          : live?.roleOnHold
            ? 'https://schema.org/LimitedAvailability'
            : 'https://schema.org/InStock',
        ...(live?.activeTier?.expiresAt ? { priceValidUntil: live.activeTier.expiresAt } : {}),
        ...(tt.saleOpensAt ? { validFrom: tt.saleOpensAt } : {}),
      };
    });

  const performers = event.casts.map((c) => ({
    '@type': c.kind === 'ORCHESTRA' ? 'MusicGroup' : 'Person',
    name: c.artist.name,
    ...(c.artist.website ? { sameAs: c.artist.website } : {}),
  }));

  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: text(event.title),
    description: text(event.description).slice(0, 800),
    startDate: event.startAt,
    endDate: event.endAt,
    eventStatus: event.cancelledAt
      ? 'https://schema.org/EventCancelled'
      : 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    url,
    inLanguage: event.contentLanguage || 'it',
    ...(images.length ? { image: images } : {}),
    ...(event.tags?.length ? { keywords: event.tags.join(', ') } : {}),
    location: {
      '@type': 'Place',
      name: event.venue.name,
      ...(event.venue.latitude && event.venue.longitude
        ? {
            geo: {
              '@type': 'GeoCoordinates',
              latitude: event.venue.latitude,
              longitude: event.venue.longitude,
            },
          }
        : {}),
      address: {
        '@type': 'PostalAddress',
        ...(address?.address
          ? { streetAddress: [address.address, address.number].filter(Boolean).join(' ') }
          : {}),
        ...(address?.city ? { addressLocality: address.city } : {}),
        ...(address?.region ? { addressRegion: address.region } : {}),
        ...(address?.zipCode ? { postalCode: address.zipCode } : {}),
        addressCountry: address?.country === 'Italia' ? 'IT' : (address?.country ?? 'IT'),
      },
    },
    organizer: {
      '@type': 'Organization',
      name: event.organization.name,
      ...(event.organization.website ? { url: event.organization.website } : {}),
      ...(event.organization.contactEmail ? { email: event.organization.contactEmail } : {}),
    },
    ...(performers.length ? { performer: performers } : {}),
    ...(offers.length ? { offers } : {}),
  };
}
