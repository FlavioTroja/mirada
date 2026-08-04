import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { ButtonComponent, PillComponent } from '@keijo/ui';
import { check, cloudUpload, iconDelete, image as imageIcon, warning } from '@keijo/ui/icons';
import { StoredFile } from '../core/domain/models';
import { FileStore } from '../stores/file.store';

/** Proporzione attesa del ritaglio, dichiarata e verificata dopo la scelta. */
export interface AspectSpec {
  /** Rapporto largh./alt. atteso, es. `2/3` per il verticale. */
  ratio: number;
  /** Come si legge: `2:3`. */
  label: string;
  /** Tolleranza relativa entro cui il rapporto è considerato rispettato. */
  tolerance?: number;
}

export const ASPECT_VERTICAL: AspectSpec = { ratio: 2 / 3, label: '2:3 (verticale)' };
export const ASPECT_HORIZONTAL: AspectSpec = { ratio: 16 / 9, label: '16:9 (orizzontale)' };
export const ASPECT_SQUARE: AspectSpec = { ratio: 1, label: '1:1 (quadrato)' };
export const ASPECT_FREE_SQUARE: AspectSpec = { ratio: 1, label: '1:1 (quadrato)', tolerance: 0.5 };

const DEFAULT_TOLERANCE = 0.08;

/**
 * Caricamento di un'immagine — `POST /files/upload-image` (§3.7).
 *
 * Il file caricato produce un'entità `File`; il **riferimento** si scrive poi
 * sull'entità con il suo `PATCH` (`posterVerticalFileId`, `photoFileId`,
 * `logoFileId`). **Nessun `UPDATE` né `DELETE` sui file**: sostituire
 * l'immagine significa caricarne un'altra e cambiare il riferimento, non
 * modificare il file (§3.4).
 *
 * **Ritaglio guidato — scostamento dichiarato.** `RF-EVT-3` chiede un ritaglio
 * guidato per i tre formati della locandina. `@keijo/ui@3.0.0` **non spedisce
 * alcun componente di crop** (l'elenco dei suoi componenti non ne contiene), e
 * inventarne uno significherebbe inventare un'API della libreria. Qui il file
 * si carica già ritagliato: la proporzione attesa è **dichiarata** e
 * **verificata** dopo la scelta, con un avviso non bloccante quando non
 * corrisponde. Punto 3+1 riportato al committente.
 */
@Component({
  selector: 'app-image-upload',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, PillComponent],
  template: `
    <div class="upload">
      <div class="preview" [class.preview--empty]="!previewUrl()">
        @if (previewUrl(); as url) {
          <img [src]="url" [alt]="label()" />
        } @else {
          <span class="mirada-hint">Nessuna immagine</span>
        }
      </div>

      <div class="body">
        <p class="mirada-label">{{ label() }}</p>
        <p class="mirada-hint">{{ hint() }}</p>

        <div class="pills">
          <keijo-pill
            variant="default"
            [icon]="aspectIcon"
            tooltip="Proporzione attesa per questo ritaglio"
          >
            {{ aspect().label }}
          </keijo-pill>
          @if (fileId()) {
            <keijo-pill variant="success" [icon]="okIcon" tooltip="Riferimento scritto sull’entità">
              collegata
            </keijo-pill>
          }
        </div>

        @if (aspectWarning(); as msg) {
          <p class="mirada-error">{{ msg }}</p>
        }
        @if (errorMessage(); as msg) {
          <p class="mirada-error">{{ msg }}</p>
        }

        <div class="actions">
          @if (!readonly()) {
            <keijo-button
              variant="accent"
              [icon]="uploadIcon"
              [label]="fileId() ? 'Sostituisci' : 'Carica'"
              [loading]="busy()"
              [disabled]="busy()"
              [tooltip]="
                fileId()
                  ? 'Carica una nuova immagine: sostituisce il riferimento, non modifica il file'
                  : 'Carica l’immagine'
              "
              (action)="pick()"
            />
            @if (fileId()) {
              <keijo-button
                variant="error"
                [icon]="clearIcon"
                tooltip="Scollega l’immagine dall’entità. Il file resta, cambia solo il riferimento"
                [disabled]="busy()"
                (action)="clear()"
              />
            }
          }
        </div>
      </div>

      <input
        #picker
        class="hidden-input"
        type="file"
        accept="image/*"
        [attr.aria-label]="label()"
        (change)="onPicked($event)"
      />
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .upload {
        display: flex;
        gap: 0.75rem;
        align-items: flex-start;
      }
      .preview {
        flex: none;
        width: 6rem;
        min-height: 6rem;
        border-radius: 0.5rem;
        overflow: hidden;
        border: 1px solid rgba(var(--mirada-ivory), 0.16);
        background: rgba(var(--mirada-ivory), 0.04);
        display: flex;
        align-items: center;
        justify-content: center;
        text-align: center;
        padding: 0.25rem;
      }
      .preview img {
        width: 100%;
        height: auto;
        display: block;
      }
      .body {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        min-width: 0;
        flex: 1 1 auto;
      }
      .pills,
      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 0.375rem;
        align-items: center;
      }
      .actions {
        margin-top: 0.25rem;
      }
      .hidden-input {
        position: absolute;
        width: 1px;
        height: 1px;
        opacity: 0;
        pointer-events: none;
      }
    `,
  ],
})
export class ImageUploadComponent {
  private readonly files = inject(FileStore);

