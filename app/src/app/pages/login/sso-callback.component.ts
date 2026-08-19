import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  InfoBoxComponent,
  PageSectionWrapperComponent,
  PageWrapperComponent,
} from '@keijo/ui';
import { warning } from '@keijo/ui/icons';
import { ApiError } from '../../core/api/api-error';
import { OidcService } from '../../core/auth/oidc.service';

/**
 * `/auth/callback` — il ritorno da Authentik.
 *
 * Non è una pagina che si visita: ci si arriva dal fornitore di identità, con
 * `code` e `state` in coda all'indirizzo. Consegna il codice al backend e, se
 * tutto torna, riporta l'utente dov'era diretto.
 *
 * ⚠️ Questo percorso deve essere registrato **identico** fra gli URI di
 * reindirizzamento del provider su Authentik: la corrispondenza è stretta, e
 * uno slash finale di differenza produce un `400` prima ancora che la pagina
 * venga caricata.
 *
 * Mostra un errore invece di rimbalzare in silenzio: quando l'accesso non
 * riesce, la differenza fra «le credenziali non sono valide» e «non hai
 * un'utenza su questa piattaforma» è l'unica informazione utile che la persona
 * possa ricevere, e va detta.
 */
@Component({
  selector: 'app-sso-callback',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, PageWrapperComponent, PageSectionWrapperComponent, InfoBoxComponent],
  template: `
    <div class="login-viewport">
      <div class="login-card">
        <keijo-page-wrapper>
          <keijo-page-section-wrapper title="Accesso in corso">
            @if (failure(); as msg) {
              <keijo-info-box [icon]="warningIcon" title="Accesso non riuscito" variant="error">
                <span>{{ msg }}</span>
              </keijo-info-box>
              <p class="mirada-hint">
                <a routerLink="/login">Torna alla pagina di accesso</a>
              </p>
            } @else {
              <p class="mirada-hint">Un istante: stiamo verificando la tua identità.</p>
            }
          </keijo-page-section-wrapper>
        </keijo-page-wrapper>
      </div>
    </div>
  `,
  styles: [
    `
      .login-viewport {
        position: relative;
        z-index: 1;
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1.5rem 1rem;
      }
      .login-card {
        width: 100%;
        max-width: 26rem;
      }
    `,
  ],
})
export class SsoCallbackComponent implements OnInit {
  private readonly oidc = inject(OidcService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly warningIcon = warning;
  readonly failure = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    const params = this.route.snapshot.queryParamMap;

    // Authentik risponde con `error` quando l'utente annulla o quando la
    // richiesta è malformata: qui non c'è alcun codice da scambiare.
    const rifiuto = params.get('error');
    if (rifiuto) {
      this.failure.set(
        rifiuto === 'access_denied'
          ? 'Hai annullato l’accesso.'
          : `Il fornitore di identità ha rifiutato la richiesta (${rifiuto}).`,
      );
      return;
    }

    const code = params.get('code');
    const state = params.get('state');
    if (!code || !state) {
      this.failure.set('Questo indirizzo non porta un accesso valido.');
      return;
    }

    try {
      const target = await this.oidc.complete(code, state);
      await this.router.navigateByUrl(target);
    } catch (err) {
      if (err instanceof ApiError) {
        // `forbidden` è il caso che vale la pena distinguere: l'identità è
        // buona, manca l'utenza su mirada. Il messaggio del backend dice già
        // cosa fare — chiedere a un amministratore — e ripeterlo con parole
        // nostre lo peggiorerebbe.
        this.failure.set(
          err.kind === 'unauthorized'
            ? 'Il fornitore di identità non ha confermato l’accesso. Riprova.'
            : err.message,
        );
      } else {
        this.failure.set((err as Error).message || 'Errore imprevisto durante l’accesso.');
      }
    }
  }
}
