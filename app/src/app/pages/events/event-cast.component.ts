import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import {
  ButtonComponent,
  EntityListItemComponent,
  FormRowComponent,
  FormWrapperComponent,
  InfoBoxComponent,
  InputComponent,
  ListItemsSkeletonComponent,
  ListItemsWrapperComponent,
  PageSectionWrapperComponent,
  PageWrapperComponent,
  PillComponent,
  SectionActionButton,
  SelectComponent,
  SelectOption,
} from '@keijo/ui';
import { add, check, close, edit, iconDelete, theaters } from '@keijo/ui/icons';
import { HeaderTitleService } from '../../services/header-title.service';
import { PageAction, PageActionsService } from '../../services/page-actions.service';
import { ToastService } from '../../services/toast.service';
import { AuthService } from '../../core/auth/auth.service';
import { ARTIST_KIND_OPTIONS, ARTIST_KIND_UI, ArtistKind } from '../../core/domain/enums';
import { EventCast } from '../../core/domain/models';
import { ArtistStore } from '../../stores/artist.store';
import { EventCastStore } from '../../stores/event-cast.store';
import { EventStore } from '../../stores/event.store';
import { ConfirmService } from '../../shared/confirm.service';
import { AvatarComponent } from '../../shared/avatar.component';
import { StatusPillComponent } from '../../shared/status-pill.component';
import { applyZodIssues, clearServerErrors, controlError } from '../../shared/form-errors';
import { EventWorkspaceNavComponent } from './event-workspace-nav.component';

/**
 * `/events/:id/cast` — il cast dell'evento (§4.2).
 *
 * Gli artisti sono anagrafica riutilizzabile fra eventi e **non hanno account**
 * (`RF-EVT-6`): qui si compone l'elenco, non si crea la persona. La creazione
 * di un nuovo artista sta in `/directory/artists`, ed è raggiungibile anche da
 * qui con il «crea» del selettore.
 */
@Component({
  selector: 'app-event-cast',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    PageWrapperComponent,
    PageSectionWrapperComponent,
    ListItemsWrapperComponent,
    ListItemsSkeletonComponent,
    EntityListItemComponent,
    ButtonComponent,
    PillComponent,
    InfoBoxComponent,
    FormWrapperComponent,
    FormRowComponent,
    InputComponent,
    SelectComponent,
    AvatarComponent,
    StatusPillComponent,
    EventWorkspaceNavComponent,
  ],
  template: `
    <keijo-page-wrapper>
      <app-event-workspace-nav [event]="eventStore.current()" current="cast" />

      @if (editing()) {
        <keijo-page-section-wrapper
          [title]="editingId() ? 'Modifica voce di cast' : 'Aggiungi al cast'"
          [buttons]="editButtons"
          (buttonClick)="onEditAction($event)"
        >
          @if (formErrors().length) {
            <p class="mirada-error">{{ formErrors().join(' ') }}</p>
          }
          <keijo-form-wrapper [formGroup]="form">
            <keijo-form-row [cols]="3">
              <keijo-select
                [formControl]="form.controls.artistId"
                [data]="artistOptions()"
                label="artista"
                placeholder="Cerca o crea"
                [onCreate]="createArtist"
              />
              <keijo-select
                [formControl]="form.controls.kind"
                [data]="kindOptions"
                label="tipo"
                placeholder="Maestro, DJ, orchestra"
              />
              <keijo-input
                [formControl]="form.controls.sortOrder"
                label="ordine"
                id="sortOrder"
                type="number"
                min="0"
              />
            </keijo-form-row>
            @if (err('artistId'); as msg) {
              <p class="mirada-error">{{ msg }}</p>
            }
          </keijo-form-wrapper>
        </keijo-page-section-wrapper>
      }

      <keijo-page-section-wrapper mode="plain">
        @if (store.loading()) {
          <keijo-list-items-skeleton />
        } @else {
          <keijo-list-items-wrapper>
            @for (row of store.items(); track row.id) {
              <keijo-entity-list-item [expandable]="true">
                <ng-template #primary>
                  <div class="primary">
                    <app-avatar
                      [src]="row.artist?.photoFile?.url ?? null"
                      [name]="row.artist?.name ?? ''"
                    />
                    <span class="title">{{ row.artist?.name ?? 'Artista #' + row.artistId }}</span>
                  </div>
                </ng-template>
                <ng-template #secondary>
                  <div class="secondary">
                    <app-status-pill [status]="kindUi(row.kind)" />
                    <keijo-pill variant="default" [icon]="castIcon">
                      ordine {{ row.sortOrder }}
                    </keijo-pill>
                  </div>
                </ng-template>
                <ng-template #actions>
                  @if (canWrite()) {
                    <keijo-button
                      variant="error"
                      [icon]="deleteIcon"
                      tooltip="Rimuovi dal cast"
                      (action)="remove(row)"
                    />
                    <keijo-button
                      variant="warning"
                      [icon]="editIcon"
                      tooltip="Modifica la voce di cast"
                      (action)="startEdit(row)"
                    />
                  }
                </ng-template>
              </keijo-entity-list-item>
            } @empty {
              <keijo-info-box [icon]="castIcon" title="Cast non ancora composto" variant="info">
                <span>
                  Maestri, DJ e orchestre dell’evento si scelgono dall’anagrafica condivisa: chi
                  torna ogni anno si aggiunge una volta e si riusa.
                </span>
              </keijo-info-box>
            }
          </keijo-list-items-wrapper>
        }
      </keijo-page-section-wrapper>
    </keijo-page-wrapper>
  `,
  styles: [
    `
      .primary {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        min-width: 0;
      }
      .title {
        font-weight: 600;
      }
      .secondary {
        display: flex;
        flex-wrap: wrap;
        gap: 0.375rem;
        align-items: center;
      }
    `,
  ],
})
export class EventCastComponent implements OnInit {
  private readonly headerTitle = inject(HeaderTitleService);
  private readonly pageActions = inject(PageActionsService);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly auth = inject(AuthService);
  private readonly artists = inject(ArtistStore);

