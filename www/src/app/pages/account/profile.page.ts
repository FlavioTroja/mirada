import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { DancerProfileService } from '../../core/auth/dancer-profile.service';
import { ThemeService, ThemeChoice } from '../../core/theme/theme.service';
import { SeoService } from '../../core/seo/seo.service';
import { ApiError } from '../../core/api/api-error';
import { PreferredDanceRole } from '../../core/domain/models';
import { AvatarComponent } from '../../shared/avatar.component';
import { MyRegistrationsService } from '../../core/auth/my-registrations.service';
import { MyEventsComponent } from './my-events.component';

/** Le lingue che si dichiarano in milonga. L'elenco è corto di proposito. */
const LANGUAGES: { code: string; label: string }[] = [
  { code: 'it', label: 'Italiano' },
  { code: 'en', label: 'Inglese' },
  { code: 'es', label: 'Spagnolo' },
  { code: 'fr', label: 'Francese' },
  { code: 'de', label: 'Tedesco' },
  { code: 'pt', label: 'Portoghese' },
];

const ROLES: { value: PreferredDanceRole; label: string; hint: string }[] = [
  { value: 'LEADER', label: 'Leader', hint: 'Guidi' },
  { value: 'FOLLOWER', label: 'Follower', hint: 'Segui' },
  { value: 'BOTH', label: 'Entrambi', hint: 'Balli tutti e due i ruoli' },
];

/**
 * `/profilo` — **il proprio account**, dal punto di vista di chi balla.
 *
 * ── Perché esiste ────────────────────────────────────────────────────────────
 * Fino a ieri chi entrava sul sito pubblico vedeva soltanto il proprio nome
 * scritto in testata, accanto a due tasti — tema e uscita — che non erano suoi:
 * erano comandi del sito messi lì per mancanza di un posto migliore. Questo è
 * il posto migliore. Qui la persona si riconosce, mette la propria fotografia,
 * dice come vuole essere chiamata in milonga e trova le impostazioni che la
 * riguardano.
 *
 * ── Cosa si modifica e cosa no ───────────────────────────────────────────────
 * Nome, cognome e indirizzo email si vedono ma non si toccano. Non è una
 * dimenticanza: sono l'anagrafica con cui viene emesso il biglietto, e alla
 * porta devono corrispondere a un documento. Il ballerino non ha alcun permesso
 * su `PERSON` — il server rifiuterebbe la modifica — e un campo che sembra
 * scrivibile e poi non salva è peggio di un campo dichiaratamente fermo.
 * L'indirizzo, in più, è dove arriva il QR d'ingresso: cambiarlo senza
 * riconfermarlo lascerebbe un biglietto pagato che non raggiunge nessuno.
 *
 * ── SSR ──────────────────────────────────────────────────────────────────────
 * La sessione vive in `localStorage` e sul server non esiste: questa pagina, in
 * prima resa, non sa ancora chi sei. Il rinvio a `/accedi` avviene quindi nel
 * browser, non nella resa lato server, e finché non si sa nulla si mostra
 * un'attesa invece di sbattere fuori chi è regolarmente entrato.
 */
