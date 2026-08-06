import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
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
import { login as loginIcon, warning } from '@keijo/ui/icons';
import { ApiError } from '../../core/api/api-error';
import { AuthService } from '../../core/auth/auth.service';
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

            @if (failure()) {
              <keijo-info-box
                [icon]="warningIcon"
                title="Accesso non riuscito"
                variant="error"
              >
                <span>{{ failure() }}</span>
              </keijo-info-box>
            }

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
    `,
  ],
})
export class LoginComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly loginIcon = loginIcon;
  readonly warningIcon = warning;
  readonly failure = signal<string | null>(null);

  readonly form = new FormGroup({
    usernameOrEmail: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  ngOnInit(): void {
    if (this.auth.isAuthenticated()) void this.router.navigateByUrl(this.redirectTarget());
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
