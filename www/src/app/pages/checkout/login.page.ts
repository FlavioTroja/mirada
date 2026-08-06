import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AccountStepComponent } from './account-step.component';
import { SeoService } from '../../core/seo/seo.service';
import { AuthService } from '../../core/auth/auth.service';

/**
 * `/accedi` — accesso o registrazione fuori dal percorso di iscrizione.
 *
 * Non è una pagina indicizzabile e non porta dati strutturati: è il percorso
 * privato del ballerino. L'esito si osserva sul signal dell'autenticazione, non
 * su un output del componente figlio: l'accesso riuscito lo distrugge prima che
 * possa emettere.
 */
@Component({
  selector: 'app-login-page',
  imports: [AccountStepComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="www-narrow">
      <h1 class="www-h1">Il tuo account</h1>
      <p class="www-lead">
        Serve per iscriversi a un evento e per ritrovare i biglietti con il QR di accesso.
      </p>
      @if (auth.isAuthenticated()) {
        <div class="www-notice www-notice-ok">
          <strong>Sei entrato</strong>
          Ti stiamo riportando dove eri.
        </div>
      } @else {
        <app-account-step />
      }
    </div>
  `,
})
export class LoginPage {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly seo = inject(SeoService);
  protected readonly auth = inject(AuthService);

  constructor() {
    this.seo.apply({
      title: 'Accedi — Mirada Tango',
      description: 'Accedi o crea il tuo account per iscriverti agli eventi di tango.',
      path: '/accedi',
    });
    this.seo.setJsonLd(null);

    effect(() => {
      if (!this.auth.isAuthenticated()) return;
      const back = this.route.snapshot.queryParamMap.get('ritorno');
      void this.router.navigateByUrl(back || '/eventi');
    });
  }
}
