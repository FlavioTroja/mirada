import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime } from 'rxjs/operators';
import {
  ButtonComponent,
  EntityListItemComponent,
  FormRowComponent,
  FormWrapperComponent,
  InfoBoxComponent,
  InputComponent,
  KeijoFilterChange,
  KeijoFilterTab,
  ListItemsSkeletonComponent,
  ListItemsWrapperComponent,
  PageSectionWrapperComponent,
  PageWrapperComponent,
  PillComponent,
  SearchBarComponent,
  SectionActionButton,
  SelectComponent,
  SelectOption,
  TextareaComponent,
} from '@keijo/ui';
import { add, check, close, edit, iconDelete, link, theaters } from '@keijo/ui/icons';
import { HeaderTitleService } from '../../services/header-title.service';
import { PageAction, PageActionsService } from '../../services/page-actions.service';
import { ToastService } from '../../services/toast.service';
import { AuthService } from '../../core/auth/auth.service';
import { ARTIST_KIND_OPTIONS, ARTIST_KIND_UI, ArtistKind } from '../../core/domain/enums';
import { Artist, StoredFile } from '../../core/domain/models';
import { buildI18n } from '../../core/i18n/i18n-text';
import { ArtistStore } from '../../stores/artist.store';
import { ConfirmService } from '../../shared/confirm.service';
import { ASPECT_SQUARE, ImageUploadComponent } from '../../shared/image-upload.component';
import { I18nTextComponent } from '../../shared/i18n-text.component';
import { StatusPillComponent } from '../../shared/status-pill.component';
import { applyZodIssues, clearServerErrors, controlError } from '../../shared/form-errors';

/**
 * `/directory/artists` — l'anagrafica di **cast**: maestri, DJ, orchestre (§4.8).
 *
 * Gli artisti **non hanno account** (`RF-EVT-6`): sono anagrafica riutilizzabile
 * fra eventi, non utenti della piattaforma.
 */
