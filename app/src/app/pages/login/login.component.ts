import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  ButtonComponent,
  FormRowComponent,
  FormWrapperComponent,
  InfoBoxComponent,
  InputComponent,
  PageSectionWrapperComponent,
  PageWrapperComponent,
} from '@keijo/ui';
import { login as loginIcon, shield, warning } from '@keijo/ui/icons';
import { ApiError } from '../../core/api/api-error';
import { AuthService } from '../../core/auth/auth.service';
import { OidcService } from '../../core/auth/oidc.service';
import { landingFor } from '../../shell/sidebar-routes';
import { applyZodIssues, clearServerErrors, controlError } from '../../shared/form-errors';

/**
 * Accesso all'applicazione `app`.
 *
 * `POST /api/auth/login` body `{ usernameOrEmail, password }` → `{ token }`
 * (§3.1). Il token finisce in `localStorage` alla chiave `Authorization`,
 * **grezzo**: il prefisso `Bearer ` lo aggiunge l'interceptor in memoria.
 *
 * È un form **non-entity**: la CTA di invio sta in fondo al form-wrapper,
 * allineata a destra (`KEIJO-FORM-SUBMIT-BOTTOM-RIGHT`). Qui non c'è header di
 * pagina: la rotta è fuori dalla shell.
 */