@Component({
  selector: 'app-profile-page',
  imports: [FormsModule, AvatarComponent, MyEventsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="www-narrow">
      @if (!auth.isAuthenticated()) {
        <p class="www-muted">Un momento…</p>
      } @else {
        <header class="hero">
          <app-avatar
            size="5rem"
            [src]="avatarUrl()"
            [initials]="auth.initials() || '?'"
          />
          <div class="who">
            <h1 class="www-h1">{{ auth.displayName() || 'Il tuo profilo' }}</h1>
            <p class="www-muted">{{ email() }}</p>
            @if (profiles.profile(); as p) {
              <span class="www-chip www-chip-accent">&#64;{{ p.nickname }}</span>
            }
          </div>
        </header>

        <!-- ── I tuoi eventi ───────────────────────────────────────────── -->
        @if (mine.failed()) {
          <div class="www-notice www-notice-warn">
            <strong>Le tue iscrizioni non sono arrivate</strong>
            Ricarica la pagina fra poco: il resto del profilo funziona lo stesso.
          </div>
        } @else if (mine.loading() && !mine.loaded()) {
          <p class="www-muted">Cerco le tue iscrizioni…</p>
        } @else if (mine.loaded()) {
          <app-my-events
            title="I tuoi prossimi eventi"
            emptyLabel="Non sei iscritto a nessun evento in programma. Quando ti iscrivi, il biglietto compare qui."
            [rows]="mine.upcoming()"
          />
          @if (mine.past().length) {
            <app-my-events
              title="Ci sei stato"
              emptyLabel=""
              [rows]="mine.past()"
              [past]="true"
            />
          }
        }

        <!-- ── Ritratto ────────────────────────────────────────────────── -->
        <section class="www-panel">
          <h2 class="www-h2">La tua fotografia</h2>
          <p class="www-hint">
            Compare accanto al tuo nome. Vale solo per te: non è la fotografia di un documento e
            nessuno la controlla all’ingresso.
          </p>

          <div class="photo-row">
            <app-avatar size="4rem" [src]="avatarUrl()" [initials]="auth.initials() || '?'" />
            <div class="photo-actions">
              <label class="www-btn www-btn-secondary file-btn">
                {{ avatarUrl() ? 'Cambia fotografia' : 'Scegli una fotografia' }}
                <input
                  type="file"
                  accept="image/*"
                  (change)="onFileChosen($event)"
                  [disabled]="profiles.saving()"
                />
              </label>
              <span class="www-hint">JPEG o PNG, fino a qualche megabyte.</span>
            </div>
          </div>

          @if (photoError(); as msg) {
            <div class="www-notice www-notice-error">
              <strong>La fotografia non è stata caricata</strong>
              {{ msg }}
            </div>
          } @else if (photoDone()) {
            <div class="www-notice www-notice-ok">
              <strong>Fotografia aggiornata</strong>
              La vedrai accanto al tuo nome su tutto il sito.
            </div>
          } @else if (profiles.pendingAvatarUrl()) {
            <div class="www-notice www-notice-info">
              <strong>Fotografia pronta</strong>
              Scegli un nickname qui sotto e salva: la collego al tuo profilo.
            </div>
          }
        </section>

        <!-- ── Come balli ──────────────────────────────────────────────── -->
        <section class="www-panel">
          <h2 class="www-h2">Come balli</h2>
          <p class="www-hint">
            Serve agli organizzatori per l’equilibrio dei ruoli in sala e a te per ritrovarti negli
            elenchi. Solo il nickname è obbligatorio.
          </p>

          <div class="www-field">
            <label class="www-label" for="nickname">Nickname</label>
            <input
              id="nickname"
              class="www-input"
              type="text"
              autocomplete="nickname"
              placeholder="come.ti.chiamano"
              [(ngModel)]="nickname"
              [disabled]="profiles.saving()"
            />
            <span class="www-hint">
              Da 3 a 24 caratteri: lettere, numeri, punto, trattino e underscore. È unico su
              Mirada.
            </span>
          </div>

          <fieldset class="roles">
            <legend class="www-label">Ruolo che preferisci</legend>
            @for (r of roles; track r.value) {
              <label class="role" [class.on]="preferredRole() === r.value">
                <input
                  type="radio"
                  name="preferredRole"
                  [value]="r.value"
                  [checked]="preferredRole() === r.value"
                  (change)="preferredRole.set(r.value)"
                />
                <span class="role-label">{{ r.label }}</span>
                <span class="www-hint">{{ r.hint }}</span>
              </label>
            }
          </fieldset>

          <div class="two">
            <div class="www-field">
              <label class="www-label" for="city">Città</label>
              <input
                id="city"
                class="www-input"
                type="text"
                placeholder="Da dove vieni"
                [(ngModel)]="city"
                [disabled]="profiles.saving()"
              />
            </div>
            <div class="www-field">
              <label class="www-label" for="level">Livello che dichiari</label>
              <input
                id="level"
                class="www-input"
                type="text"
                placeholder="Principiante, intermedio, avanzato…"
                [(ngModel)]="declaredLevel"
                [disabled]="profiles.saving()"
              />
            </div>
          </div>

          <div class="www-field">
            <label class="www-label" for="birthDate">Data di nascita</label>
            <input
              id="birthDate"
              class="www-input"
              type="date"
              [(ngModel)]="birthDate"
              [disabled]="profiles.saving()"
            />
            <span class="www-hint">
              Alcuni eventi hanno un’età minima: averla qui evita di doverla ridichiarare a ogni
              iscrizione.
            </span>
          </div>

          <fieldset class="languages">
            <legend class="www-label">Lingue che parli</legend>
            @for (l of languages; track l.code) {
              <label class="lang" [class.on]="hasLanguage(l.code)">
                <input
                  type="checkbox"
                  [checked]="hasLanguage(l.code)"
                  (change)="toggleLanguage(l.code)"
                />
                {{ l.label }}
              </label>
            }
          </fieldset>

          @if (saveError(); as msg) {
            <div class="www-notice www-notice-error">
              <strong>Non è stato salvato</strong>
              {{ msg }}
            </div>
          } @else if (saveDone()) {
            <div class="www-notice www-notice-ok">
              <strong>Salvato</strong>
              Il tuo profilo è aggiornato.
            </div>
          }

          <div class="actions">
            <button
              type="button"
              class="www-btn"
              [disabled]="profiles.saving() || !nickname().trim()"
              (click)="save()"
            >
              {{ profiles.saving() ? 'Salvo…' : 'Salva' }}
            </button>
          </div>
        </section>

        <!-- ── Anagrafica, in sola lettura ─────────────────────────────── -->
        <section class="www-panel">
          <h2 class="www-h2">I tuoi dati</h2>
          <dl class="facts">
            <div>
              <dt class="www-label">Nome e cognome</dt>
              <dd>{{ auth.displayName() }}</dd>
            </div>
            <div>
              <dt class="www-label">Email</dt>
              <dd>{{ email() }}</dd>
            </div>
          </dl>
          <p class="www-hint">
            Questi non si cambiano da qui. Sono l’anagrafica con cui viene emesso il biglietto — al
            controllo all’ingresso deve corrispondere a un documento — e l’indirizzo è dove arriva
            il QR d’accesso. Se c’è un errore, scrivi a
            <a href="mailto:info&#64;mirada.dance">info&#64;mirada.dance</a>.
          </p>
        </section>

        <!-- ── Impostazioni ───────────────────────────────────────────── -->
        <section class="www-panel">
          <h2 class="www-h2">Impostazioni</h2>

          <fieldset class="themes">
            <legend class="www-label">Aspetto del sito</legend>
            @for (t of themes; track t.value) {
              <label class="theme" [class.on]="theme.choice() === t.value">
                <input
                  type="radio"
                  name="theme"
                  [value]="t.value"
                  [checked]="theme.choice() === t.value"
                  (change)="theme.set(t.value)"
                />
                <span class="theme-mark" aria-hidden="true">{{ t.mark }}</span>
                <span>{{ t.label }}</span>
              </label>
            }
          </fieldset>

          <div class="actions">
            <button type="button" class="www-btn www-btn-secondary" (click)="logout()">
              Esci dall’account
            </button>
          </div>
        </section>
      }
    </div>
  `,
  styles: [
    `
      .hero {
        display: flex;
        align-items: center;
        gap: 1rem;
        margin-bottom: 1.5rem;
      }
      .hero .www-h1 {
        margin: 0;
      }
      .who {
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
        align-items: flex-start;
      }
      .www-panel + .www-panel {
        margin-top: 1rem;
      }
      .www-panel > .www-h2 {
        margin-top: 0;
      }
      .photo-row {
        display: flex;
        align-items: center;
        gap: 1rem;
        margin: 0.75rem 0;
      }
      .photo-actions {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
      }
      /* Il campo file di serie non si può ridisegnare: si nasconde dentro
         l'etichetta, che è già un'area cliccabile e resta raggiungibile da
         tastiera perché è il campo stesso a ricevere il fuoco. */
      .file-btn {
        position: relative;
        overflow: hidden;
        display: inline-flex;
        align-items: center;
        cursor: pointer;
      }
      .file-btn input[type='file'] {
        position: absolute;
        inset: 0;
        opacity: 0;
        cursor: pointer;
      }
      .www-field + .www-field,
      .www-field + fieldset,
      fieldset + .www-field,
      fieldset + fieldset,
      fieldset + .two,
      .two + .www-field,
      .two + fieldset,
      .www-field + .two {
        margin-top: 1rem;
      }
      .two {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1rem;
      }
      /* Dentro la griglia i due campi sono fratelli adiacenti, e la regola di
         spaziatura qui sopra spingeva giù la colonna di destra di un rem: due
         campi affiancati che non partivano dalla stessa riga. */
      .two .www-field + .www-field {
        margin-top: 0;
      }
      fieldset {
        border: 0;
        padding: 0;
        margin: 1rem 0 0;
      }
      fieldset legend {
        padding: 0;
        margin-bottom: 0.5rem;
      }
      .roles,
      .themes {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
      }
      .role,
      .theme {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        border: 1px solid rgba(var(--text-rgb), 0.28);
        border-radius: var(--www-radius-sm);
        padding: 0.5rem 0.75rem;
        cursor: pointer;
      }
      .role .www-hint,
      .theme span {
        margin: 0;
      }
      .role.on,
      .theme.on,
      .lang.on {
        border-color: rgb(var(--accent-rgb));
        color: rgb(var(--accent-rgb));
      }
      .role input,
      .theme input,
      .lang input {
        /* Il pallino di serie resta, ma disegnato dal browser: quello che
           comunica lo stato è il bordo, che si vede anche da lontano. */
        accent-color: rgb(var(--accent-rgb));
      }
      .role-label {
        font-weight: 600;
      }
      .languages {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
      }
      .lang {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        border: 1px solid rgba(var(--text-rgb), 0.28);
        border-radius: 999px;
        padding: 0.35rem 0.75rem;
        cursor: pointer;
        font-size: 0.9rem;
      }
      .actions {
        margin-top: 1rem;
        display: flex;
        gap: 0.75rem;
        flex-wrap: wrap;
      }
      .facts {
        margin: 0.5rem 0 0.75rem;
        display: grid;
        gap: 0.75rem;
      }
      .facts dd {
        margin: 0.15rem 0 0;
        color: rgb(var(--text-rgb));
      }
      .www-notice {
        margin-top: 1rem;
      }
      @media (max-width: 640px) {
        .two {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class ProfilePage {
  private readonly router = inject(Router);
  private readonly seo = inject(SeoService);
  protected readonly auth = inject(AuthService);
  protected readonly profiles = inject(DancerProfileService);
  protected readonly mine = inject(MyRegistrationsService);
  protected readonly theme = inject(ThemeService);

  protected readonly roles = ROLES;
  protected readonly languages = LANGUAGES;
  protected readonly themes: { value: ThemeChoice; label: string; mark: string }[] = [
    { value: 'dark', label: 'Scuro', mark: '☾' },
    { value: 'light', label: 'Chiaro', mark: '☀' },
    { value: 'auto', label: 'Come il sistema', mark: '◐' },
  ];

  protected readonly nickname = signal('');
  protected readonly preferredRole = signal<PreferredDanceRole>('BOTH');
  protected readonly city = signal('');
  protected readonly declaredLevel = signal('');
  protected readonly birthDate = signal('');
  protected readonly langs = signal<string[]>([]);

  protected readonly saveError = signal<string | null>(null);
  protected readonly saveDone = signal(false);
  protected readonly photoError = signal<string | null>(null);
  protected readonly photoDone = signal(false);

  protected readonly email = computed(
    () => this.auth.user()?.person?.contact?.email ?? '',
  );

  /**
   * Il ritratto: quello salvato, oppure quello appena scelto da chi non ha
   * ancora un profilo. Mostrare subito la fotografia caricata è ciò che rende
   * credibile il messaggio «scegli un nickname e la collego».
   */
  protected readonly avatarUrl = computed(
    () => this.profiles.pendingAvatarUrl() ?? this.auth.avatarUrl(),
  );

  private prefilled = false;
  /** Vera solo fra il clic su «esci» e la navigazione che ne consegue. */
  private readonly leaving = signal(false);

  constructor() {
    this.seo.apply({
      title: 'Il tuo profilo — Mirada Tango',
      description: 'Il tuo account su Mirada Tango: fotografia, nickname, preferenze.',
      path: '/profilo',
      // Pagina privata: non deve finire in un indice. È l'unica ragione per cui
      // questo campo esiste.
      noIndex: true,
    });
    this.seo.setJsonLd(null);

    effect(() => {
      // Chi esce di proposito non va rimandato al modulo d'accesso: sta
      // andando via, non è stato buttato fuori. Senza questa guardia il
      // rinvio qui sotto vincerebbe la corsa contro la navigazione di
      // `logout()`, e premere «esci» finirebbe su «accedi».
      if (this.leaving()) return;
      // Sul server non si sa chi sei — `localStorage` non c'è — quindi questo
      // effetto vale nel browser, dove il token è già stato letto.
      if (this.auth.isAuthenticated()) return;
      if (typeof window === 'undefined') return;
      void this.router.navigate(['/accedi'], { queryParams: { ritorno: '/profilo' } });
    });

    effect(() => {
      if (!this.auth.isAuthenticated()) return;
      if (!this.auth.user()) void this.auth.loadProfile();
      // Le iscrizioni si leggono una volta sola per visita: `loaded` resta vero
      // fino all'uscita, che è ciò che svuota il servizio.
      if (!this.mine.loaded() && !this.mine.loading() && !this.mine.failed()) void this.mine.load();
      if (!this.profiles.profile() && !this.profiles.loading() && !this.profiles.missing()) {
        void this.profiles.load();
      }
    });

    effect(() => {
      const p = this.profiles.profile();
      // Si riempie **una volta sola**: ricopiare i valori a ogni cambio del
      // signal cancellerebbe sotto le dita ciò che si sta scrivendo.
      if (!p || this.prefilled) return;
      this.prefilled = true;
      this.nickname.set(p.nickname);
      this.preferredRole.set(p.preferredRole);
      this.city.set(p.city ?? '');
      this.declaredLevel.set(p.declaredLevel ?? '');
      this.birthDate.set(p.birthDate ? p.birthDate.slice(0, 10) : '');
      this.langs.set([...(p.languages ?? [])]);
    });

    effect(() => {
      // Un nickname di partenza per chi arriva la prima volta: lo username è
      // già suo e rispetta il formato richiesto, quindi non c'è niente da
      // inventare per poter salvare.
      if (!this.profiles.missing() || this.nickname()) return;
      const username = this.auth.user()?.username;
      if (username) this.nickname.set(username.slice(0, 24));
    });
  }

  protected hasLanguage(code: string): boolean {
    return this.langs().includes(code);
  }

  protected toggleLanguage(code: string): void {
    this.langs.update((current) =>
      current.includes(code) ? current.filter((c) => c !== code) : [...current, code],
    );
  }

  protected async onFileChosen(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.photoError.set(null);
    this.photoDone.set(false);
    try {
      await this.profiles.uploadAvatar(file);
      this.photoDone.set(!!this.profiles.profile()?.avatarFileId);
    } catch (err) {
      this.photoError.set(message(err));
    } finally {
      // Senza questo, riscegliere lo **stesso** file non emetterebbe alcun
      // evento e il tentativo dopo un errore sembrerebbe ignorato.
      input.value = '';
    }
  }

  protected async save(): Promise<void> {
    this.saveError.set(null);
    this.saveDone.set(false);
    try {
      await this.profiles.save({
        nickname: this.nickname(),
        preferredRole: this.preferredRole(),
        city: this.city(),
        declaredLevel: this.declaredLevel(),
        languages: this.langs(),
        birthDate: this.birthDate() || null,
      });
      await this.profiles.attachPendingAvatar();
      this.saveDone.set(true);
    } catch (err) {
      this.saveError.set(message(err));
    }
  }

  protected logout(): void {
    this.leaving.set(true);
    this.auth.logout();
    void this.router.navigateByUrl('/eventi');
  }
}

/** Il messaggio del server quando c'è: dice perché, e questo è il punto. */
function message(err: unknown): string {
  if (err instanceof ApiError) {
    return err.message || 'Riprova fra poco.';
  }
  return 'Riprova fra poco.';
}
