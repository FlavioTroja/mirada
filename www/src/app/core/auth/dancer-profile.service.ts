import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { ApiClient } from '../api/api.client';
import { AuthService } from './auth.service';
import { DancerProfile, PreferredDanceRole } from '../domain/models';

/** Ciò che la persona può cambiare di sé. Nome e cognome non sono qui: vedi sotto. */
export interface DancerProfileEdit {
  nickname: string;
  preferredRole: PreferredDanceRole;
  city?: string | null;
  declaredLevel?: string | null;
  languages: string[];
  birthDate?: string | null;
  profileVisibleToOrganizers?: boolean;
}

/**
 * **Il proprio profilo da ballerino** — lettura, creazione e modifica.
 *
 * ── Perché non c'è una rotta «il mio profilo» ────────────────────────────────
 * Il permesso `DANCER_PROFILE` è concesso al `DANCER` con scope `#OWN`: l'elenco
 * paginato, per chi non è Super Admin, contiene esattamente una riga — la
 * propria. Chiedere l'elenco è quindi il modo corretto di chiedere «il mio», e
 * non serve un endpoint dedicato che rifarebbe lo stesso filtro un livello più
 * in su.
 *
 * ── Perché il profilo può non esistere ───────────────────────────────────────
 * La registrazione crea `Contact`, `Person` e `User`, non questo. È giusto così:
 * per comprare un biglietto servono nome, cognome e un indirizzo raggiungibile,
 * non un nickname. Il profilo nasce **la prima volta che la persona lo apre e
 * salva** — e allora `save()` crea invece di aggiornare, senza che la pagina
 * debba conoscere la differenza.
 *
 * ── Cosa NON si modifica da qui ──────────────────────────────────────────────
 * Nome e cognome stanno su `Person` e sono l'anagrafica con cui viene emesso il
 * biglietto: al controllo all'ingresso devono corrispondere a un documento. Il
 * ballerino non ha alcun permesso su `PERSON`, quindi la pagina li mostra e non
 * li lascia toccare. Ciò che si cambia liberamente è come ci si racconta:
 * nickname, città, ruolo preferito, lingue, livello, ritratto.
 */
@Injectable({ providedIn: 'root' })
export class DancerProfileService {
  private readonly api = inject(ApiClient);
  private readonly auth = inject(AuthService);

  private readonly _profile = signal<DancerProfile | null>(null);
  private readonly _loading = signal(false);
  private readonly _saving = signal(false);
  private readonly _loaded = signal(false);

  readonly profile = this._profile.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly saving = this._saving.asReadonly();
  /** Vero solo a lettura conclusa: distingue «non ce l'ha» da «non ancora chiesto». */
  readonly missing = computed(() => this._loaded() && this._profile() === null);

  constructor() {
    // Uscire deve svuotare anche questo. La dipendenza va in una direzione
    // sola — questo servizio conosce l'autenticazione, non viceversa — quindi
    // l'uscita si osserva invece di essere notificata: vale anche per il logout
    // che l'interceptor esegue da sé su un `401`, che nessuno chiama a mano.
    effect(() => {
      if (!this.auth.isAuthenticated()) this.clear();
    });
  }

  /** `POST /dancer-profiles/` — una riga sola, la propria. */
  async load(): Promise<DancerProfile | null> {
    if (!this.auth.isAuthenticated()) return null;
    this._loading.set(true);
    try {
      const page = await this.api.list<DancerProfile>(
        'dancer-profiles',
        {},
        { limit: 1, populate: 'avatarFile' },
      );
      const mine = page.docs?.[0] ?? null;
      this._profile.set(mine);
      this._loaded.set(true);
      return mine;
    } finally {
      this._loading.set(false);
    }
  }

