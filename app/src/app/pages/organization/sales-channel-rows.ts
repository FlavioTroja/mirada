import { SalesChannelDepositCode, SalesChannelMapping } from '../../core/domain/models';

/**
 * Le due collezioni possedute da un canale di vendita si scrivono in una riga
 * compatta, come gli scaglioni di rimborso (`refund-tiers.ts`) — e per la stessa
 * ragione: sono poche voci, si dettano al telefono, e un editor a righe per
 * quattro valori costa più di quanto renda.
 *
 * Qui vivono la conversione nei due sensi e i controlli. Il contratto del
 * backend è quello del `PUT` con l'array intero: `id: -1` = riga nuova,
 * `toBeDisconnected: true` = riga rimossa.
 */

export const MAPPINGS_PLACEHOLDER = '8391827/0 : 12 x2, 9920011 : 0';
export const DEPOSIT_CODES_PLACEHOLDER = 'ACCONTO_30 = Acconto 30%, ACCONTO_50 = Acconto 50%';

/** Riga del `PUT`, nella forma che `splitLinkableEntities` si aspetta. */
type Row<T> = Partial<T> & { id: number; toBeDisconnected?: boolean };

/**
 * `prodotto[/variante] : titolo [xposti]`.
 *
 * `titolo` è `0` quando l'articolo **non è un biglietto**: è un valore, non
 * un'assenza, ed è ciò che tiene fuori dalla quarantena l'ordine misto.
 */
export function mappingsToText(mappings: SalesChannelMapping[] | null | undefined): string {
  if (!Array.isArray(mappings) || !mappings.length) return '';
  return mappings
    .map((mapping) => {
      const product = mapping.externalVariantId
        ? `${mapping.externalProductId}/${mapping.externalVariantId}`
        : mapping.externalProductId;
      const seats = mapping.seatsPerUnit > 1 ? ` x${mapping.seatsPerUnit}` : '';
      return `${product} : ${mapping.ticketTypeId ?? 0}${seats}`;
    })
    .join(', ');
}

export function parseMappings(
  text: string,
  existing: SalesChannelMapping[] | null | undefined,
): Row<SalesChannelMapping>[] {
  const rows: Row<SalesChannelMapping>[] = [];
  const seen = new Set<string>();
  const previous = new Map(
    (existing ?? []).map((mapping) => [
      `${mapping.externalProductId}/${mapping.externalVariantId}`,
      mapping,
    ]),
  );

  for (const chunk of splitRows(text)) {
    const [rawProduct, rawTarget] = chunk.split(':').map((part) => part.trim());
    if (!rawProduct || rawTarget === undefined) {
      throw new Error(`«${chunk}» non è una riga valida: serve «prodotto : titolo».`);
    }

    const [externalProductId, externalVariantId = ''] = rawProduct.split('/').map((p) => p.trim());
    const match = /^(-?\d+)(?:\s*x\s*(\d+))?$/i.exec(rawTarget);
    if (!externalProductId || !match) {
      throw new Error(
        `«${chunk}» non è una riga valida: il titolo è un numero, e i posti si scrivono «x2».`,
      );
    }

    const ticketTypeId = Number(match[1]);
    const seatsPerUnit = match[2] ? Number(match[2]) : 1;
    if (ticketTypeId < 0 || seatsPerUnit < 1) {
      throw new Error(`«${chunk}» non è una riga valida: numeri negativi o zero posti.`);
    }

    const key = `${externalProductId}/${externalVariantId}`;
    if (seen.has(key)) {
      // Due righe sullo stesso prodotto renderebbero la risoluzione casuale, ed
      // è precisamente il difetto che il vincolo di unicità del database esiste
      // per impedire: meglio dirlo qui, con il nome del prodotto in mano.
      throw new Error(`Il prodotto «${key}» compare due volte: ogni prodotto ha una riga sola.`);
    }
    seen.add(key);

    rows.push({
      id: previous.get(key)?.id ?? -1,
      externalProductId,
      externalVariantId,
      // `0` significa «non è un biglietto»: si traduce nel `null` del contratto.
      ticketTypeId: ticketTypeId === 0 ? null : ticketTypeId,
      seatsPerUnit,
    });
  }

  return [...rows, ...removedRows(previous, seen)];
}

/** `CODICE = etichetta`. La normalizzazione la fa il server (`RF-SAL-2`). */
export function depositCodesToText(codes: SalesChannelDepositCode[] | null | undefined): string {
  if (!Array.isArray(codes) || !codes.length) return '';
  return codes.map((code) => `${code.code} = ${code.label}`).join(', ');
}

export function parseDepositCodes(
  text: string,
  existing: SalesChannelDepositCode[] | null | undefined,
): Row<SalesChannelDepositCode>[] {
  const rows: Row<SalesChannelDepositCode>[] = [];
  const seen = new Set<string>();
  const previous = new Map((existing ?? []).map((code) => [normalize(code.code), code]));

  for (const chunk of splitRows(text)) {
    const [rawCode, ...rest] = chunk.split('=');
    const code = normalize(rawCode ?? '');
    const label = rest.join('=').trim() || rawCode?.trim() || '';

    if (!code) {
      throw new Error(`«${chunk}» non è un codice valido: il codice non può essere vuoto.`);
    }
    if (seen.has(code)) {
      throw new Error(`Il codice «${code}» compare due volte: i codici sono distinti.`);
    }
    seen.add(code);

    rows.push({ id: previous.get(code)?.id ?? -1, code, label });
  }

  return [...rows, ...removedRows(previous, seen)];
}

/**
 * Ciò che c'era e non c'è più: righe di rimozione esplicite.
 *
 * Il `PUT` porta **lo stato desiderato**, quindi una riga cancellata dal testo
 * deve tornare indietro marcata `toBeDisconnected` — altrimenti resterebbe
 * viva in banca dati e continuerebbe a tradurre prodotti, o a marcare come
 * acconto un codice che l'organizzatore credeva di aver tolto.
 */
function removedRows<T extends { id: number }>(
  previous: Map<string, T>,
  seen: Set<string>,
): Row<T>[] {
  const removed: Row<T>[] = [];
  for (const [key, row] of previous) {
    if (!seen.has(key)) {
      removed.push({ id: row.id, toBeDisconnected: true } as Row<T>);
    }
  }
  return removed;
}

function splitRows(text: string): string[] {
  return text
    .split(/[,\n]/)
    .map((chunk) => chunk.trim())
    .filter(Boolean);
}

function normalize(code: string): string {
  return code.replace(/\s+/g, '').toUpperCase();
}
