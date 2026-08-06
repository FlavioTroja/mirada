import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { PublicEventCast } from '../../core/domain/models';
import { ARTIST_KIND_LABEL } from '../../core/format/format';

interface CastGroup {
  kind: string;
  label: string;
  members: PublicEventCast[];
}

/**
 * Il **cast** — `Artist` è «Cast» nella tabella del §1: maestri, DJ e orchestre.
 * Sono anagrafiche senza account, e per il pubblico sono il primo motivo per
 * scegliere un festival invece di un altro.
 */
@Component({
  selector: 'app-event-cast',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="www-section" id="cast">
      <h2 class="www-h2">Cast</h2>
      @for (group of groups(); track group.kind) {
        <div class="group">
          <h3 class="group-label">{{ group.label }}</h3>
          <ul class="people">
            @for (c of group.members; track c.id) {
              <li class="person">
                @if (photo(c)) {
                  <img [src]="photo(c)" alt="" loading="lazy" />
                } @else {
                  <span class="avatar" aria-hidden="true">{{ initials(c.artist.name) }}</span>
                }
                <span class="name">
                  @if (c.artist.website) {
                    <a [href]="c.artist.website" target="_blank" rel="noopener">{{ c.artist.name }}</a>
                  } @else {
                    {{ c.artist.name }}
                  }
                </span>
              </li>
            }
          </ul>
        </div>
      }
    </section>
  `,
  styles: [
    `
      .group {
        margin-top: 1rem;
      }
      .group-label {
        margin: 0 0 0.5rem;
        font-size: 0.8rem;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: rgb(var(--accent-rgb));
      }
      .people {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr));
        gap: 0.75rem;
      }
      .person {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        background: rgb(var(--foreground-color));
        border: 1px solid rgba(var(--text-rgb), 0.14);
        border-radius: 999px;
        padding: 0.35rem 0.85rem 0.35rem 0.35rem;
      }
      .person img,
      .avatar {
        width: 2.25rem;
        height: 2.25rem;
        border-radius: 50%;
        object-fit: cover;
        flex: none;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(var(--accent-rgb), 0.16);
        color: rgb(var(--accent-rgb));
        font-size: 0.8rem;
      }
      .name {
        font-size: 0.92rem;
        color: rgb(var(--text-rgb));
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .name a {
        color: inherit;
        text-decoration: none;
      }
      .name a:hover {
        text-decoration: underline;
      }
    `,
  ],
})
export class EventCastComponent {
  readonly casts = input.required<PublicEventCast[]>();

  protected readonly groups = computed<CastGroup[]>(() => {
    const order = ['TEACHER', 'DJ', 'ORCHESTRA'];
    const map = new Map<string, CastGroup>();
    for (const c of [...this.casts()].sort((a, b) => a.sortOrder - b.sortOrder)) {
      const kind = c.kind ?? c.artist?.kind ?? 'TEACHER';
      if (!map.has(kind)) {
        map.set(kind, { kind, label: ARTIST_KIND_LABEL[kind] ?? kind, members: [] });
      }
      map.get(kind)!.members.push(c);
    }
    return [...map.values()].sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
  });

  protected photo(c: PublicEventCast): string | null {
    return c.artist?.photoFile?.url ?? null;
  }

  protected initials(name: string): string {
    return name
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p.charAt(0).toUpperCase())
      .join('');
  }
}
