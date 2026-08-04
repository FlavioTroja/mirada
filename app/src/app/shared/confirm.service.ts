import { Injectable, inject } from '@angular/core';
import { ModalComponent, ModalDialogData, ModalService } from '@keijo/ui';
import { check, close } from '@keijo/ui/icons';

export interface ConfirmOptions {
  title: string;
  /**
   * Il testo dice **esattamente cosa succede**, prima e non dopo: è la regola
   * dei dialoghi distruttivi del brief (`RB18`, `RF-RMB-9`, §4.2).
   */
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Colore del pulsante di conferma: rosso per le azioni distruttive. */
  destructive?: boolean;
}

/**
 * Conferma modale, costruita sul `ModalService` di keijo-ui.
 *
 * Ordine dei pulsanti del footer: **primo = annulla (a sinistra), ultimo =
 * conferma (a destra)**, come prescritto dalla libreria.
 *
 * Nota: il testo di questo commento citava per contrasto il servizio modale di
 * Angular Material, e `keijo-fe check-compliance` lo segnalava come violazione
 * di `KEIJO-NO-ANGULAR-MATERIAL` — la regola cerca il nome della classe e lo
 * trovava dentro una frase che ne vietava l'uso. Il nome è stato tolto: questo
 * progetto non ha alcuna dipendenza da Angular Material.
 */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private readonly modal = inject(ModalService);

  async ask(options: ConfirmOptions): Promise<boolean> {
    let confirmed = false;
    const ref = this.modal.open<ModalDialogData, boolean>(ModalComponent, {
      backdropClass: 'blur-filter',
      data: {
        title: options.title,
        content: options.message,
        buttons: [
          {
            iconName: close,
            label: options.cancelLabel ?? 'Annulla',
            onClick: () => ref.close(false),
          },
          {
            iconName: check,
            label: options.confirmLabel ?? 'Conferma',
            bgColor: options.destructive ? 'remove' : 'confirm',
            onClick: () => {
              confirmed = true;
              ref.close(true);
            },
          },
        ],
      },
    });

    const result = await ref.afterClosed();
    return result === true || confirmed;
  }
}
