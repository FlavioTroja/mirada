import { inject } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  CanActivateFn,
  Router,
  RouterStateSnapshot,
  UrlTree,
} from '@angular/router';
import { AuthService } from './auth.service';
import { Capabilities } from './roles';

/**
 * Verifica della sessione. Le dipendenze si iniettano **prima di qualunque
 * `await`**: dopo il primo `await` il contesto di iniezione di Angular non
 * esiste più, e un `inject()` lì dentro fallisce con `NG0203`.
 */
async function ensureSession(
  auth: AuthService,
  router: Router,
  state: RouterStateSnapshot,
): Promise<boolean | UrlTree> {
  const toLogin = () =>
    router.createUrlTree(['/login'], { queryParams: { redirect: state.url } });

  if (!auth.isAuthenticated()) return toLogin();
  if (!auth.profile()) {
    await auth.restore();
    if (!auth.isAuthenticated()) return toLogin();
  }
  return true;
}

/** Blocca le rotte dell'applicazione a chi non ha una sessione. */
export const authGuard: CanActivateFn = (
  _route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot,
): Promise<boolean | UrlTree> => ensureSession(inject(AuthService), inject(Router), state);

/**
 * Gating per ruolo (§1). Una rotta non permessa non è raggiungibile nemmeno a
 * mano: la voce di sidebar non compare e l'URL diretto rimbalza.
 */
export function requireCapability(capability: keyof Capabilities): CanActivateFn {
  return async (
    _route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot,
  ): Promise<boolean | UrlTree> => {
    const auth = inject(AuthService);
    const router = inject(Router);

    const allowed = await ensureSession(auth, router, state);
    if (allowed !== true) return allowed;

    return auth.can()[capability] ? true : router.createUrlTree(['/events']);
  };
}
