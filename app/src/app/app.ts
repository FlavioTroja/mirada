// keijo-ui: scaffolded — do not remove this marker if you intend to re-run ng add
import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs/operators';
import {
  BackgroundOrbsComponent,
  GradientBlurComponent,
  HeaderActionButton,
  HeaderComponent,
  KeijoSidebarRoute,
  KeijoSidebarUserProfile,
  MobileNavbarComponent,
  SidebarComponent,
  ToastNotificationComponent,
} from '@keijo/ui';
import { home } from '@keijo/ui/icons';
import { sidebarRoutesFor } from './shell/sidebar-routes';
import { HeaderTitleService } from './services/header-title.service';
import { PageAction, PageActionsService } from './services/page-actions.service';
import { ToastService } from './services/toast.service';
import { ThemeService } from './core/theme/theme.service';
import { AuthService } from './core/auth/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    ToastNotificationComponent,
    GradientBlurComponent,
    BackgroundOrbsComponent,
    HeaderComponent,
    SidebarComponent,
    MobileNavbarComponent,
  ],
  template: `
    <keijo-toast-notification
      [notifications]="toastService.notifications()"
      (dismissed)="toastService.dismiss($event)"
    />

    @if (chromeless()) {
      <div class="bare-shell">
        <keijo-background-orbs [colors]="orbColors" />
        <router-outlet />
      </div>
    } @else {
      <div class="app-shell">
        <keijo-background-orbs [colors]="orbColors" />

        <div class="header-blur-zone">
          <keijo-gradient-blur />
        </div>

        <div class="shell-grid">
          <div class="sidebar-col">
            @if (isDesktop()) {
              <keijo-sidebar
                [routes]="sidebarRoutes()"
                [activeRoute]="activeRoute()"
                [collapsed]="sidebarCollapsed()"
                [expandedPath]="expandedPath()"
                [user]="user()"
                [logoExpandedUrl]="'assets/logo/logo.png'"
                [logoCollapsedUrl]="'assets/logo/logo-collapsed.png'"
                (navigate)="onNavigate($event)"
                (expandToggle)="expandedPath.set($event)"
                (collapseToggle)="sidebarCollapsed.set(!sidebarCollapsed())"
                (goToSettings)="onSettings()"
                (logout)="onLogout()"
              />
            } @else {
              <keijo-mobile-navbar
                [routes]="sidebarRoutes()"
                [activeRoute]="activeRoute()"
                [expandedPath]="expandedPath()"
                [user]="user()"
                [homeIcon]="homeIcon"
                (navigate)="onNavigate($event)"
                (expandToggle)="expandedPath.set($event)"
                (goToSettings)="onSettings()"
                (logout)="onLogout()"
              />
            }
          </div>

          <main class="content-col">
            <div class="header-row">
              <keijo-header
                [title]="pageTitle()"
                [showBackButton]="showBackButton()"
                [isMobile]="!isDesktop()"
                [buttons]="pageActions.actions()"
                (back)="onBack()"
                (buttonClick)="onHeaderAction($event)"
              />
            </div>

            <div class="page-scroll">
              <router-outlet />
            </div>
          </main>
        </div>
      </div>
    }
  `,
  styles: [
    `
      .app-shell {
        position: relative;
        width: 100vw;
        height: 100vh;
        overflow: hidden;
        background: rgb(var(--background-color));
      }
      .bare-shell {
        position: relative;
        width: 100vw;
        min-height: 100vh;
        overflow-x: hidden;
        background: rgb(var(--background-color));
      }
      .header-blur-zone {
        position: absolute;
        inset: 0 0 auto 0;
        height: 4.5rem;
        z-index: 20;
        pointer-events: none;
      }
      .shell-grid {
        position: relative;
        display: grid;
        grid-template-columns: min-content auto;
        height: 100%;
      }
      .sidebar-col {
        z-index: 40;
      }
      .content-col {
        position: relative;
        width: 100%;
        overflow-x: auto;
      }
      .header-row {
        position: absolute;
        inset: 0 0 auto 0;
        /* No left padding: the header sits flush against the content edge so
           the back-button chevron aligns with the leftmost edge of the page
           content. Right padding matches the sidebar's internal padding for
           visual symmetry. */
        padding: 0.625rem 0.625rem 0.625rem 0;
        z-index: 30;
      }
      .page-scroll {
        /* On mobile the sidebar is hidden, so left padding is restored
           (0.625rem, same as right) to keep symmetric breathing room from
           the viewport edges. On md+ the sidebar provides the left-side
           margin and padding-left drops to 0 so the content sits flush
           against the sidebar boundary. Vertical paddings are safe-zone
           offsets for the absolute header (top) and the mobile bottom
           navbar (bottom). */
        padding: 3.725rem 0.625rem calc(66px + 12rem) 0.625rem;
        overflow-y: auto;
        height: 100vh;
        position: relative;
      }
      @media (min-width: 768px) {
        .page-scroll {
          padding: 3.725rem 0.625rem 1rem 0;
        }
      }
      /* When a child <keijo-page-wrapper [scrollable]="false"> is present (e.g.
         infinite-scroll list, table with sticky header), drop the bottom safe
         zone — the section already keeps its content above the mobile-navbar
         via its own height constraint, and the extra padding leaves an ugly
         empty band below the section. Mobile keeps just the navbar height. */
      .page-scroll:has(.keijo-page-wrapper--internal-scroll) {
        padding-bottom: 66px;
      }
      @media (min-width: 768px) {
        .page-scroll:has(.keijo-page-wrapper--internal-scroll) {
          padding-bottom: 0;
        }
      }
    `,
  ],
})
export class App {
  private readonly router = inject(Router);
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);
  readonly headerTitle = inject(HeaderTitleService);
  readonly pageActions = inject(PageActionsService);
  readonly toastService = inject(ToastService);
  /**
   * Iniettato qui e non altrove **di proposito**: `providedIn: 'root'` istanzia
   * il servizio alla prima iniezione, e finché a farlo era la sola pagina
   * Preferenze il tema non veniva applicato su nessuna altra rotta — si tornava
   * allo scuro a ogni ricaricamento. La shell è l'unico punto attraversato
   * sempre.
   */
  private readonly theme = inject(ThemeService);

  readonly isDesktop = signal(window.innerWidth >= 1100);
  readonly sidebarCollapsed = signal(false);
  readonly expandedPath = signal<string | null>(null);
  readonly activeRoute = signal('/events');
  /** Titolo derivato dall'URL; `HeaderTitleService.set(...)` di pagina lo sovrascrive. */
  private readonly derivedTitle = signal('Eventi');
  private readonly backOverride = signal<boolean | undefined>(undefined);
  private readonly foundSidebarRoute = signal(false);

  /** Il login vive fuori dalla shell: niente sidebar, niente header. */
  readonly chromeless = computed(() => this.activeRoute().startsWith('/login'));

  readonly homeIcon = home;

  /** Orb di sfondo sulla palette calda della wall: bordeaux, vinaccia, oro. */
  readonly orbColors: [string, string, string, string] = [
    'hsl(345, 62%, 26%)',
    'hsl(325, 45%, 18%)',
    'hsl(20, 55%, 22%)',
    'hsl(42, 70%, 32%)',
  ];

  /** Le voci di sidebar dipendono dalle capacità del ruolo (§1, §3.8). */
  readonly sidebarRoutes = computed<KeijoSidebarRoute[]>(() => sidebarRoutesFor(this.auth.can()));

  readonly user = computed<KeijoSidebarUserProfile>(() => ({
    username: this.auth.displayName(),
    ...(this.auth.profile()?.avatarUrl ? { avatarUrl: this.auth.profile()!.avatarUrl! } : {}),
  }));

  readonly pageTitle = computed(() => this.headerTitle.title() ?? this.derivedTitle());

  readonly showBackButton = computed(() => {
    const override = this.backOverride();
    return override !== undefined ? override : !this.foundSidebarRoute();
  });

  @HostListener('window:resize')
  onResize(): void {
    this.isDesktop.set(window.innerWidth >= 1100);
  }

  constructor() {
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => this.syncFromUrl(e.urlAfterRedirects || e.url));
    this.syncFromUrl(this.router.url);
  }

  onNavigate(path: string): void {
    void this.router.navigateByUrl(path);
  }

  /** Esegue la callback che la pagina attiva ha registrato per l'azione cliccata. */
  onHeaderAction(button: HeaderActionButton): void {
    (button as PageAction).run?.();
  }

  /**
   * Back button: risale **di un livello nel path**, non nella history del
   * browser (`KEIJO-HEADER-BACK-UP-ONE-LEVEL`).
   */
  onBack(): void {
    const path = this.router.url.split('?')[0].split('#')[0];
    const idx = path.lastIndexOf('/');
    const parent = idx <= 0 ? '/events' : path.slice(0, idx);
    void this.router.navigateByUrl(parent || '/events');
  }

  onSettings(): void {
    void this.router.navigateByUrl('/settings');
  }

  onLogout(): void {
    this.auth.logout();
    void this.router.navigateByUrl('/login');
  }

  private syncFromUrl(url: string): void {
    const cleanUrl = url.split('?')[0].split('#')[0] || '/events';
    this.activeRoute.set(cleanUrl);
    const found = this.findRoute(cleanUrl);
    this.foundSidebarRoute.set(!!found);
    if (found) {
      this.derivedTitle.set(found.label);
      // Tiene aperto il ramo di sidebar della sezione corrente.
      const parent = this.sidebarRoutes().find((r) =>
        r.children?.some((c) => c.path === cleanUrl),
      );
      if (parent) this.expandedPath.set(parent.path);
    } else {
      const segment = cleanUrl.split('/').filter(Boolean).pop() ?? 'Eventi';
      this.derivedTitle.set(segment.charAt(0).toUpperCase() + segment.slice(1));
    }
    this.backOverride.set(this.readShowBackOverride());
  }

  private readShowBackOverride(): boolean | undefined {
    let route = this.activatedRoute.snapshot;
    while (route.firstChild) route = route.firstChild;
    const data = route.data;
    if (data && 'showBackButton' in data) {
      return Boolean((data as Record<string, unknown>)['showBackButton']);
    }
    return undefined;
  }

  private findRoute(path: string): KeijoSidebarRoute | undefined {
    for (const r of this.sidebarRoutes()) {
      if (r.path === path) return r;
      const child = r.children?.find((c) => c.path === path);
      if (child) return child as KeijoSidebarRoute;
    }
    return undefined;
  }
}