  readonly store = inject(EventCastStore);
  readonly eventStore = inject(EventStore);

  readonly castIcon = theaters;
  readonly editIcon = edit;
  readonly deleteIcon = iconDelete;

  private readonly eventId = signal(0);
  readonly editing = signal(false);
  readonly editingId = signal<number | null>(null);
  readonly formErrors = signal<string[]>([]);
  readonly artistOptions = signal<SelectOption[]>([]);

  readonly kindOptions: SelectOption[] = ARTIST_KIND_OPTIONS.map((o) => ({
    label: o.label,
    value: o.value,
  }));

  readonly canWrite = computed(() => this.auth.can().eventsWrite);

  readonly editButtons: SectionActionButton[] = [
    { id: 'save', icon: check, label: 'Salva', variant: 'accent' },
    { id: 'cancel', icon: close, label: 'Annulla', variant: 'default' },
  ];

  readonly form = new FormGroup({
    artistId: new FormControl<number | null>(null, { validators: [Validators.required] }),
    kind: new FormControl<ArtistKind>('TEACHER', { nonNullable: true }),
    sortOrder: new FormControl<number>(0, { nonNullable: true }),
  });

  async ngOnInit(): Promise<void> {
    this.headerTitle.set('Cast');
    this.eventId.set(Number(this.route.snapshot.paramMap.get('id')));
    this.registerActions();
    await Promise.all([
      this.eventStore.loadOne(this.eventId()),
      this.store.replaceQuery({ eventId: this.eventId() }),
      this.loadArtists(),
    ]);
  }

  private registerActions(): void {
    const actions: PageAction[] = [];
    if (this.canWrite()) {
      actions.push({
        id: 'create',
        icon: add,
        label: 'Aggiungi',
        tooltip: 'Aggiungi un artista al cast',
        run: () => this.startCreate(),
      });
    }
    this.pageActions.set(actions);
  }

  private async loadArtists(): Promise<void> {
    const docs = await this.artists.loadAll({}, 200, '');
    this.artistOptions.set(docs.map((a) => ({ label: a.name, value: a.id })));
  }

  /**
   * «Trova o crea» del selettore: l'artista è anagrafica, non ha account, e
   * crearlo qui evita di uscire dal workspace per un nome che manca.
   */
  readonly createArtist = async (term: string): Promise<SelectOption> => {
    try {
      const created = await this.artists.create({ name: term.trim(), kind: 'TEACHER' });
      const option: SelectOption = { label: created.name, value: created.id };
      this.artistOptions.update((current) => [...current, option]);
      return option;
    } catch (err) {
      this.toast.show('ERROR', 'Non è stato possibile creare l’artista.');
      throw err;
    }
  };

  err(control: keyof typeof this.form.controls): string | null {
    return controlError(this.form.controls[control]);
  }

  kindUi(kind: ArtistKind) {
    return ARTIST_KIND_UI[kind];
  }

  startCreate(): void {
    this.editingId.set(null);
    this.form.reset({ kind: 'TEACHER', sortOrder: this.store.items().length });
    this.formErrors.set([]);
    this.editing.set(true);
  }

  startEdit(row: EventCast): void {
    this.editingId.set(row.id);
    this.form.reset({ artistId: row.artistId, kind: row.kind, sortOrder: row.sortOrder });
    this.formErrors.set([]);
    this.editing.set(true);
  }

  async onEditAction(button: SectionActionButton): Promise<void> {
    if (button.id === 'cancel') {
      this.editing.set(false);
      return;
    }
    this.form.markAllAsTouched();
    clearServerErrors(this.form);
    this.formErrors.set([]);
    if (this.form.invalid) {
      this.formErrors.set(['Scegli l’artista da aggiungere al cast.']);
      return;
    }

    const value = this.form.getRawValue();
    try {
      const id = this.editingId();
      if (id === null) {
        await this.store.create({
          eventId: this.eventId(),
          artistId: Number(value.artistId),
          kind: value.kind,
          sortOrder: Number(value.sortOrder) || 0,
        });
        this.toast.show('SUCCESS', 'Artista aggiunto al cast.');
      } else {
        await this.store.update(id, {
          artistId: Number(value.artistId),
          kind: value.kind,
          sortOrder: Number(value.sortOrder) || 0,
        });
        this.toast.show('SUCCESS', 'Voce di cast aggiornata.');
      }
      this.editing.set(false);
      await this.store.load();
    } catch (err) {
      const unmatched = applyZodIssues(this.form, err);
      this.formErrors.set(unmatched.length ? unmatched : ['Controlla i campi evidenziati.']);
    }
  }

  async remove(row: EventCast): Promise<void> {
    const ok = await this.confirm.ask({
      title: 'Rimuovere dal cast?',
      message:
        `${row.artist?.name ?? 'L’artista'} viene tolto dal cast di questo evento. ` +
        'L’anagrafica dell’artista resta disponibile per gli altri eventi.',
      confirmLabel: 'Rimuovi',
      destructive: true,
    });
    if (!ok) return;
    await this.store.remove(row.id);
    this.toast.show('SUCCESS', 'Artista rimosso dal cast.');
  }
}
