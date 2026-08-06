import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { parseApiError } from './api-error';

/**
 * Interceptor del §5, nella versione pubblica.
 *
 *  1. Aggiunge `Authorization: Bearer <token>` — in `localStorage` il token è
 *     **grezzo**, il prefisso è aggiunto qui, in memoria.
 *  2. Su **`401` esegue il logout**: non esiste refresh token (§3.1). Qui non
 *     reindirizza a una pagina di login globale, perché `www` è anzitutto
 *     anonima: la pagina che ha chiesto l'operazione mostra il proprio invito
 *     ad accedere.
 *  3. Gli errori di dominio del §3.3 **non** diventano un toast: li presenta il
 *     componente che li sa distinguere — `SOLD_OUT` e `ROLE_ON_HOLD` dicono
 *     cose opposte.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const token = auth.token();

  const isApi = req.url.startsWith('/api') || req.url.includes('/api/');
  const authorized =
    token && isApi ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(authorized).pipe(
    catchError((raw: HttpErrorResponse) => {
      const err = parseApiError(raw);
      if (err.kind === 'unauthorized') auth.logout();
      return throwError(() => err);
    }),
  );
};