  /**
   * Crea o aggiorna, a seconda di cosa esiste già.
   *
   * Il ritratto **non** passa da qui: è un riferimento a un file già caricato,
   * e mescolarlo ai campi del modulo farebbe perdere l'immagine appena scelta
   * ogni volta che il salvataggio dei dati fallisce per un nickname occupato.
   */
  async save(edit: DancerProfileEdit): Promise<DancerProfile> {
    this._saving.set(true);
    try {
      const current = this._profile();
      const payload = {
        nickname: edit.nickname.trim(),
        preferredRole: edit.preferredRole,
        city: emptyToNull(edit.city),
        declaredLevel: emptyToNull(edit.declaredLevel),
        languages: edit.languages,
        birthDate: edit.birthDate ? new Date(edit.birthDate).toISOString() : null,
        profileVisibleToOrganizers: edit.profileVisibleToOrganizers ?? true,
      };

      const saved = current
        ? await this.api.patch<DancerProfile>('dancer-profiles', current.id, payload)
        : await this.api.post<DancerProfile>('/dancer-profiles/create', payload);

      // La `PATCH` restituisce la riga nuda: senza il file ripopolato il
      // ritratto sparirebbe dalla pagina a ogni salvataggio riuscito, che è il
      // modo più veloce per far credere a qualcuno di aver perso la foto.
      this._profile.set({ ...saved, avatarFile: saved.avatarFile ?? current?.avatarFile ?? null });
      this._loaded.set(true);
      await this.auth.loadProfile();
      return this._profile()!;
    } finally {
      this._saving.set(false);
    }
  }

  /**
   * Carica l'immagine e la collega al profilo.
   *
   * Sono due passi perché il file esiste per conto suo: `POST /files/upload-image`
   * lo scrive e restituisce la riga, il collegamento è un aggiornamento del
   * profilo. Se il profilo non c'è ancora — prima visita, nessun nickname
   * scelto — il file resta caricato e il collegamento avverrà al primo
   * salvataggio: meglio un file orfano che chiedere di inventarsi un nickname
   * per poter mettere una foto.
   */
  async uploadAvatar(file: File): Promise<DancerProfile | null> {
    this._saving.set(true);
    try {
      const uploaded = await this.api.uploadImage(file);
      const current = this._profile();
      if (!current) {
        this.pendingAvatarFileId = uploaded.id;
        this.pendingAvatarUrl.set(uploaded.url ?? null);
        return null;
      }

      const saved = await this.api.patch<DancerProfile>('dancer-profiles', current.id, {
        avatarFileId: uploaded.id,
      });
      this._profile.set({ ...saved, avatarFile: uploaded });
      await this.auth.loadProfile();
      return this._profile();
    } finally {
      this._saving.set(false);
    }
  }

  /** Il ritratto scelto prima che il profilo esistesse, in attesa del primo salvataggio. */
  private pendingAvatarFileId: number | null = null;
  readonly pendingAvatarUrl = signal<string | null>(null);

  /** Collega il ritratto rimasto in sospeso, subito dopo la creazione del profilo. */
  async attachPendingAvatar(): Promise<void> {
    const fileId = this.pendingAvatarFileId;
    const current = this._profile();
    if (!fileId || !current) return;

    const saved = await this.api.patch<DancerProfile>('dancer-profiles', current.id, {
      avatarFileId: fileId,
    });
    this._profile.set({
      ...saved,
      avatarFile: { id: fileId, url: this.pendingAvatarUrl() },
    });
    this.pendingAvatarFileId = null;
    this.pendingAvatarUrl.set(null);
    await this.auth.loadProfile();
  }

  /** Dopo l'uscita non deve restare in memoria il profilo di chi c'era prima. */
  clear(): void {
    this._profile.set(null);
    this._loaded.set(false);
    this.pendingAvatarFileId = null;
    this.pendingAvatarUrl.set(null);
  }
}

/** Un campo lasciato vuoto è «non lo dico», non la stringa vuota. */
function emptyToNull(value: string | null | undefined): string | null {
  const trimmed = (value ?? '').trim();
  return trimmed ? trimmed : null;
}
