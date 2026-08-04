import { Injectable, inject, signal } from '@angular/core';
import { ApiClient } from '../core/api/api.client';
import { StoredFile } from '../core/domain/models';

/**
 * Store dell'entità `File` (§3.4, §3.7).
 *
 * `File` **non ha `UPDATE` né `DELETE` nel contratto**: quando l'immagine
 * cambia si carica un nuovo file e si **sostituisce il riferimento**
 * sull'entità che lo porta (`posterVerticalFileId`, `photoFileId`,
 * `logoFileId`…) con il `PATCH` di quell'entità. Non si modifica il file.
 *
 * Non estende `EntityStore`: la base REST di `File` espone i soli upload, non
 * l'elenco né la lettura singola, e uno store con `load()` che non risolve in
 * §3 sarebbe una promessa falsa.
 */
@Injectable({ providedIn: 'root' })
export class FileStore {
  private readonly api = inject(ApiClient);

  private readonly _uploading = signal(false);
  readonly uploading = this._uploading.asReadonly();

  /** Dimensione massima accettata dal backend. */
  static readonly MAX_BYTES = 10 * 1024 * 1024;

  /** `POST /files/upload-image` `multipart/form-data` → entità `File`. */
  async uploadImage(file: File): Promise<StoredFile> {
    this._uploading.set(true);
    try {
      const form = new FormData();
      form.append('file', file, file.name);
      return await this.api.upload<StoredFile>('/files/upload-image', form);
    } finally {
      this._uploading.set(false);
    }
  }
}
