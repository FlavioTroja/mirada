import { ApiError, DomainErrorCode } from './api-error';

/**
 * Presentazione **pubblica** degli errori di dominio del §3.3.
 *
 * I codici hanno significati opposti e il ballerino deve capirlo dalla prima
 * riga (`RF-PAY-17`):
 *
 *  - `SOLD_OUT` è **definitivo** — «Posti follower esauriti»: non c'è nulla da
 *    aspettare, e la pagina propone i titoli alternativi;
 *  - `ROLE_ON_HOLD` è **temporaneo e sbloccabile** — le iscrizioni leader sono
 *    sospese in attesa di follower, e si riaprono da sole o subito iscrivendosi
 *    in coppia;
 *  - `RESERVATION_ALREADY_ACTIVE` non dice «esaurito» né «errore»: dice che hai
 *    già un ordine in corso su questo evento;
 *  - `PARTIAL_AVAILABILITY` chiede **una conferma esplicita**, non è un rifiuto.
 */

export interface PublicDomainError {
  code: DomainErrorCode;
  title: string;
  detail: string;
  /** `error` = definitivo · `warning` = reversibile · `info` = informativo. */
  tone: 'error' | 'warning' | 'info';
  /** `true` quando la situazione può sbloccarsi da sé: il testo non dice mai «esaurito». */
  temporary: boolean;
  /** Ciò che la pagina può proporre di fare. */
  action?: 'CHOOSE_ANOTHER' | 'COUPLE' | 'RESUME_ORDER' | 'CONFIRM_PARTIAL' | 'BACK_TO_CART';
}

const ROLE_IT: Record<string, string> = { LEADER: 'leader', FOLLOWER: 'follower' };

function role(err: ApiError): string {
  const r = err.scope?.role;
  return r ? (ROLE_IT[r] ?? r.toLowerCase()) : '';
}

function opposite(err: ApiError): string {
  return err.scope?.role === 'LEADER' ? 'follower' : 'leader';
}

function where(err: ApiError): string {
  return err.scope?.scopeLabel ? ` — ${err.scope.scopeLabel}` : '';
}

export function describePublicDomainError(err: ApiError): PublicDomainError | null {
  if (!err.isDomain || !err.code) return null;
  const r = role(err);
  const w = where(err);

  switch (err.code) {
    case 'SOLD_OUT':
      return {
        code: err.code,
        title: r ? `Posti ${r} esauriti${w}` : `Posti esauriti${w}`,
        detail:
          'Il limite di capienza è stato raggiunto: la situazione è definitiva, non si sblocca ' +
          'con l’attesa. Puoi scegliere un altro titolo d’ingresso fra quelli ancora disponibili.',
        tone: 'error',
        temporary: false,
        action: 'CHOOSE_ANOTHER',
      };

    case 'ROLE_ON_HOLD':
      return {
        code: err.code,
        title: r
          ? `Iscrizioni ${r} momentaneamente sospese${w}`
          : `Iscrizioni momentaneamente sospese${w}`,
        detail:
          'Non è un esaurimento: l’organizzatore tiene in equilibrio leader e follower, e il ' +
          `ruolo è in pausa in attesa di ${r ? opposite(err) : 'ballerini dell’altro ruolo'}. ` +
          'Si riapre appena l’equilibrio si ricompone — oppure subito, iscrivendoti in coppia.',
        tone: 'warning',
        temporary: true,
        action: 'COUPLE',
      };

    case 'PARTIAL_AVAILABILITY':
      return {
        code: err.code,
        title: 'Alcuni servizi accessori non sono più disponibili',
        detail:
          'Il titolo d’ingresso resta disponibile: sono esaurite solo le quote di alcuni servizi ' +
          'accessori. Puoi togliere quelle righe e confermare il resto, oppure annullare.',
        tone: 'warning',
        temporary: true,
        action: 'CONFIRM_PARTIAL',
      };

    case 'RESERVATION_EXPIRED':
      return {
        code: err.code,
        title: 'Prenotazione scaduta',
        detail:
          'I quindici minuti sono trascorsi e i posti sono tornati disponibili per tutti. ' +
          'Nessun addebito è stato effettuato. Puoi ricominciare: se i posti ci sono ancora, ' +
          'la prenotazione riparte da capo.',
        tone: 'warning',
        temporary: true,
        action: 'BACK_TO_CART',
      };

    case 'RESERVATION_ALREADY_ACTIVE':
      return {
        code: err.code,
        title: 'Hai già una prenotazione in corso su questo evento',
        detail:
          'È ammessa una sola prenotazione attiva per persona su ciascun evento. Concludi quella ' +
          'aperta oppure lasciala scadere — o rilasciala — prima di aprirne un’altra.',
        tone: 'info',
        temporary: true,
        action: 'RESUME_ORDER',
      };

    case 'SALES_CLOSED':
      return {
        code: err.code,
        title: 'Iscrizioni chiuse',
        detail:
          'L’evento non accetta più iscrizioni online. Per informazioni puoi scrivere ' +
          'direttamente all’organizzatore.',
        tone: 'info',
        temporary: false,
      };

    case 'PAYOUT_NOT_ENABLED':
      return {
        code: err.code,
        title: 'Iscrizioni online non ancora attive',
        detail:
          'L’organizzatore non ha ancora completato l’abilitazione all’incasso. Le iscrizioni ' +
          'apriranno appena sarà attiva.',
        tone: 'info',
        temporary: true,
      };

    // ── Identità ─────────────────────────────────────────────────────────────
    // Questi tre hanno un'interfaccia dedicata nel passo dell'account, con il
    // tasto che porta all'azione giusta. I testi qui sotto sono la rete di
    // sicurezza per quando affiorano altrove: nessuno è un guasto, tutti e tre
    // hanno una via d'uscita, e per questo il tono non è mai `error`.

    case 'EMAIL_ALREADY_REGISTERED':
      return {
        code: err.code,
        title: 'Questo indirizzo ha già un account',
        detail:
          'Non serve registrarsi di nuovo: accedi con le tue credenziali e prosegui con ' +
          'l’iscrizione all’evento.',
        tone: 'info',
        temporary: false,
      };

    case 'USERNAME_TAKEN':
      return {
        code: err.code,
        title: 'Nome utente già occupato',
        detail: 'Qualcun altro lo sta usando. Scegline un altro: il resto dei dati resta com’è.',
        tone: 'warning',
        temporary: false,
      };

    case 'EMAIL_NOT_CONFIRMED':
      return {
        code: err.code,
        title: 'Devi ancora confermare il tuo indirizzo',
        detail:
          'Ti abbiamo mandato un’email con un tasto di conferma: finché non lo premi l’account ' +
          'non può prenotare un posto. Se non l’hai ricevuta puoi fartela rimandare.',
        tone: 'warning',
        temporary: true,
      };
  }
}

/** Testo pronto per un riquadro d'errore, di dominio o no. */
export function describeError(err: unknown): PublicDomainError {
  if (err instanceof ApiError) {
    const domain = describePublicDomainError(err);
    if (domain) return domain;
    return {
      code: 'SOLD_OUT' as DomainErrorCode,
      title:
        err.kind === 'validation'
          ? 'Alcuni dati non sono validi'
          : err.kind === 'network'
            ? 'Server non raggiungibile'
            : 'Operazione non riuscita',
      detail: err.message,
      tone: 'error',
      temporary: err.kind === 'network',
    };
  }
  return {
    code: 'SOLD_OUT' as DomainErrorCode,
    title: 'Operazione non riuscita',
    detail: 'Si è verificato un errore imprevisto. Riprova.',
    tone: 'error',
    temporary: false,
  };
}