@Component({
  selector: 'app-login',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    PageWrapperComponent,
    PageSectionWrapperComponent,
    FormWrapperComponent,
    FormRowComponent,
    InputComponent,
    ButtonComponent,
    InfoBoxComponent,
  ],
  template: `
    <div class="login-viewport">
      <div class="login-card">
        <keijo-page-wrapper>
          <keijo-page-section-wrapper title="Mirada Tango">
            <p class="mirada-hint">
              Accedi con le credenziali della tua organizzazione. Se sei un ballerino, la tua
              area è il sito pubblico: questa applicazione è riservata a chi organizza.
            </p>
            @if (oidc.config()?.enabled) {
              <p class="mirada-hint">
                Non hai ancora un’organizzazione? Accedi lo stesso: te la apri in un minuto.
              </p>
            }

            @if (failure()) {
              <keijo-info-box
                [icon]="warningIcon"
                title="Accesso non riuscito"
                variant="error"
              >
                <span>{{ failure() }}</span>
              </keijo-info-box>
            }

            @if (oidc.config()?.enabled) {
              <div class="sso-row">
                <keijo-button
                  [icon]="ssoIcon"
                  label="Accedi con Authentik"
                  variant="default"
                  [loading]="ssoStarting()"
                  (action)="accediConIdp()"
                />
              </div>
              @if (mostraForm()) {
                <p class="sso-separatore"><span>oppure</span></p>
              }
            }

            @if (!mostraForm() && !oidc.config()?.enabled) {
              <!--
                Porta chiusa E fornitore irraggiungibile: non resta nulla da
                mostrare, e la cosa peggiore sarebbe tacerlo. Il rientro esiste
                ma passa dal server — è scritto nel manuale di Authentik — e chi
                è davanti a questa pagina deve almeno sapere che non è colpa sua.
              -->
              <keijo-info-box
                [icon]="warningIcon"
                title="Nessun accesso disponibile"
                variant="error"
              >
                <span>
                  L’accesso con nome utente e password è disattivato e il fornitore di identità
                  non risponde. Serve un intervento sul server: contatta chi lo conduce.
                </span>
              </keijo-info-box>
            }

            @if (mostraForm()) {
            <keijo-form-wrapper [formGroup]="form">
              <keijo-form-row [cols]="1">
                <keijo-input
                  [formControl]="form.controls.usernameOrEmail"
                  label="nome utente o email"
                  id="usernameOrEmail"
                  type="text"
                  autocomplete="username"
                />
              </keijo-form-row>
              @if (error(form.controls.usernameOrEmail); as msg) {
                <p class="mirada-error">{{ msg }}</p>
              }

              <keijo-form-row [cols]="1">
                <keijo-input
                  [formControl]="form.controls.password"
                  label="password"
                  id="password"
                  type="password"
                  autocomplete="current-password"
                />
              </keijo-form-row>
              @if (error(form.controls.password); as msg) {
                <p class="mirada-error">{{ msg }}</p>
              }

              <div class="submit-row">
                <keijo-button
                  [icon]="loginIcon"
                  label="Accedi"
                  variant="accent"
                  [loading]="auth.loading()"
                  [disabled]="form.invalid"
                  (action)="submit()"
                />
              </div>
            </keijo-form-wrapper>

            @if (oidc.config()?.passwordLogin === 'god-only') {
              <p class="mirada-hint">
                L’accesso con nome utente e password è riservato all’amministratore di
                piattaforma: per tutti gli altri la strada è il tasto qui sopra.
              </p>
            }
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
      .submit-row {
        display: flex;
        justify-content: flex-end;
        margin-top: 0.5rem;
      }
      .sso-row {
        display: flex;
        margin-bottom: 1rem;
      }
      .sso-row > * {
        flex: 1;
      }
      /* Separatore con la parola al centro: una riga sola, tagliata dal testo. */
      .sso-separatore {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        margin: 0 0 1rem;
        font-size: 0.8rem;
        opacity: 0.6;
      }
      .sso-separatore::before,
      .sso-separatore::after {
        content: '';
        flex: 1;
        height: 1px;
        background: currentColor;
        opacity: 0.35;
      }
    `,
  ],
})
export class LoginComponent implements OnInit {
  readonly auth = inject(AuthService);
  readonly oidc = inject(OidcService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly loginIcon = loginIcon;
  readonly warningIcon = warning;
  readonly ssoIcon = shield;
  readonly failure = signal<string | null>(null);
  readonly ssoStarting = signal(false);

  /**
   * Il form si mostra finché la porta non è chiusa del tutto.
   *
   * Finché la configurazione non è arrivata (`null`) si mostra: è la pagina di
   * sempre, e farla comparire a scatti dopo una chiamata di rete sarebbe
   * peggio. `god-only` lo lascia visibile perché quella porta, per qualcuno,
   * è ancora aperta — e chi non è quel qualcuno legge la nota sotto.
   */
  readonly mostraForm = computed(() => this.oidc.config()?.passwordLogin !== 'off');

  readonly form = new FormGroup({
    usernameOrEmail: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  ngOnInit(): void {
    if (this.auth.isAuthenticated()) {
      void this.router.navigateByUrl(this.redirectTarget());
      return;
    }
    // Non si attende: il form con utente e password è già utilizzabile, e il
    // tasto del fornitore compare quando la risposta arriva. `loadConfig` non
    // solleva mai — un fornitore spento o irraggiungibile lascia questa pagina
    // esattamente com'era prima dell'SSO.
    void this.oidc.loadConfig();
  }

  async accediConIdp(): Promise<void> {
    this.failure.set(null);
    this.ssoStarting.set(true);
    try {
      // Non ritorna: la pagina viene abbandonata per andare dal fornitore.
      await this.oidc.start(this.route.snapshot.queryParamMap.get('redirect'));
    } catch (err) {
      this.ssoStarting.set(false);
      this.failure.set((err as Error).message);
    }
  }

  error(control: FormControl<string>): string | null {
    return controlError(control);
  }

  async submit(): Promise<void> {
    this.form.markAllAsTouched();
    clearServerErrors(this.form);
    this.failure.set(null);
    if (this.form.invalid) return;

    const { usernameOrEmail, password } = this.form.getRawValue();
    try {
      await this.auth.login(usernameOrEmail, password);
      await this.router.navigateByUrl(this.redirectTarget());
    } catch (err) {
      const unmatched = applyZodIssues(this.form, err);
      if (unmatched.length) {
        this.failure.set(unmatched.join(' '));
      } else if (err instanceof ApiError && err.kind === 'unauthorized') {
        this.failure.set('Nome utente o password non corretti.');
      } else if (err instanceof ApiError && err.kind === 'validation') {
        this.failure.set('Controlla i campi evidenziati.');
      } else if (err instanceof ApiError) {
        this.failure.set(err.message);
      } else {
        this.failure.set('Errore imprevisto durante l’accesso.');
      }
    }
  }

  private redirectTarget(): string {
    const redirect = this.route.snapshot.queryParamMap.get('redirect');
    // Non `/events`: chi gestisce la piattaforma non ce l'ha e rimbalzerebbe.
    return redirect && !redirect.startsWith('/login') ? redirect : landingFor(this.auth.can());
  }
}
