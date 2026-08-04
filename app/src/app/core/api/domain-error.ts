import { Injectable, computed, signal } from '@angular/core';
import { KeijoIconShape } from '@keijo/ui';
import { block, handshake, lock, payments, schedule, warning } from '@keijo/ui/icons';
import { ApiError, DomainErrorCode } from './api-error';

/**
 * Presentazione degli errori di dominio del §3.3.
 *
 * `SOLD_OUT` e `ROLE_ON_HOLD` hanno significati **opposti** e non vanno mai
 * confusi (`RF-PAY-17`):
 *
 *  - `SOLD_OUT`     — limite assoluto raggiunto, situazione **definitiva**.
 *  - `ROLE_ON_HOLD` — blocco **temporaneo** per sbilancio, **può sbloccarsi**.
 *
 * Nessun toast generico: questi errori vengono instradati al componente che li
 * sa presentare (info-box in pagina), con la sessione e il ruolo nominati.
 */

export interface DomainErrorView {
  code: DomainErrorCode;
  /** Titolo dell'info-box. */
  title: string;
  /** Corpo esteso: dice se la situazione è definitiva o reversibile. */
  detail: string;
  variant: 'error' | 'warning' | 'info';
  icon: KeijoIconShape;
  /** `true` solo per gli stati reversibili: la formulazione non deve dire «esaurito». */
  temporary: boolean;
}

const ROLE_LABEL: Record<string, string> = {
  LEADER: 'leader',
  FOLLOWER: 'follower',
};

function roleOf(err: ApiError): string {
  const role = err.scope?.role;
  return role ? ROLE_LABEL[role] ?? role.toLowerCase() : '';
}

function whereOf(err: ApiError): string {
  const label = err.scope?.scopeLabel;
  return label ? ` — ${label}` : '';
}

/**
 * Costruisce la vista dell'errore di dominio. Il testo dipende dal `code`,
 * e per i due codici di capienza nomina il ruolo e la sessione (`RF-PAY-16`).
 */
export function describeDomainError(err: ApiError): DomainErrorView | null {
  if (!err.isDomain || !err.code) return null;
  const role = roleOf(err);
  const where = whereOf(err);

  switch (err.code) {
    case 'SOLD_OUT':
      return {
        code: err.code,
        title: role ? `Posti ${role} esauriti${where}` : `Posti esauriti${where}`,
        detail:
          'Il limite di capienza è stato raggiunto: la situazione è definitiva. ' +
          'Per accettare altre iscrizioni occorre aumentare la quota di capienza.',
        variant: 'error',
        icon: block,
        temporary: false,
      };

    case 'ROLE_ON_HOLD':
      return {
        code: err.code,
        title: role
          ? `Iscrizioni ${role} momentaneamente sospese${where}`
          : `Iscrizioni momentaneamente sospese${where}`,
        detail:
          'Non è un esaurimento: il cancello di tolleranza sullo sbilancio dei ruoli è ' +
          (role ? `chiuso in attesa di ${role === 'leader' ? 'follower' : 'leader'}. ` : 'chiuso. ') +
          'Si riapre appena il ruolo opposto recupera, oppure subito con un’iscrizione in coppia.',
        variant: 'warning',
        icon: handshake,
        temporary: true,
      };

    case 'PARTIAL_AVAILABILITY':
      return {
        code: err.code,
        title: 'Alcuni servizi accessori non sono più disponibili',
        detail:
          'Le quote dei soli servizi accessori sono esaurite. Puoi rimuovere le righe ' +
          'interessate e confermare, oppure annullare l’operazione.',
        variant: 'warning',
        icon: warning,
        temporary: true,
      };

    case 'RESERVATION_EXPIRED':
      return {
        code: err.code,
        title: 'Prenotazione scaduta',
        detail:
          'I quindici minuti di impegno della capienza sono trascorsi e i posti sono ' +
          'tornati disponibili. Nessun addebito è stato effettuato.',
        variant: 'warning',
        icon: schedule,
        temporary: true,
      };

    case 'RESERVATION_ALREADY_ACTIVE':
      return {
        code: err.code,
        title: 'Una prenotazione è già attiva',
        detail:
          'Esiste già una prenotazione aperta per questa persona su questo evento. ' +
          'Va conclusa o rilasciata prima di aprirne un’altra.',
        variant: 'info',
        icon: schedule,
        temporary: true,
      };

    case 'SALES_CLOSED':
      return {
        code: err.code,
        title: 'Vendite chiuse',
        detail:
          'L’evento non è più in vendita online. I biglietti già emessi restano validi: ' +
          'per riaprire, usa «Riapri vendite» sulla scheda dell’evento.',
        variant: 'info',
        icon: lock,
        temporary: true,
      };

    case 'PAYOUT_NOT_ENABLED':
      return {
        code: err.code,
        title: 'Organizzazione non abilitata all’incasso',
        detail:
          'La pubblicazione richiede un’organizzazione approvata e abilitata all’incasso ' +
          'presso il prestatore di pagamento. I biglietti già emessi restano validi e i ' +
          'rimborsi restano eseguibili: manca solo l’abilitazione a incassare.',
        variant: 'error',
        icon: payments,
        temporary: true,
      };
  }
}

/**
 * Canale degli errori di dominio: l'interceptor li pubblica qui invece di
 * mostrarli in un toast generico; il componente competente li legge e li
 * presenta in pagina. Signals — pattern di stato del progetto (`AGENTS.md`).
 */
@Injectable({ providedIn: 'root' })
export class DomainErrorBus {
  private readonly _last = signal<ApiError | null>(null);

  readonly last = this._last.asReadonly();
  readonly view = computed<DomainErrorView | null>(() => {
    const err = this._last();
    return err ? describeDomainError(err) : null;
  });

  publish(err: ApiError): void {
    if (err.isDomain) this._last.set(err);
  }

  clear(): void {
    this._last.set(null);
  }
}
