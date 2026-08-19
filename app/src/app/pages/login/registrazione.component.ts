import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  ButtonComponent,
  FormRowComponent,
  FormWrapperComponent,
  InfoBoxComponent,
  InputComponent,
  PageSectionWrapperComponent,
  PageWrapperComponent,
} from '@keijo/ui';
import { domain, groups, warning } from '@keijo/ui/icons';
import { ApiError } from '../../core/api/api-error';
import { AuthService } from '../../core/auth/auth.service';
import { OidcService } from '../../core/auth/oidc.service';
import { controlError } from '../../shared/form-errors';

/**
 * `/registrazione` — il primo accesso di chi su mirada non c'era ancora.
 *
 * Ci si arriva in due modi, e la pagina si comporta di conseguenza:
 *
 *  - **da un link d'invito** (`?invito=…`): non c'è nulla da compilare, si
 *    conferma di voler entrare nell'organizzazione che ti ha chiamato;
 *  - **da sé**: si apre un'organizzazione nuova, e si chiede il **minimo** —
 *    il nome. Ragione sociale, forma giuridica e partita IVA si chiedono prima
 *    di pubblicare, che è quando servono davvero: pretenderle qui vorrebbe dire
 *    chiedere la visura a qualcuno che sta ancora decidendo se la piattaforma
 *    gli piace.
 *
 * ⚠️ Chi arriva col solo `?invito=` **non è ancora autenticato**: la pagina lo
 * manda dal fornitore di identità portandosi dietro il gettone, e ci torna dopo.
 */
@Component({
  selector: 'app-registrazione',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    RouterLink,
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
          @if (registrazione(); as reg) {
            <keijo-page-section-wrapper
              [title]="reg.invito ? 'Accetta l’invito' : 'Apri la tua organizzazione'"
            >
              @if (failure(); as msg) {
                <keijo-info-box [icon]="warningIcon" title="Non ha funzionato" variant="error">
                  <span>{{ msg }}</span>
                </keijo-info-box>
              }

              @if (reg.invito; as invito) {
                <keijo-info-box [icon]="membriIcon" [title]="invito.organizzazione" variant="info">
                  <span>
                    Sei stato invitato a entrare in <strong>{{ invito.organizzazione }}</strong> come
                    titolare. Potrai creare eventi, seguire le iscrizioni e vedere gli incassi.
                  </span>
                </keijo-info-box>
                <p class="mirada-hint">
                  Stai accedendo come {{ reg.email }}. Confermando entri in un’organizzazione che
                  esiste già: non ne verrà creata una nuova.
                </p>
                <div class="submit-row">
                  <keijo-button
                    [icon]="orgIcon"
                    label="Entra in {{ invito.organizzazione }}"
                    variant="accent"
                    [loading]="working()"
                    (action)="accetta()"
                  />
                </div>
              } @else {
                <p class="mirada-hint">
                  Ti serve solo il nome. Ragione sociale, forma giuridica e partita IVA te le
                  chiederemo prima di pubblicare il primo evento — non prima.
                </p>

                <keijo-form-wrapper [formGroup]="form">
                  <keijo-form-row [cols]="1">
                    <keijo-input
                      [formControl]="form.controls.nome"
                      label="nome dell’organizzazione"
                      id="nome"
                      type="text"
                    />
                  </keijo-form-row>
                  @if (error(form.controls.nome); as msg) {
                    <p class="mirada-error">{{ msg }}</p>
                  }

                  <keijo-form-row [cols]="1">
                    <keijo-input
                      [formControl]="form.controls.emailContatto"
                      label="email di contatto (facoltativa)"
                      id="emailContatto"
                      type="email"
                    />
                  </keijo-form-row>
                  <p class="mirada-hint">
                    Se la lasci vuota useremo {{ reg.email }}, l’indirizzo con cui hai appena
                    effettuato l’accesso.
                  </p>

                  <div class="submit-row">
                    <keijo-button
                      [icon]="orgIcon"
                      label="Apri l’organizzazione"
                      variant="accent"
                      [loading]="working()"
                      [disabled]="form.invalid"
                      (action)="apri()"
                    />
                  </div>
                </keijo-form-wrapper>

                <p class="mirada-hint">
                  L’organizzazione nasce in attesa di approvazione: potrai costruire i tuoi eventi
                  subito, e metterli in vendita quando la piattaforma l’avrà approvata.
                </p>
              }
            </keijo-page-section-wrapper>
          } @else {
            <keijo-page-section-wrapper title="Registrazione">
              @if (failure(); as msg) {
                <keijo-info-box [icon]="warningIcon" title="Non ha funzionato" variant="error">
                  <span>{{ msg }}</span>
                </keijo-info-box>
                <p class="mirada-hint"><a routerLink="/login">Torna alla pagina di accesso</a></p>
              } @else {
                <p class="mirada-hint">Un istante…</p>
              }
            </keijo-page-section-wrapper>
          }
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
        max-width: 30rem;
      }
      .submit-row {
        display: flex;
        justify-content: flex-end;
        margin-top: 0.75rem;
      }
    `,
  ],
})
export class RegistrazioneComponent implements OnInit {
  private readonly oidc = inject(OidcService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly warningIcon = warning;
  readonly orgIcon = domain;
  readonly membriIcon = groups;

  readonly registrazione = this.oidc.registrazione;
  readonly failure = signal<string | null>(null);
  readonly working = signal(false);

  readonly form = new FormGroup({
    nome: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(2)],
    }),
    emailContatto: new FormControl('', { nonNullable: true, validators: [Validators.email] }),
  });

  async ngOnInit(): Promise<void> {
    if (this.auth.isAuthenticated()) {
      await this.router.navigateByUrl('/');
      return;
    }

    if (this.registrazione()) return;

    // Nessuna registrazione in corso: o si arriva dal link di un invito — e
    // allora si parte per il fornitore di identità portandoselo dietro — oppure
    // la pagina è stata ricaricata e il filo si è perso.
    const invito = this.route.snapshot.queryParamMap.get('invito');
    if (invito) {
      try {
        await this.oidc.start('/registrazione', invito);
      } catch (err) {
        this.failure.set((err as Error).message);
      }
      return;
    }

    this.failure.set(
      'La registrazione non risulta iniziata, o la pagina è stata ricaricata. Rifai l’accesso: non hai perso nulla.',
    );
  }

  error(control: FormControl<string>): string | null {
    return controlError(control);
  }

  async apri(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const { nome, emailContatto } = this.form.getRawValue();
    await this.concludi(() => this.oidc.apriOrganizzazione({ nome, emailContatto }));
  }

  async accetta(): Promise<void> {
    await this.concludi(() => this.oidc.accettaInvito());
  }

  private async concludi(azione: () => Promise<void>): Promise<void> {
    this.failure.set(null);
    this.working.set(true);
    try {
      await azione();
      await this.router.navigateByUrl('/');
    } catch (err) {
      this.failure.set(
        err instanceof ApiError ? err.message : ((err as Error).message ?? 'Errore imprevisto.'),
      );
    } finally {
      this.working.set(false);
    }
  }
}
