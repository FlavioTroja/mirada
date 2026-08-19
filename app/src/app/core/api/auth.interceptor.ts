import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { ToastService } from '../../services/toast.service';
import { parseApiError } from './api-error';
import { DomainErrorBus } from './domain-error';

/**
 * Interceptor del §5.
 *
 *  1. Aggiunge `Authorization: Bearer <token>` — il token in `localStorage` è
 *     **grezzo**, il prefisso è aggiunto qui, in memoria.
 *  2. Su **`401` esegue il logout e reindirizza al login**: non esiste refresh token.
 *  3. Riconosce i `code` di dominio del §3.3 e li **instrada al componente** che li
 *     sa presentare (`DomainErrorBus`), invece di mostrare un toast generico.
 *  4. Gli errori di validazione (`ZodError`) arrivano al chiamante con le `issues`
 *     intatte, perché il form possa mapparle su `issues[].path`.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const domainErrors = inject(DomainErrorBus);
  const toast = inject(ToastService);

  // Le rotte che SERVONO ad aprire una sessione non ne hanno una da perdere:
  // un tentativo di accesso rifiutato è «credenziali sbagliate», non «la tua
  // sessione è scaduta». Trattarlo come il secondo caso porta via dalla pagina
  // — e sulla rotta di ritorno da Authentik porterebbe via proprio mentre sta
  // per spiegare cosa non ha funzionato.
  const tentativoDiAccesso =
    req.url.startsWith('/api/auth/login') || req.url.startsWith('/api/auth/sso');

  const token = auth.token();
  const authorized =
    token && req.url.startsWith('/api')
      ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
      : req;

  return next(authorized).pipe(
    catchError((raw: HttpErrorResponse) => {
      const err = parseApiError(raw);

      switch (err.kind) {
        case 'unauthorized':
          // Nessun refresh token: il 401 è un logout (§3.1). Ma solo se una
          // sessione c'era: vedi `tentativoDiAccesso` sopra.
          if (!tentativoDiAccesso) {
            auth.logout();
            void router.navigate(['/login'], {
              queryParams: { redirect: router.url !== '/login' ? router.url : null },
            });
          }
          break;

        case 'domain':
          // Mai un toast: lo presenta il componente competente (§5).
          domainErrors.publish(err);
          break;

        case 'validation':
          // Le issue vanno sui campi del form: nessun toast, il form le mostra.
          break;

        case 'constraint':
          // Un vincolo di dominio non è un guasto: si annuncia come regola, con
          // il messaggio del backend, e la pagina lo ripete accanto al campo
          // che lo ha incontrato.
          toast.show('WARNING', err.message);
          break;

        case 'not-implemented':
          // `501 con il motivo` (§3.7): lo presenta la pagina che l'ha chiesto,
          // mai un toast d'errore e mai un tracciato vuoto.
          break;

        case 'network':
          toast.show('ERROR', err.message);
          break;

        case 'forbidden':
        case 'not-found':
        case 'server':
          toast.show('ERROR', err.message);
          break;
      }

      return throwError(() => err);
    }),
  );
};