  readonly label = input.required<string>();
  readonly hint = input('');
  readonly aspect = input.required<AspectSpec>();
  /** Riferimento attuale sull'entità (`…FileId`). */
  readonly fileId = input<number | null>(null);
  /** URL dell'immagine già collegata, dal `populate` della relazione. */
  readonly currentUrl = input<string | null>(null);
  readonly readonly = input(false);

  /** Il file caricato: chi ospita il componente scrive il riferimento con il suo `PATCH`. */
  readonly uploaded = output<StoredFile>();
  /** Richiesta di scollegare: il riferimento va portato a `null`, il file resta. */
  readonly cleared = output<void>();

  private readonly picker = viewChild.required<ElementRef<HTMLInputElement>>('picker');

  readonly uploadIcon = cloudUpload;
  readonly clearIcon = iconDelete;
  readonly aspectIcon = imageIcon;
  readonly okIcon = check;
  readonly warningIcon = warning;

  private readonly localUrl = signal<string | null>(null);
  readonly aspectWarning = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);
  readonly busy = computed(() => this.files.uploading());

  readonly previewUrl = computed(() => this.localUrl() ?? this.currentUrl());

  pick(): void {
    this.errorMessage.set(null);
    this.picker().nativeElement.click();
  }

  async onPicked(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    this.errorMessage.set(null);
    this.aspectWarning.set(null);

    if (!file.type.startsWith('image/')) {
      this.errorMessage.set('Il file scelto non è un’immagine.');
      return;
    }
    if (file.size > FileStore.MAX_BYTES) {
      this.errorMessage.set('L’immagine supera la dimensione massima accettata.');
      return;
    }

    await this.checkAspect(file);

    try {
      const stored = await this.files.uploadImage(file);
      this.localUrl.set(stored.url);
      this.uploaded.emit(stored);
    } catch (err) {
      this.errorMessage.set(
        err instanceof Error ? err.message : 'Il caricamento non è andato a buon fine.',
      );
    }
  }

  clear(): void {
    this.localUrl.set(null);
    this.aspectWarning.set(null);
    this.cleared.emit();
  }

  /**
   * Verifica la proporzione dichiarata. **Avvisa, non blocca**: il ritaglio
   * resta responsabilità di chi carica finché non esiste un editor di crop.
   */
  private checkAspect(file: File): Promise<void> {
    const spec = this.aspect();
    const tolerance = spec.tolerance ?? DEFAULT_TOLERANCE;
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const ratio = img.naturalWidth / img.naturalHeight;
        if (Math.abs(ratio - spec.ratio) / spec.ratio > tolerance) {
          this.aspectWarning.set(
            `L’immagine è ${img.naturalWidth}×${img.naturalHeight}: la proporzione attesa per ` +
              `questo ritaglio è ${spec.label}. Viene caricata comunque, ma verrà mostrata ` +
              'ritagliata o con bande.',
          );
        }
        URL.revokeObjectURL(url);
        resolve();
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve();
      };
      img.src = url;
    });
  }
}
