import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import {
  KeijoIconShape,
  NavigationButtonComponent,
  PageSectionWrapperComponent,
  PillComponent,
} from '@keijo/ui';
import {
  celebration,
  chevronRight,
  checklist,
  description,
  eventSeat,
  locationOn,
  nightlife,
  restaurant,
  sell,
  theaters,
} from '@keijo/ui/icons';
import { EVENT_STATUS_UI } from '../../core/domain/enums';
import { formatRange } from '../../core/i18n/format';
import { MiradaEvent } from '../../core/domain/models';
import { I18nTextComponent } from '../../shared/i18n-text.component';
import { StatusPillComponent } from '../../shared/status-pill.component';

interface WorkspaceLink {
  id: string;
  label: string;
  icon: KeijoIconShape;
  path: string;
  /** Capacità del `EventType` che abilita la scheda; `undefined` = sempre visibile. */
  requires?: 'multiSession' | 'cast';
}

/**
 * Barra di contesto del **workspace di costruzione dell'evento** (§4.2).
 *
 * Le schede visibili **sono generate dalle cinque capacità del `EventType`**:
 * un tipo evento senza sessioni multiple non mostra la scheda Sessioni. È il
 * requisito dichiarato, non un'ottimizzazione (rischio `R9`).
 */
@Component({
  selector: 'app-event-workspace-nav',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    PageSectionWrapperComponent,
    NavigationButtonComponent,
    PillComponent,
    I18nTextComponent,
    StatusPillComponent,
  ],
  template: `
    @if (event(); as ev) {
      <keijo-page-section-wrapper>
        <div class="head">
          <div class="identity">
            <h2 class="title"><app-i18n-text [value]="ev.title" /></h2>
            <p class="mirada-muted">{{ range() }}</p>
          </div>
          <div class="badges">
            <app-status-pill [status]="statusUi()" />
            @if (ev.venue) {
              <keijo-pill variant="default" [icon]="venueIcon">{{ ev.venue.name }}</keijo-pill>
            }
            @if (ev.eventType) {
              <keijo-pill variant="default" [icon]="typeIcon">
                <app-i18n-text [value]="ev.eventType.name" />
              </keijo-pill>
            }
          </div>
        </div>

        <nav class="links">
          @for (link of links(); track link.id) {
            <keijo-navigation-button
              variant="row"
              [label]="link.label"
              [leadingIcon]="link.icon"
              [trailingIcon]="current() === link.id ? undefined : chevronIcon"
              [disabled]="current() === link.id"
              (action)="go(link.path)"
            />
          }
        </nav>
      </keijo-page-section-wrapper>
    }
  `,
  styles: [
    `
      .head {
        display: flex;
        flex-wrap: wrap;
        gap: 0.75rem;
        justify-content: space-between;
        align-items: flex-start;
      }
      .title {
        font-size: 1.05rem;
        font-weight: 600;
        margin: 0;
      }
      .badges {
        display: flex;
        flex-wrap: wrap;
        gap: 0.375rem;
      }
      .links {
        display: grid;
        gap: 0.375rem;
        grid-template-columns: repeat(auto-fill, minmax(13rem, 1fr));
      }
    `,
  ],
})
export class EventWorkspaceNavComponent {
  private readonly router = inject(Router);

  readonly event = input<MiradaEvent | null>(null);
  /** Identificativo della scheda corrente: viene mostrata come non cliccabile. */
  readonly current = input<string>('');

  readonly chevronIcon = chevronRight;
  readonly venueIcon = locationOn;
  readonly typeIcon = celebration;

  readonly statusUi = computed(() => {
    const status = this.event()?.status;
    return status ? EVENT_STATUS_UI[status] : null;
  });

  readonly range = computed(() => {
    const ev = this.event();
    return ev ? formatRange(ev.startAt, ev.endAt) : '';
  });

  readonly links = computed<WorkspaceLink[]>(() => {
    const ev = this.event();
    if (!ev) return [];
    const type = ev.eventType;
    const base = `/events/${ev.id}`;
    const all: WorkspaceLink[] = [
      { id: 'detail', label: 'Dati base', icon: description, path: base },
      {
        id: 'sessions',
        label: 'Sessioni',
        icon: nightlife,
        path: `${base}/sessions`,
        requires: 'multiSession',
      },
      { id: 'cast', label: 'Cast', icon: theaters, path: `${base}/cast`, requires: 'cast' },
      { id: 'ticket-types', label: 'Titoli d’ingresso', icon: sell, path: `${base}/ticket-types` },
      { id: 'quotas', label: 'Quote di capienza', icon: eventSeat, path: `${base}/quotas` },
      { id: 'requirements', label: 'Requisiti', icon: checklist, path: `${base}/requirements` },
      { id: 'services', label: 'Servizi', icon: restaurant, path: `${base}/services` },
    ];

    return all.filter((link) => {
      if (!link.requires) return true;
      if (!type) return true;
      if (link.requires === 'multiSession') return type.capMultiSession;
      return type.capCast;
    });
  });

  go(path: string): void {
    void this.router.navigateByUrl(path);
  }
}