@Component({
  selector: 'app-artists',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    PageWrapperComponent,
    PageSectionWrapperComponent,
    SearchBarComponent,
    ListItemsWrapperComponent,
    ListItemsSkeletonComponent,
    EntityListItemComponent,
    ButtonComponent,
    PillComponent,
    InfoBoxComponent,
    FormWrapperComponent,
    FormRowComponent,
    InputComponent,
    TextareaComponent,
    SelectComponent,
    I18nTextComponent,
    StatusPillComponent,
    ImageUploadComponent,
  ],
  template: `
    <keijo-page-wrapper>
      @if (editing()) {
        <keijo-page-section-wrapper
          [title]="editingId() ? 'Modifica artista' : 'Nuovo artista'"
          [buttons]="editButtons"
          (buttonClick)="onEditAction($event)"
        >
          @if (formErrors().length) {
            <p class="mirada-error">{{ formErrors().join(' ') }}</p>
          }

          <keijo-form-wrapper [formGroup]="form">
            <keijo-form-row [cols]="3">
              <keijo-input
                [formControl]="form.controls.name"
                label="nome"
                id="artistName"
                type="text"
              />
              <keijo-select
                [formControl]="form.controls.kind"
                [data]="kindOptions"
                label="tipo"
                placeholder="Maestro, DJ, orchestra"
              />
              <keijo-input
                [formControl]="form.controls.website"
                label="sito"
                id="artistWebsite"
                type="text"
              />
            </keijo-form-row>
            @if (err('name'); as msg) {
              <p class="mirada-error">{{ msg }}</p>
            }

            <keijo-form-row [cols]="1">
              <keijo-textarea
                [formControl]="form.controls.bioIt"
                label="biografia (italiano)"
                id="artistBioIt"
                [rows]="3"
              />
            </keijo-form-row>
            <keijo-form-row [cols]="1">
              <keijo-textarea
                [formControl]="form.controls.bioEn"
                label="biografia (inglese)"
                id="artistBioEn"
                [rows]="3"
              />
            </keijo-form-row>
            <app-image-upload
              label="Fotografia dell’artista"
              hint="Compare nel cast dell’evento e nella scheda pubblica. Formato quadrato."
              [aspect]="photoAspect"
              [fileId]="photoFileId()"
              [currentUrl]="photoUrl()"
              (uploaded)="onPhotoUploaded($event)"
              (cleared)="onPhotoCleared()"
            />
            @if (editingId() === null) {
              <p class="mirada-hint">
                Il riferimento alla fotografia viene scritto sull’artista al salvataggio: il file è
                già caricato, quello che si salva è il collegamento.
              </p>
            }
          </keijo-form-wrapper>
        </keijo-page-section-wrapper>
      }

      <keijo-page-section-wrapper mode="plain">
        <keijo-search-bar
          [search]="search"
          [filterTabs]="filterTabs"
          filterTooltip="Filtra il cast"
          (filterChanged)="onFilterChanged($event)"
        />

        @if (store.loading()) {
          <keijo-list-items-skeleton />
        } @else {
          <keijo-list-items-wrapper>
            @for (artist of store.items(); track artist.id) {
              <keijo-entity-list-item [expandable]="true">
                <ng-template #primary>
                  <div class="primary">
                    @if (artist.photoFile?.url; as url) {
                      <img class="thumb" [src]="url" [alt]="artist.name" />
                    }
                    <span class="title">{{ artist.name }}</span>
                  </div>
                </ng-template>
                <ng-template #secondary>
                  <div class="secondary">
                    <app-status-pill [status]="kindUi(artist.kind)" />
                    @if (artist.website) {
                      <keijo-pill variant="default" [icon]="linkIcon">{{
                        artist.website
                      }}</keijo-pill>
                    }
                    @if (artist.bio) {
                      <span class="mirada-muted"><app-i18n-text [value]="artist.bio" /></span>
                    }
                  </div>
                </ng-template>
                <ng-template #actions>
                  @if (canWrite()) {
                    <keijo-button
                      variant="error"
                      [icon]="deleteIcon"
                      tooltip="Elimina l’artista"
                      (action)="remove(artist)"
                    />
                    <keijo-button
                      variant="warning"
                      [icon]="editIcon"
                      tooltip="Modifica l’artista"
                      (action)="startEdit(artist)"
                    />
                  }
                </ng-template>
              </keijo-entity-list-item>
            } @empty {
              <keijo-info-box [icon]="artistIcon" title="Nessun artista" variant="info">
                <span>
                  Maestri, DJ e orchestre stanno qui una volta sola e si riusano su ogni evento:
                  non hanno un account, sono anagrafica.
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
      .thumb {
        flex: none;
        width: 2rem;
        height: 2rem;
        border-radius: 50%;
        object-fit: cover;
        border: 1px solid rgba(var(--mirada-ivory), 0.16);
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
export class ArtistsComponent implements OnInit {
  private readonly headerTitle = inject(HeaderTitleService);
  private readonly pageActions = inject(PageActionsService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly auth = inject(AuthService);

  readonly store = inject(ArtistStore);

  readonly artistIcon = theaters;
  readonly linkIcon = link;
  readonly editIcon = edit;
  readonly deleteIcon = iconDelete;

  readonly search = new FormControl('', { nonNullable: true });
  readonly editing = signal(false);
  readonly editingId = signal<number | null>(null);
  readonly formErrors = signal<string[]>([]);

  /**
   * `photoFileId` è un **riferimento**: si sostituisce, non si modifica il file
   * (§3.4). Qui vive fuori dal `FormGroup` perché non è un campo digitato.
   */
  readonly photoFileId = signal<number | null>(null);
  readonly photoUrl = signal<string | null>(null);
  readonly photoAspect = ASPECT_SQUARE;

  readonly kindOptions: SelectOption[] = ARTIST_KIND_OPTIONS.map((o) => ({
    label: o.label,
    value: o.value,
  }));

  readonly filterTabs: KeijoFilterTab[] = [
    {
      field: 'kind',
      name: 'Tipo',
      kind: 'multi',
      selectIds: [],
      options: ARTIST_KIND_OPTIONS.map((o) => ({ id: o.value, name: o.label, checked: false })),
    },
  ];

  readonly canWrite = computed(() => this.auth.can().directoryWrite);

  readonly editButtons: SectionActionButton[] = [
    { id: 'save', icon: check, label: 'Salva', variant: 'accent' },
    { id: 'cancel', icon: close, label: 'Annulla', variant: 'default' },
  ];

  readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    kind: new FormControl<ArtistKind>('TEACHER', { nonNullable: true }),
    website: new FormControl('', { nonNullable: true }),
    bioIt: new FormControl('', { nonNullable: true }),
    bioEn: new FormControl('', { nonNullable: true }),
  });

  constructor() {
    this.search.valueChanges
      .pipe(debounceTime(300), takeUntilDestroyed())
      .subscribe((value) => void this.store.setQuery({ value: value || undefined }));
  }

  async ngOnInit(): Promise<void> {
    this.headerTitle.set('Cast');
    this.registerActions();
    await this.store.replaceQuery({});
  }

  private registerActions(): void {
    const actions: PageAction[] = [];
    if (this.canWrite()) {
      actions.push({
        id: 'create',
        icon: add,
        label: 'Crea',
        tooltip: 'Crea un artista',
        run: () => this.startCreate(),
      });
    }
    this.pageActions.set(actions);
  }

  onFilterChanged(change: KeijoFilterChange): void {
    if (change.field !== 'kind') return;
    const ids = Array.isArray(change.value) ? (change.value as ArtistKind[]) : [];
    void this.store.setQuery({ kind: ids.length ? ids : undefined });
  }

  err(control: keyof typeof this.form.controls): string | null {
    return controlError(this.form.controls[control]);
  }

  kindUi(kind: ArtistKind) {
    return ARTIST_KIND_UI[kind];
  }

  startCreate(): void {
    this.editingId.set(null);
    this.form.reset({ name: '', kind: 'TEACHER', website: '', bioIt: '', bioEn: '' });
    this.photoFileId.set(null);
    this.photoUrl.set(null);
    this.formErrors.set([]);
    this.editing.set(true);
  }

  startEdit(artist: Artist): void {
    this.editingId.set(artist.id);
    this.form.reset({
      name: artist.name,
      kind: artist.kind,
      website: artist.website ?? '',
      bioIt: artist.bio?.it ?? '',
      bioEn: artist.bio?.en ?? '',
    });
    this.photoFileId.set(artist.photoFileId ?? null);
    this.photoUrl.set(artist.photoFile?.url ?? null);
    this.formErrors.set([]);
    this.editing.set(true);
  }

  /**
   * Il file è caricato: qui si scrive solo il **riferimento** sull'entità, con
   * il suo `PATCH` — in modifica subito, in creazione al salvataggio.
   */
  async onPhotoUploaded(file: StoredFile): Promise<void> {
    this.photoFileId.set(file.id);
    this.photoUrl.set(file.url);
    const id = this.editingId();
    if (id === null) return;
    await this.store.update(id, { photoFileId: file.id });
    this.toast.show('SUCCESS', 'Fotografia collegata all’artista.');
  }

  async onPhotoCleared(): Promise<void> {
    this.photoFileId.set(null);
    this.photoUrl.set(null);
    const id = this.editingId();
    if (id === null) return;
    await this.store.update(id, { photoFileId: null });
    this.toast.show('SUCCESS', 'Fotografia scollegata.');
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
      this.formErrors.set(['Il nome dell’artista è obbligatorio.']);
      return;
    }

    const value = this.form.getRawValue();
    const payload = {
      name: value.name.trim(),
      kind: value.kind,
      website: value.website.trim() || null,
      bio: value.bioIt.trim() ? buildI18n(value.bioIt, value.bioEn) : null,
      photoFileId: this.photoFileId(),
    };

    try {
      const id = this.editingId();
      if (id === null) {
        await this.store.create(payload);
        this.toast.show('SUCCESS', 'Artista creato.');
      } else {
        await this.store.update(id, payload);
        this.toast.show('SUCCESS', 'Artista aggiornato.');
      }
      this.editing.set(false);
      await this.store.load();
    } catch (err) {
      const unmatched = applyZodIssues(this.form, err);
      this.formErrors.set(unmatched.length ? unmatched : ['Controlla i campi evidenziati.']);
    }
  }

  async remove(artist: Artist): Promise<void> {
    const ok = await this.confirm.ask({
      title: 'Eliminare l’artista?',
      message:
        `«${artist.name}» non sarà più selezionabile per i nuovi cast. ` +
        'I cast degli eventi già composti continuano a mostrarlo.',
      confirmLabel: 'Elimina',
      destructive: true,
    });
    if (!ok) return;
    await this.store.remove(artist.id);
    this.toast.show('SUCCESS', 'Artista eliminato.');
  }
}
