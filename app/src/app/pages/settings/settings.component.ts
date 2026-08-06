// keijo-ui: scaffolded — do not remove this marker if you intend to re-run ng add
import { ChangeDetectionStrategy, Component, OnInit, computed, inject } from '@angular/core';
import {
  PageSectionWrapperComponent,
  PageWrapperComponent,
  PillComponent,
  SectionActionButton,
} from '@keijo/ui';
import { badge, contrast, darkMode, language, lightMode, logout as logoutIcon, translate } from '@keijo/ui/icons';
import { Router } from '@angular/router';
import { HeaderTitleService } from '../../services/header-title.service';
import { AuthService } from '../../core/auth/auth.service';
import { LocaleService, UI_LANG_LABEL } from '../../core/i18n/i18n-text';
import { ORG_MEMBER_ROLE_LABEL } from '../../core/auth/roles';
import { ThemeChoice, ThemeService } from '../../core/theme/theme.service';

/**
 * Preferenze utente — **fuori dalla sidebar** (`KEIJO-SIDEBAR-NO-SETTINGS`):
 * ci si arriva dal menu utente in fondo alla sidebar.
 *
 * Qui vive la scelta della lingua dell'interfaccia (IT + EN dal giorno uno, §5)
 * e la chiusura della sessione.
 */
@Component({
  selector: 'app-settings',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageWrapperComponent, PageSectionWrapperComponent, PillComponent],
  // The page title lives in the header (HeaderTitleService) — no <keijo-page-title>
  // in the body (KEIJO-NO-DUPLICATE-PAGE-TITLE).
  template: `
    <keijo-page-wrapper>
      <keijo-page-section-wrapper title="Profilo">
        <div class="grid">
          <div>
            <p class="mirada-label">Utente</p>
            <p class="mirada-value">{{ auth.displayName() }}</p>
          </div>
          <div>
            <p class="mirada-label">Ruoli</p>
            <div class="pills">
              @for (role of roleLabels(); track role) {
                <keijo-pill variant="default" [icon]="badgeIcon">{{ role }}</keijo-pill>
              } @empty {
                <span class="mirada-muted">Nessun ruolo attivo</span>
              }
            </div>
          </div>
        </div>
      </keijo-page-section-wrapper>

      <keijo-page-section-wrapper
        title="Lingua dell’interfaccia"
        [buttons]="languageButtons()"
        (buttonClick)="onLanguage($event)"
      >
        <p class="mirada-hint">
          L’interfaccia è disponibile in italiano e in inglese. I testi scritti dagli
          organizzatori restano nella lingua in cui sono stati inseriti: quando la traduzione
          manca, il testo compare comunque, con l’indicazione della lingua.
        </p>
        <p class="mirada-value">Attualmente: {{ currentLanguage() }}</p>
      </keijo-page-section-wrapper>

      <keijo-page-section-wrapper
        title="Aspetto"
        [buttons]="themeButtons()"
        (buttonClick)="onTheme($event)"
      >
        <p class="mirada-hint">
          Il tema scuro è quello di Mirada, ereditato dalla proiezione in sala: là non è
          una scelta estetica ma di sicurezza, perché un maxischermo chiaro abbaglia chi
          balla al buio. Il tema chiaro serve al back-office, che si usa di giorno e
          spesso su schermi non calibrati.
        </p>
        <p class="mirada-value">
          Attualmente: {{ themeLabel() }}
          @if (theme.choice() === 'auto') {
            <span class="mirada-muted"> — segue l’impostazione del sistema</span>
          }
        </p>
      </keijo-page-section-wrapper>

      <keijo-page-section-wrapper
        title="Sessione"
        [buttons]="sessionButtons"
        (buttonClick)="onLogout()"
      >
        <p class="mirada-hint">
          Non esiste un token di rinnovo: alla scadenza la sessione si chiude e viene
          richiesto un nuovo accesso.
        </p>
      </keijo-page-section-wrapper>
    </keijo-page-wrapper>
  `,
  styles: [
    `
      .grid {
        display: grid;
        gap: 1rem;
        grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
      }
      .pills {
        display: flex;
        flex-wrap: wrap;
        gap: 0.375rem;
      }
    `,
  ],
})
export class SettingsComponent implements OnInit {
  private readonly headerTitle = inject(HeaderTitleService);
  private readonly router = inject(Router);
  readonly auth = inject(AuthService);
  readonly locale = inject(LocaleService);
  readonly theme = inject(ThemeService);

  readonly badgeIcon = badge;

  readonly roleLabels = computed(() =>
    this.auth.roles().map((role) => {
      if (role === 'GOD') return 'Super Admin';
      if (role === 'DANCER') return 'Ballerino';
      return ORG_MEMBER_ROLE_LABEL[role];
    }),
  );

  readonly currentLanguage = computed(() => UI_LANG_LABEL[this.locale.lang()]);

  readonly languageButtons = computed<SectionActionButton[]>(() => [
    {
      id: 'toggle',
      icon: this.locale.lang() === 'it' ? translate : language,
      label: this.locale.lang() === 'it' ? 'Passa a English' : 'Torna in italiano',
      variant: 'accent',
    },
  ]);

  readonly themeLabel = computed(() =>
    this.theme.resolved() === 'dark' ? 'tema scuro' : 'tema chiaro',
  );

  /**
   * Tre scelte, non due: `auto` segue il sistema e resta reattivo, gli altri due
   * sono una decisione dell'utente che il sistema non sovrascrive. La primaria
   * — indice 0, resa più a destra — è il tema opposto a quello attivo, perché è
   * l'azione che si cerca.
   */
  readonly themeButtons = computed<SectionActionButton[]>(() => {
    const opposto: SectionActionButton = this.theme.resolved() === 'dark'
      ? { id: 'light', icon: lightMode, label: 'Passa al chiaro', variant: 'accent' }
      : { id: 'dark', icon: darkMode, label: 'Passa allo scuro', variant: 'accent' };
    return this.theme.choice() === 'auto'
      ? [opposto]
      : [opposto, { id: 'auto', icon: contrast, label: 'Segui il sistema', variant: 'default' }];
  });

  readonly sessionButtons: SectionActionButton[] = [
    { id: 'logout', icon: logoutIcon, label: 'Esci', variant: 'error' },
  ];

  onTheme(button: SectionActionButton): void {
    this.theme.set(button.id as ThemeChoice);
  }

  ngOnInit(): void {
    this.headerTitle.set('Preferenze');
  }

  onLanguage(_button: SectionActionButton): void {
    this.locale.toggle();
  }

  onLogout(): void {
    this.auth.logout();
    void this.router.navigateByUrl('/login');
  }
}
